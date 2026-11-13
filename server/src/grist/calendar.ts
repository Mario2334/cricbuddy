import type { GristClient } from './client';
import { HttpError } from '../http/router';
export interface ScheduledMatch { matchId: string; tournamentName: string; teamNames: { team1: string; team2: string }; scheduledAt: string; [key: string]: unknown }
export function validateMatch(value: unknown): ScheduledMatch {
  const m = value as ScheduledMatch;
  if (!m || typeof m.matchId !== 'string' || !/^[1-9]\d{0,14}$/.test(m.matchId) || typeof m.tournamentName !== 'string' || typeof m.teamNames?.team1 !== 'string' || typeof m.teamNames?.team2 !== 'string' || typeof m.scheduledAt !== 'string' || JSON.stringify(m).length > 20000) throw new HttpError(400, 'Invalid scheduled match');
  return m;
}
/** One process owns writes. Tombstones also participate in import deduplication. */
export class CalendarRepo {
  private queues = new Map<string, Promise<unknown>>();
  constructor(private grist: GristClient) {}
  private async serial<T>(user: string, run: () => Promise<T>): Promise<T> {
    const task = (this.queues.get(user) ?? Promise.resolve()).catch(() => {}).then(run);
    this.queues.set(user, task);
    try { return await task; } finally { if (this.queues.get(user) === task) this.queues.delete(user); }
  }
  private rows(user: string) { return this.grist.records('ScheduledMatches', { user: [user] }); }
  async list(user: string) { return (await this.rows(user)).filter(r => !r.fields.deleted).map(r => JSON.parse(String(r.fields.payload)) as ScheduledMatch); }
  async put(user: string, id: string, match: ScheduledMatch | null) {
    return this.serial(user, async () => {
      const rows = await this.rows(user); const row = rows.find(r => r.fields.match_id === id);
      const fields = { user, match_id: id, payload: match ? JSON.stringify(match) : '', deleted: !match, updated_at: Date.now() / 1000 };
      if (row) await this.grist.patchRecords('ScheduledMatches', [{ id: row.id, fields }]);
      else await this.grist.addRecords('ScheduledMatches', [fields]);
      return { ok: true };
    });
  }
  async import(user: string, matches: ScheduledMatch[]) {
    return this.serial(user, async () => {
      const ids = new Set((await this.rows(user)).map(r => String(r.fields.match_id)));
      for (const match of matches) {
        if (ids.has(match.matchId)) continue;
        await this.grist.addRecords('ScheduledMatches', [{ user, match_id: match.matchId, payload: JSON.stringify(match), deleted: false, updated_at: Date.now() / 1000 }]);
        ids.add(match.matchId);
      }
      return { ok: true, matches: await this.list(user) };
    });
  }
}
