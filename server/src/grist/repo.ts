import { GristClient, GristRow, bool, fromEpoch, json, nowEpoch, num, str, toEpoch } from './client';
import { TABLES } from './schema';
import type { AiReport, AnalysisFacts, AnalysisJob, AnalysisReport, AvailabilityEntry, AvailabilityStatus, JobStatus, RosterOverride, RosterPlayer } from '../types';

const ACTIVE: JobStatus[] = ['queued', 'fetching', 'thinking'];

// ── Players ─────────────────────────────────────────────────────────────────────────────────
export interface PlayerRow {
  id: number;
  player: RosterPlayer;
  updated_at: string | null;
}

function toPlayerRow(r: GristRow): PlayerRow {
  const f = r.fields;
  const ov = str(f.override) as RosterOverride;
  return {
    id: r.id,
    updated_at: fromEpoch(f.updated_at),
    player: {
      player_id: num(f.player_id) ?? 0,
      name: str(f.name),
      photo: str(f.photo) || null,
      hand: str(f.hand) || null,
      skill_hint: str(f.skill_hint) || null,
      role: (str(f.derived_role) || 'unknown') as RosterPlayer['role'],
      confidence: (str(f.role_confidence) || 'low') as RosterPlayer['confidence'],
      can_keep: bool(f.can_keep),
      part_time_bowler: bool(f.part_time_bowler),
      in_roster: bool(f.in_roster),
      override: ['auto', 'include', 'exclude'].includes(ov) ? ov : 'auto',
      last_played: fromEpoch(f.last_played, true),
      agg: json(f.agg),
    },
  };
}

export interface PlayerUpsert {
  player: RosterPlayer;
  hints: { role_hint: string; bowl_type_hint: string; batter_category: string; bowler_category: string; is_captain: boolean };
}

export class PlayersRepo {
  constructor(private readonly grist: GristClient) {}

  async all(): Promise<PlayerRow[]> {
    return (await this.grist.records(TABLES.Players)).map(toPlayerRow).filter(p => p.player.player_id > 0);
  }

  /** Current overrides, so a roster refresh never overwrites a hand-made decision. */
  async overrides(): Promise<Map<number, RosterOverride>> {
    const m = new Map<number, RosterOverride>();
    for (const row of await this.all()) m.set(row.player.player_id, row.player.override);
    return m;
  }

  /** Insert new players, patch existing ones (every column except `override`). */
  async upsertAll(items: PlayerUpsert[]): Promise<void> {
    const existing = new Map((await this.all()).map(r => [r.player.player_id, r.id]));
    const now = nowEpoch();
    const fields = ({ player: p, hints: h }: PlayerUpsert, withOverride: boolean): Record<string, unknown> => ({
      player_id: p.player_id,
      name: p.name,
      photo: p.photo ?? '',
      hand: p.hand ?? '',
      skill_hint: p.skill_hint ?? '',
      role_hint: h.role_hint,
      bowl_type_hint: h.bowl_type_hint,
      batter_category: h.batter_category,
      bowler_category: h.bowler_category,
      is_captain: h.is_captain,
      derived_role: p.role,
      role_confidence: p.confidence,
      can_keep: p.can_keep,
      part_time_bowler: p.part_time_bowler,
      appearances: p.agg?.appearances ?? 0,
      last_played: toEpoch(p.last_played),
      usual_position: p.agg?.batting.usual_pos ?? null,
      in_roster: p.in_roster,
      ...(withOverride ? { override: p.override } : {}),
      agg: p.agg ? JSON.stringify(p.agg) : '',
      updated_at: now,
    });
    const inserts = items.filter(i => !existing.has(i.player.player_id)).map(i => fields(i, true));
    const patches = items
      .filter(i => existing.has(i.player.player_id))
      .map(i => ({ id: existing.get(i.player.player_id) as number, fields: fields(i, false) }));
    for (let i = 0; i < inserts.length; i += 100) await this.grist.addRecords(TABLES.Players, inserts.slice(i, i + 100));
    for (let i = 0; i < patches.length; i += 100) await this.grist.patchRecords(TABLES.Players, patches.slice(i, i + 100));
  }
}

// ── Availability ────────────────────────────────────────────────────────────────────────────
export class AvailabilityRepo {
  constructor(private readonly grist: GristClient) {}

  async forMatch(matchId: number): Promise<AvailabilityEntry[]> {
    const rows = await this.grist.records(TABLES.Availability, { match_id: [matchId] });
    const byPlayer = new Map<number, AvailabilityEntry>();
    for (const r of rows) {
      const pid = num(r.fields.player_id) ?? 0;
      if (!pid) continue;
      const entry: AvailabilityEntry = {
        player_id: pid,
        status: (str(r.fields.status) || 'unknown') as AvailabilityStatus,
        note: str(r.fields.note),
        updated_at: fromEpoch(r.fields.updated_at),
      };
      const prev = byPlayer.get(pid);
      if (!prev || (entry.updated_at ?? '') >= (prev.updated_at ?? '')) byPlayer.set(pid, entry);
    }
    return [...byPlayer.values()];
  }

