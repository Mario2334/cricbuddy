import type { Config } from '../config';
import type { CricHeroesClient } from '../cricheroes/client';
import type { RawTeamMatch } from '../cricheroes/types';
import { analyzeGaps } from '../domain/gaps';
import { buildRoster, lastPlayedMap, type RosterEntry } from '../domain/roster';
import { n, normalizeScorecard, type NormScorecard } from '../domain/scorecard';
import { aggregatePlayers, byStartDesc, headToHead, leaders, matchLine, pastOnly, teamAggregates, groundSummary } from '../domain/stats';
import type { AvailabilityRepo, PlayersRepo } from '../grist/repo';
import { HttpError } from '../http/router';
import { log } from '../log';
import type { AnalysisFacts, AnalysisPostBody, AvailabilityStatus, GroundInfo, MatchCtx, PoolPlayer, RosterPlayer, SquadGaps, TeamTotals } from '../types';

export interface FactsDeps {
  cfg: Config;
  ch: CricHeroesClient;
  players: PlayersRepo;
  availability: AvailabilityRepo;
}

export interface MatchResolution {
  ctx: MatchCtx;
  fixture: RawTeamMatch | null;
}

function ctxFromFixture(m: RawTeamMatch, cfg: Config): MatchCtx {
  const weAreA = n(m.team_a_id) === cfg.teamId;
  return {
    match_id: n(m.match_id),
    status: m.status,
    start: m.match_start_time ?? null,
    overs: n(m.overs) || 20,
    ball_type: m.ball_type ?? null,
    match_type: m.match_type ?? null,
    tournament: m.tournament_name ?? null,
    our_team_id: cfg.teamId,
    our_team: (weAreA ? m.team_a : m.team_b) || cfg.teamName,
    opponent_team_id: n(weAreA ? m.team_b_id : m.team_a_id),
    opponent_name: (weAreA ? m.team_b : m.team_a) || 'Opposition',
    ground_id: m.ground_id ? n(m.ground_id) : null,
    ground_name: m.ground_name ?? null,
    city: m.city_name ?? null,
  };
}

/** Find the match in our own fixtures (so we know it is ours and still upcoming); the app's hint is a fallback. */
export async function resolveMatch(deps: FactsDeps, matchId: number, hint?: AnalysisPostBody['hint'], opts: { requireUpcoming?: boolean } = {}): Promise<MatchResolution> {
  const fixtures = await deps.ch.teamMatches(deps.cfg.teamId, { minPast: deps.cfg.rosterWindow });
  const fixture = fixtures.find(m => n(m.match_id) === matchId) ?? null;
  if (fixture) {
    if (opts.requireUpcoming && fixture.status !== 'upcoming') throw new HttpError(409, `Match ${matchId} is ${fixture.status}, not upcoming`, 'not_upcoming');
    return { ctx: ctxFromFixture(fixture, deps.cfg), fixture };
  }
  if (hint && hint.team_a_id && hint.team_b_id && (hint.team_a_id === deps.cfg.teamId || hint.team_b_id === deps.cfg.teamId)) {
    const weAreA = hint.team_a_id === deps.cfg.teamId;
    return {
      fixture: null,
      ctx: {
        match_id: matchId,
        status: 'upcoming',
        start: hint.match_start_time ?? null,
        overs: hint.overs ?? 20,
        ball_type: null,
        match_type: null,
        tournament: null,
        our_team_id: deps.cfg.teamId,
        our_team: deps.cfg.teamName,
        opponent_team_id: weAreA ? hint.team_b_id : hint.team_a_id,
        opponent_name: 'Opposition',
        ground_id: hint.ground_id ?? null,
        ground_name: null,
        city: null,
      },
    };
  }
  throw new HttpError(404, `Match ${matchId} is not in ${deps.cfg.teamName}'s fixtures`, 'not_found');
}

async function scorecards(ch: CricHeroesClient, fixtures: RawTeamMatch[]): Promise<NormScorecard[]> {
  const out: NormScorecard[] = [];
  for (const m of fixtures) {
    try {
      out.push(normalizeScorecard(await ch.scorecard(n(m.match_id), { immutable: true })));
    } catch (e) {
      log.warn('scorecard skipped', { match: m.match_id, error: (e as Error).message });
    }
  }
  return out;
}

