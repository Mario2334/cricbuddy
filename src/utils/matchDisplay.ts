import type { Match } from '../types/Match';
import type { RootStackParamList } from '../types/navigation';
import { toDate, toDateKey, type MatchStatus } from './dates';

export function normalizeStatus(status: string | null | undefined): MatchStatus {
  switch ((status || '').toLowerCase()) {
    case 'live':
      return 'live';
    case 'upcoming':
    case 'scheduled':
      return 'upcoming';
    case 'past':
    case 'completed':
    case 'done':
    case 'finished':
      return 'past';
    default:
      return 'unknown';
  }
}

export function getTeamNames(m: Match): { team1: string; team2: string } {
  return {
    team1: m.team1_name || m.team_a || 'Team 1',
    team2: m.team2_name || m.team_b || 'Team 2',
  };
}

export function getMatchStart(m: Match): Date | null {
  return toDate(m.start_time || m.match_start_time);
}

export function teamInitials(name: string | null | undefined): string {
  const words = (name || '').trim().split(/[\s\-_]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const TEAM_COLORS: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#D1FAE5', fg: '#047857' },
  { bg: '#CCFBF1', fg: '#0F766E' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#FFE4E6', fg: '#BE123C' },
];

/** Deterministic pastel per team/person name. */
export function teamColor(name: string | null | undefined): { bg: string; fg: string } {
  return TEAM_COLORS[hashString((name || '?').toLowerCase()) % TEAM_COLORS.length];
}

export function sortByStart(list: Match[], dir: 'asc' | 'desc' = 'asc'): Match[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const ta = getMatchStart(a)?.getTime() ?? 0;
    const tb = getMatchStart(b)?.getTime() ?? 0;
    return (ta - tb) * sign;
  });
}

export interface MarkedDay {
  count: number;
  statuses: MatchStatus[];
}

/** Map of yyyy-MM-dd -> match count and statuses, for WeekStrip and MonthGrid dots. */
export function buildMarkedDates(matches: Match[]): Record<string, MarkedDay> {
  const out: Record<string, MarkedDay> = {};
  for (const m of matches) {
    const start = getMatchStart(m);
    if (!start) continue;
    const key = toDateKey(start);
    const entry = out[key] || (out[key] = { count: 0, statuses: [] });
    entry.count += 1;
    entry.statuses.push(normalizeStatus(m.status));
  }
  return out;
}

export function matchKey(m: Match, index: number): string {
  return String(m.id || m.match_id || `idx-${index}`);
}

export function scoreLine(score: Match['team1_score']): string | null {
  if (!score) return null;
  return score.summary || `${score.runs}/${score.wickets} (${score.overs})`;
}

/**
 * MatchDetail params. Defaults mirror what Home and My Team always passed;
 * Calendar overrides `city` and `defaultTab`.
 */
export function buildMatchDetailParams(
  m: Match,
  overrides: Partial<RootStackParamList['MatchDetail']> = {},
): RootStackParamList['MatchDetail'] | null {
  const matchId = m.id || m.match_id;
  if (!matchId) return null;
  return {
    matchId: matchId.toString(),
    tournamentName: m.tournament_name || 'Match',
    teamNames: getTeamNames(m),
    groundName: m.ground_name,
    groundId: m.ground_id,
    city: undefined,
    matchStartTime: m.match_start_time || m.start_time,
    defaultTab: m.status === 'live' || m.status === 'past' ? 'scorecard' : 'info',
    ...overrides,
  };
}