  async upsert(matchId: number, entries: { player_id: number; status: AvailabilityStatus; note?: string }[], names: Map<number, string>): Promise<void> {
    const rows = await this.grist.records(TABLES.Availability, { match_id: [matchId] });
    const rowId = new Map<number, number>();
    for (const r of rows) {
      const pid = num(r.fields.player_id) ?? 0;
      if (pid && !rowId.has(pid)) rowId.set(pid, r.id);
    }
    const now = nowEpoch();
    const adds: Record<string, unknown>[] = [];
    const patches: { id: number; fields: Record<string, unknown> }[] = [];
    for (const e of entries) {
      const fields = { match_id: matchId, player_id: e.player_id, player_name: names.get(e.player_id) ?? '', status: e.status, note: e.note ?? '', updated_at: now };
      const id = rowId.get(e.player_id);
      if (id) patches.push({ id, fields });
      else adds.push(fields);
    }
    await this.grist.addRecords(TABLES.Availability, adds);
    await this.grist.patchRecords(TABLES.Availability, patches);
  }
}

// ── Analyses ────────────────────────────────────────────────────────────────────────────────
export interface AnalysisRow {
  id: number;
  match_id: number;
  status: JobStatus;
  requested_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string;
  headline: string;
  model: string;
  availability_hash: string | null;
  facts: AnalysisFacts | null;
  report: AiReport | null;
  opponent_team_id: number | null;
}

function toAnalysisRow(r: GristRow): AnalysisRow {
  const f = r.fields;
  const snap = json<{ hash?: string }>(f.availability_snapshot);
  return {
    id: r.id,
    match_id: num(f.match_id) ?? 0,
    status: (str(f.status) || 'queued') as JobStatus,
    requested_at: fromEpoch(f.requested_at),
    started_at: fromEpoch(f.started_at),
    finished_at: fromEpoch(f.finished_at),
    error: str(f.error),
    headline: str(f.headline),
    model: str(f.model),
    availability_hash: snap?.hash ?? null,
    facts: json<AnalysisFacts>(f.facts),
    report: json<AiReport>(f.report),
    opponent_team_id: num(f.opponent_team_id),
  };
}

export function toJob(row: AnalysisRow): AnalysisJob {
  return {
    id: row.id,
    match_id: row.match_id,
    status: row.status,
    requested_at: row.requested_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    error: row.error || null,
    headline: row.headline || null,
    facts: row.facts,
  };
}

export function toReport(row: AnalysisRow): AnalysisReport | null {
  if (row.status !== 'done' || !row.facts || !row.report) return null;
  return { id: row.id, facts: row.facts, ai: row.report, finished_at: row.finished_at, model: row.model };
}

export class AnalysesRepo {
  constructor(private readonly grist: GristClient) {}

  async forMatch(matchId: number): Promise<AnalysisRow[]> {
    const rows = await this.grist.records(TABLES.Analyses, { match_id: [matchId] });
    return rows.map(toAnalysisRow).sort((a, b) => b.id - a.id);
  }

  async byStatus(statuses: JobStatus[]): Promise<AnalysisRow[]> {
    const rows = await this.grist.records(TABLES.Analyses, { status: statuses });
    return rows.map(toAnalysisRow).sort((a, b) => a.id - b.id);
  }

  async active(matchId?: number): Promise<AnalysisRow[]> {
    const rows = await this.byStatus(ACTIVE);
    return matchId ? rows.filter(r => r.match_id === matchId) : rows;
  }

  async get(id: number): Promise<AnalysisRow | null> {
    const rows = await this.grist.records(TABLES.Analyses, { id: [id] });
    return rows[0] ? toAnalysisRow(rows[0]) : null;
  }

  async create(fields: {
    match_id: number;
    opponent_team_id: number | null;
    opponent_name: string;
    ground_id: number | null;
    ground_name: string;
    match_start: string | null;
    model: string;
    reasoning_effort: string;
  }): Promise<AnalysisRow> {
    const [id] = await this.grist.addRecords(TABLES.Analyses, [
      { ...fields, match_start: toEpoch(fields.match_start), status: 'queued', requested_at: nowEpoch(), attempts: 0, error: '' },
    ]);
    const row = await this.get(id);
    if (!row) throw new Error(`Analyses row ${id} vanished`);
    return row;
  }

  async patch(id: number, fields: Record<string, unknown>): Promise<void> {
    await this.grist.patchRecords(TABLES.Analyses, [{ id, fields }]);
  }

  /** Rows started on the given IST calendar day (for the daily cap). */
  async startedOn(dayIst: string): Promise<number> {
    const rows = await this.grist.records(TABLES.Analyses);
    return rows.filter(r => {
      const started = num(r.fields.started_at);
      return started ? istDay(started) === dayIst : false;
    }).length;
  }
}

/** yyyy-mm-dd of an epoch-seconds instant in Asia/Kolkata (UTC+5:30, no DST). */
export function istDay(epochSeconds: number): string {
  return new Date((epochSeconds + 19_800) * 1000).toISOString().slice(0, 10);
}