/** Our recent scorecards (newest first) and the roster derived from them, saved to Grist. */
export async function refreshRoster(deps: FactsDeps): Promise<{ entries: RosterEntry[]; ourCards: NormScorecard[]; ourFixtures: RawTeamMatch[] }> {
  const { cfg, ch } = deps;
  const ourFixtures = await ch.teamMatches(cfg.teamId, { minPast: cfg.rosterWindow });
  const recent = pastOnly(ourFixtures).slice(0, cfg.rosterWindow);
  const [ourCards, members, overrides] = await Promise.all([scorecards(ch, recent), ch.teamPlayers(cfg.teamId), deps.players.overrides()]);
  const entries = buildRoster({
    members,
    aggs: aggregatePlayers(ourCards, cfg.teamId),
    lastPlayed: lastPlayedMap(ourCards, cfg.teamId),
    overrides,
  });
  await deps.players.upsertAll(entries);
  log.info('roster refreshed', { members: members.length, in_roster: entries.filter(e => e.player.in_roster).length, matches: ourCards.length });
  return { entries, ourCards, ourFixtures };
}

function totalsFrom(stats: { title: string; value: number | string }[] | null): TeamTotals | null {
  if (!stats) return null;
  const get = (t: string) => stats.find(s => s.title.toLowerCase() === t.toLowerCase())?.value;
  const num = (t: string) => n(get(t));
  return { matches: num('Matches'), won: num('Won'), lost: num('Lost'), win_pct: String(get('Win') ?? ''), toss_won: num('Toss Won'), bat_first: num('Bat First'), field_first: num('Field First') };
}

/** Everyone the selection can draw from: roster members plus anyone with a yes/maybe for this match. */
export function selectionPool(
  roster: RosterPlayer[],
  entries: Map<number, AvailabilityStatus>,
): { pool: PoolPlayer[]; unavailable: AnalysisFacts['unavailable']; gaps_map: Map<number, AvailabilityStatus>; known: boolean; candidates: RosterPlayer[] } {
  const known = [...entries.values()].some(s => s !== 'unknown');
  const candidates = roster.filter(p => p.in_roster || (entries.get(p.player_id) ?? 'unknown') !== 'unknown');
  const gapsMap = new Map<number, AvailabilityStatus>();
  for (const p of candidates) gapsMap.set(p.player_id, known ? entries.get(p.player_id) ?? 'unknown' : 'yes');
  const pool: PoolPlayer[] = [];
  const unavailable: AnalysisFacts['unavailable'] = [];
  for (const p of candidates) {
    const s = gapsMap.get(p.player_id) ?? 'unknown';
    if (s === 'yes' || s === 'maybe') pool.push({ ...p, availability: s });
    else if (s === 'no') unavailable.push({ player_id: p.player_id, name: p.name, role: p.role });
  }
  return { pool, unavailable, gaps_map: gapsMap, known, candidates };
}

export function gapsFor(roster: RosterPlayer[], entries: Map<number, AvailabilityStatus>, overs: number): SquadGaps {
  const { candidates, gaps_map } = selectionPool(roster, entries);
  return analyzeGaps(candidates, gaps_map, overs);
}

