// Pure: no React Native imports, so it unit-tests in node.
import type { Match } from '../types/Match';
import { getTeamNames } from './matchDisplay';

// Lowercase, runs of whitespace to '-'; everything else (brackets, dots) is kept,
// the same slugs the WhatsApp message has always used.
const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-');

/** Public CricHeroes scorecard URL: https://cricheroes.com/scorecard/{id}/{tournament}/{team1}-vs-{team2} */
export function buildCricHeroesMatchUrl(
  matchId: string | number,
  tournamentName: string | null | undefined,
  teamNames: { team1?: string | null; team2?: string | null },
): string {
  const tournament = slug(tournamentName || 'match');
  return `https://cricheroes.com/scorecard/${matchId}/${tournament}/${slug(teamNames.team1 || 'team-1')}-vs-${slug(teamNames.team2 || 'team-2')}`;
}

/** Link for a list card's match, or null when it has no id. */
export function matchUrlFor(m: Match): string | null {
  const id = m.id || m.match_id;
  if (!id) return null;
  return buildCricHeroesMatchUrl(id, m.tournament_name, getTeamNames(m));
}
