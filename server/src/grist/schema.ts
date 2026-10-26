import type { GristClient, GristColumn } from './client';
import { log } from '../log';

const choice = (id: string, label: string, choices: string[]): GristColumn => ({
  id,
  fields: { label, type: 'Choice', widgetOptions: JSON.stringify({ choices }) },
});
const col = (id: string, label: string, type: string): GristColumn => ({ id, fields: { label, type } });
const dt = (id: string, label: string): GristColumn => col(id, label, 'DateTime:Asia/Kolkata');

export const TABLES = {
  Players: 'Players',
  Availability: 'Availability',
  Analyses: 'Analyses',
} as const;

export const ROLE_CHOICES = ['batter', 'bowler', 'all-rounder', 'wicket-keeper', 'unknown'];
export const AVAILABILITY_CHOICES = ['yes', 'maybe', 'no', 'unknown'];
export const JOB_CHOICES = ['queued', 'fetching', 'thinking', 'done', 'failed'];

export const SCHEMA: Record<string, GristColumn[]> = {
  [TABLES.Players]: [
    col('player_id', 'Player id', 'Int'),
    col('name', 'Name', 'Text'),
    col('photo', 'Photo', 'Text'),
    choice('hand', 'Bats', ['RHB', 'LHB']),
    choice('skill_hint', 'Skill (CricHeroes)', ['BAT', 'BOWL', 'ALL']),
    col('role_hint', 'Role id (CricHeroes)', 'Text'),
    col('bowl_type_hint', 'Bowling type id (CricHeroes)', 'Text'),
    col('batter_category', 'Batter category', 'Text'),
    col('bowler_category', 'Bowler category', 'Text'),
    col('is_captain', 'Captain', 'Bool'),
    choice('derived_role', 'Role (derived)', ROLE_CHOICES),
    choice('role_confidence', 'Role confidence', ['low', 'medium', 'high']),
    col('can_keep', 'Can keep', 'Bool'),
    col('part_time_bowler', 'Part-time bowler', 'Bool'),
    col('appearances', 'Appearances', 'Int'),
    col('last_played', 'Last played', 'Date'),
    col('usual_position', 'Usual position', 'Numeric'),
    col('in_roster', 'In roster', 'Bool'),
    choice('override', 'Override', ['auto', 'include', 'exclude']),
    col('agg', 'Aggregates (JSON)', 'Text'),
    dt('updated_at', 'Updated'),
  ],
  [TABLES.Availability]: [
    col('match_id', 'Match id', 'Int'),
    col('player_id', 'Player id', 'Int'),
    col('player_name', 'Player', 'Text'),
    choice('status', 'Status', AVAILABILITY_CHOICES),
    col('note', 'Note', 'Text'),
    dt('updated_at', 'Updated'),
  ],
  [TABLES.Analyses]: [
    col('match_id', 'Match id', 'Int'),
    col('opponent_team_id', 'Opponent id', 'Int'),
    col('opponent_name', 'Opponent', 'Text'),
    col('ground_id', 'Ground id', 'Int'),
    col('ground_name', 'Ground', 'Text'),
    dt('match_start', 'Match start'),
    choice('status', 'Status', JOB_CHOICES),
    dt('requested_at', 'Requested'),
    dt('started_at', 'Started'),
    dt('finished_at', 'Finished'),
    col('model', 'Model', 'Text'),
    col('reasoning_effort', 'Reasoning', 'Text'),
    col('availability_snapshot', 'Availability snapshot (JSON)', 'Text'),
    col('facts', 'Facts (JSON)', 'Text'),
    col('report', 'Report (JSON)', 'Text'),
    col('headline', 'Headline', 'Text'),
    col('error', 'Error', 'Text'),
    col('duration_s', 'Duration (s)', 'Numeric'),
    col('attempts', 'Attempts', 'Int'),
  ],
};

/** Create missing tables and columns. Idempotent; safe to run at every boot. */
export async function ensureSchema(grist: GristClient): Promise<void> {
  const existing = new Set(await grist.tables());
  for (const [table, columns] of Object.entries(SCHEMA)) {
    if (!existing.has(table)) {
      await grist.createTable(table, columns);
      log.info('grist: created table', { table });
      continue;
    }
    const have = new Set(await grist.columns(table));
    const missing = columns.filter(c => !have.has(c.id));
    if (missing.length) {
      await grist.addColumns(table, missing);
      log.info('grist: added columns', { table, columns: missing.map(c => c.id) });
    }
  }
}