export async function buildFacts(deps: FactsDeps, ctx: MatchCtx): Promise<AnalysisFacts> {
  const { cfg, ch } = deps;
  const oppId = ctx.opponent_team_id;
  const { entries: roster, ourCards, ourFixtures } = await refreshRoster(deps);

  const [oppFixtures, oppStats, groundRaw] = await Promise.all([
    ch.teamMatches(oppId, { minPast: cfg.oppWindow }).catch(e => {
      log.warn('opposition fixtures unavailable', { error: (e as Error).message });
      return [] as RawTeamMatch[];
    }),
    ch.teamStatistic(oppId).catch(() => null),
    ctx.ground_id ? ch.groundDetail(ctx.ground_id).catch(() => null) : Promise.resolve(null),
  ]);
  const oppPast = pastOnly(oppFixtures).slice(0, cfg.oppWindow);
  const oppCards = await scorecards(ch, oppPast);

  // Ground history: both teams' past fixtures at this ground, newest first.
  let ground: AnalysisFacts['ground'] = null;
  const groundInfo: GroundInfo | null = groundRaw
    ? {
        id: n(groundRaw.ground_id) || (ctx.ground_id ?? 0),
        name: groundRaw.name ?? ctx.ground_name ?? '',
        city: groundRaw.city_name ?? ctx.city,
        pitch_types: (groundRaw.pitch_types ?? []).map(p => p.text).filter(Boolean),
        shortest_boundary: groundRaw.shortest_boundary_length == null ? null : n(groundRaw.shortest_boundary_length) || null,
        longest_boundary: groundRaw.longest_boundary_length == null ? null : n(groundRaw.longest_boundary_length) || null,
        ground_type: groundRaw.ground_type ?? null,
      }
    : ctx.ground_id
      ? { id: ctx.ground_id, name: ctx.ground_name ?? '', city: ctx.city, pitch_types: [], shortest_boundary: null, longest_boundary: null, ground_type: null }
      : null;
  if (ctx.ground_id) {
    const seen = new Set<number>();
    const atGround = [...pastOnly(ourFixtures), ...pastOnly(oppFixtures)]
      .filter(m => n(m.ground_id) === ctx.ground_id)
      .filter(m => (seen.has(n(m.match_id)) ? false : (seen.add(n(m.match_id)), true)))
      .sort(byStartDesc);
    const sameBall = atGround.filter(m => !ctx.ball_type || m.ball_type === ctx.ball_type);
    const picked = (sameBall.length >= cfg.groundWindow ? sameBall : atGround).slice(0, cfg.groundWindow);
    const known = new Map([...ourCards, ...oppCards].map(c => [c.match_id, c]));
    const cards = [...known.values()].filter(c => picked.some(m => n(m.match_id) === c.match_id));
    const missing = picked.filter(m => !known.has(n(m.match_id)));
    cards.push(...(await scorecards(ch, missing)));
    cards.sort((a, b) => Date.parse(b.start ?? '') - Date.parse(a.start ?? ''));
    ground = groundSummary(cards, pastOnly(ourFixtures).filter(m => n(m.ground_id) === ctx.ground_id), cfg.teamId);
  }

  const oppAggs = [...aggregatePlayers(oppCards, oppId).values()];
  const batters = oppAggs.filter(a => a.batting.inns > 0).sort((a, b) => b.batting.runs - a.batting.runs).slice(0, 7);
  const bowlers = oppAggs
    .filter(a => a.bowling.inns > 0)
    .sort((a, b) => b.bowling.wkts - a.bowling.wkts || (a.bowling.econ ?? 99) - (b.bowling.econ ?? 99))
    .slice(0, 7);
  const lead = leaders(oppCards, oppId);

  const entries = new Map((await deps.availability.forMatch(ctx.match_id)).map(e => [e.player_id, e.status]));
  const rosterPlayers = roster.map(r => r.player);
  const { pool, unavailable, gaps_map, known, candidates } = selectionPool(rosterPlayers, entries);

  return {
    generated_at: new Date().toISOString(),
    match: ctx,
    ground_info: groundInfo,
    our_team: {
      id: cfg.teamId,
      name: ctx.our_team,
      last10: pastOnly(ourFixtures).slice(0, cfg.ourWindow).map(m => matchLine(m, cfg.teamId)),
      vs_opponent: headToHead(ourFixtures, cfg.teamId, oppId),
    },
    opposition: {
      id: oppId,
      name: ctx.opponent_name,
      totals: totalsFrom(oppStats),
      last5: oppPast.map(m => matchLine(m, oppId)),
      aggregates: teamAggregates(oppCards, oppId),
      batters,
      bowlers,
      captain: lead.captain,
      keeper: lead.keeper,
    },
    ground,
    pool: pool.sort((a, b) => a.name.localeCompare(b.name)),
    unavailable,
    gaps: analyzeGaps(candidates, gaps_map, ctx.overs),
    availability_known: known,
  };
}
