import type { Match } from '../types/Match';

// The Match a list card was showing, kept so MatchDetail can render it straight
// away instead of paging through the team's fixtures to find it again.
const matches = new Map<string, Match>();
const MAX_ENTRIES = 200;

const idOf = (m: Match) => String(m.id || m.match_id || '');

export function rememberMatch(m: Match): void {
  const id = idOf(m);
  if (!id || id === '0') return;
  matches.delete(id);
  matches.set(id, m);
  if (matches.size > MAX_ENTRIES) {
    const oldest = matches.keys().next().value;
    if (oldest !== undefined) matches.delete(oldest);
  }
}

export function getRememberedMatch(matchId: string | number | null | undefined): Match | undefined {
  return matchId == null ? undefined : matches.get(String(matchId));
}
