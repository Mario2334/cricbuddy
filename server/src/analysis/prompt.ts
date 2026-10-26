import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisFacts, PlayerAgg, PoolPlayer } from '../types';

export function loadPromptTemplate(codexDir: string): string {
  return fs.readFileSync(path.join(codexDir, 'prompt.md'), 'utf8');
}

const bat = (a: PlayerAgg | null) =>
  a && a.batting.inns
    ? { inns: a.batting.inns, runs: a.batting.runs, avg: a.batting.avg, sr: a.batting.sr, hs: a.batting.hs, usual_pos: a.batting.usual_pos, pos_bucket: a.batting.pos_bucket, opened: a.batting.opened, recent: a.batting.recent }
    : null;
const bowl = (a: PlayerAgg | null) =>
  a && a.bowling.inns
    ? { spells: a.bowling.inns, overs: Math.round((a.bowling.balls / 6) * 10) / 10, wkts: a.bowling.wkts, econ: a.bowling.econ, best: a.bowling.best, recent: a.bowling.recent }
    : null;

function briefPool(p: PoolPlayer) {
  return {
    player_id: p.player_id,
    name: p.name,
    availability: p.availability,
    role: p.role,
    role_confidence: p.confidence,
    can_keep: p.can_keep,
    part_time_bowler: p.part_time_bowler,
    hand: p.hand,
    appearances: p.agg?.appearances ?? 0,
    last_played: p.last_played,
    batting: bat(p.agg),
    bowling: bowl(p.agg),
  };
}

function briefOpp(a: PlayerAgg) {
  return { player_id: a.player_id, name: a.name, appearances: a.appearances, batting: bat(a), bowling: bowl(a) };
}

/** The compact JSON the model reads: everything numeric it is allowed to cite, nothing it does not need. */
export function buildBrief(facts: AnalysisFacts): Record<string, unknown> {
  return {
    match: facts.match,
    ground_info: facts.ground_info,
    our_team: facts.our_team,
    opposition: {
      id: facts.opposition.id,
      name: facts.opposition.name,
      totals: facts.opposition.totals,
      last5: facts.opposition.last5,
      aggregates: facts.opposition.aggregates,
      captain: facts.opposition.captain,
      keeper: facts.opposition.keeper,
      batters: facts.opposition.batters.map(briefOpp),
      bowlers: facts.opposition.bowlers.map(briefOpp),
    },
    ground: facts.ground,
    availability_known: facts.availability_known,
    pool: facts.pool.map(briefPool),
    unavailable: facts.unavailable,
    gaps: facts.gaps,
  };
}

export function buildPrompt(template: string, facts: AnalysisFacts, feedback = ''): string {
  return `${template.trim()}\n\n## Brief (JSON)\n${JSON.stringify(buildBrief(facts))}${feedback}`;
}
