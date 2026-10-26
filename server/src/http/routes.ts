import fs from 'node:fs';
import type { RunDeps } from '../analysis/run';
import { isStale } from '../analysis/run';
import { gapsFor, refreshRoster, resolveMatch } from '../analysis/facts';
import { istDay, toJob, toReport } from '../grist/repo';
import type { JobRunner } from '../jobs/runner';
import type { AnalysisPostBody, AnalysisResponse, AvailabilityPutBody, AvailabilityResponse, AvailabilityStatus, HealthResponse, PlayersResponse, RosterPlayer } from '../types';
import { HttpError, Reply, Router, intParam, readJson, type Ctx } from './router';

export interface AppDeps extends RunDeps {
  runner: JobRunner;
  codexBin: string | null;
}

const STATUSES: AvailabilityStatus[] = ['yes', 'maybe', 'no', 'unknown'];
const ROSTER_MAX_AGE_MS = 24 * 3_600_000;

/** Players from Grist, refreshed from CricHeroes when empty, stale, or asked to. */
async function rosterPlayers(deps: AppDeps, force = false): Promise<{ players: RosterPlayer[]; updated_at: string | null }> {
  const rows = await deps.players.all();
  const newest = rows.reduce<string | null>((acc, r) => (r.updated_at && (!acc || r.updated_at > acc) ? r.updated_at : acc), null);
  const stale = !newest || Date.now() - Date.parse(newest) > ROSTER_MAX_AGE_MS;
  if (force || !rows.length || stale) {
    const { entries } = await refreshRoster(deps);
    return { players: entries.map(e => e.player), updated_at: new Date().toISOString() };
  }
  return { players: rows.map(r => r.player), updated_at: newest };
}

async function availabilityResponse(deps: AppDeps, matchId: number, all: boolean): Promise<AvailabilityResponse> {
  const { ctx } = await resolveMatch(deps, matchId);
  const [{ players }, entries] = await Promise.all([rosterPlayers(deps), deps.availability.forMatch(matchId)]);
  const entryMap = new Map(entries.map(e => [e.player_id, e.status]));
  const shown = all ? players : players.filter(p => p.in_roster || (entryMap.get(p.player_id) ?? 'unknown') !== 'unknown');
  return { match: ctx, players: shown, entries, gaps: gapsFor(players, entryMap, ctx.overs) };
}

export function buildRouter(deps: AppDeps): Router {
  const r = new Router();

  r.add('GET', '/health', async (): Promise<HealthResponse> => ({
    ok: true,
    version: deps.cfg.version,
    grist: await deps.analyses.byStatus(['queued']).then(() => true).catch(() => false),
    codex_bin: deps.cfg.codexFake ? true : !!deps.codexBin && fs.existsSync(deps.codexBin),
    queue: { active: deps.runner.active },
  }));

  r.add('GET', '/team/players', async ({ query }: Ctx): Promise<PlayersResponse> => {
    const { players, updated_at } = await rosterPlayers(deps, query.get('refresh') === '1');
    return { players, roster_count: players.filter(p => p.in_roster).length, updated_at };
  });

  r.add('GET', '/matches/:id/availability', ({ params, query }: Ctx) => availabilityResponse(deps, intParam(params, 'id'), query.get('all') === '1'));

  r.add('PUT', '/matches/:id/availability', async ({ params, query, req }: Ctx) => {
    const matchId = intParam(params, 'id');
    const body = (await readJson(req)) as AvailabilityPutBody | null;
    const entries = Array.isArray(body?.entries) ? body.entries : null;
    if (!entries) throw new HttpError(400, 'Body must be {entries: [{player_id, status, note?}]}');
    for (const e of entries) {
      if (!Number.isInteger(e?.player_id) || e.player_id <= 0) throw new HttpError(400, 'Each entry needs a positive integer player_id');
      if (!STATUSES.includes(e.status)) throw new HttpError(400, `status must be one of ${STATUSES.join(', ')}`);
    }
    await resolveMatch(deps, matchId);
    const names = new Map((await deps.players.all()).map(row => [row.player.player_id, row.player.name]));
    await deps.availability.upsert(matchId, entries.map(e => ({ player_id: e.player_id, status: e.status, note: typeof e.note === 'string' ? e.note.slice(0, 200) : '' })), names);
    return availabilityResponse(deps, matchId, query.get('all') === '1');
  });

  r.add('POST', '/matches/:id/analysis', async ({ params, req }: Ctx) => {
    const matchId = intParam(params, 'id');
    const body = ((await readJson(req)) ?? {}) as AnalysisPostBody;
    const { ctx } = await resolveMatch(deps, matchId, body.hint, { requireUpcoming: true });
    const [active] = await deps.analyses.active(matchId);
    if (active) return new Reply(200, { job: toJob(active) });
    const today = istDay(Math.floor(Date.now() / 1000));
    const used = await deps.analyses.startedOn(today);
    if (used >= deps.cfg.analysisDailyCap) throw new HttpError(429, `Daily limit of ${deps.cfg.analysisDailyCap} game plans reached; try again tomorrow`, 'daily_cap');
    const row = await deps.analyses.create({
      match_id: matchId,
      opponent_team_id: ctx.opponent_team_id,
      opponent_name: ctx.opponent_name,
      ground_id: ctx.ground_id,
      ground_name: ctx.ground_name ?? '',
      match_start: ctx.start,
      model: deps.cfg.codexModel,
      reasoning_effort: deps.cfg.codexReasoningEffort,
    });
    deps.runner.enqueue();
    return new Reply(202, { job: toJob(row) });
  });

  r.add('GET', '/matches/:id/analysis', async ({ params }: Ctx): Promise<AnalysisResponse> => {
    const matchId = intParam(params, 'id');
    const rows = await deps.analyses.forMatch(matchId);
    const latest = rows[0] ?? null;
    const done = rows.find(x => x.status === 'done') ?? null;
    const report = done ? toReport(done) : null;
    return { job: latest ? toJob(latest) : null, report, stale: done ? await isStale(deps, done) : false };
  });

  return r;
}
