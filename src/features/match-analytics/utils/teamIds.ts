import type { Match } from '../../../types/Match';
import type { ScorecardData } from '../../../screens/match-detail/types';
import { TARGET_TEAM_ID } from '../../../screens/match-detail/types';

export interface TeamIds {
  ours: number;
  opponent: number | null;
  opponentName: string;
}

type Side = { id: number; name: string };

const toId = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const toName = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function pick(sides: Side[], ourId: number): TeamIds | null {
  const ours = sides.find(s => s.id === ourId);
  if (!ours) return null;
  const other = sides.find(s => s.id !== ourId);
  return { ours: ourId, opponent: other && other.id ? other.id : null, opponentName: other?.name ?? '' };
}

/**
 * Team ids for a MatchDetail screen. Matches opened from My Team carry `team_a_id/team_b_id`, ones from Home
 * carry `team1.id/team2.id`, and ones added from the calendar have neither until the scorecard arrives.
 */
export function resolveTeamIds(matchData: Match | null, scorecard: ScorecardData | null, ourId: number = TARGET_TEAM_ID): TeamIds | null {
  const md = matchData as (Match & { team1?: { id?: unknown; name?: unknown }; team2?: { id?: unknown; name?: unknown } }) | null;
  if (md) {
    const direct = pick([{ id: toId(md.team_a_id), name: toName(md.team_a) }, { id: toId(md.team_b_id), name: toName(md.team_b) }], ourId);
    if (direct) return direct;
    const legacy = pick([{ id: toId(md.team1?.id), name: toName(md.team1?.name) }, { id: toId(md.team2?.id), name: toName(md.team2?.name) }], ourId);
    if (legacy) return legacy;
  }
  const raw = scorecard?.pageProps?.matchData as { team_a?: { id?: unknown; name?: unknown }; team_b?: { id?: unknown; name?: unknown } } | undefined;
  if (raw?.team_a || raw?.team_b) {
    const fromRaw = pick([{ id: toId(raw.team_a?.id), name: toName(raw.team_a?.name) }, { id: toId(raw.team_b?.id), name: toName(raw.team_b?.name) }], ourId);
    if (fromRaw) return fromRaw;
  }
  const innings = scorecard?.pageProps?.scorecard;
  if (Array.isArray(innings) && innings.length) {
    const fromInnings = pick(innings.map(i => ({ id: toId(i?.teamId), name: toName(i?.teamName) })), ourId);
    if (fromInnings) return fromInnings;
  }
  return null;
}
