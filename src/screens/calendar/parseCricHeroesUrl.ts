// Expected format: https://cricheroes.in/scorecard/18599605/Virat-Cup-T30-Edition-3/Vikings-Inspired-vs-AVENGERZ-XI
// Also supports .com and other variations.
export const CRICHEROES_SCORECARD_URL = /https?:\/\/(?:www\.)?cricheroes\.(?:in|com)\/scorecard\/(\d+)\/([^/]+)\/([^/]+)/;

export interface ParsedScorecardUrl {
  matchId: string;
  tournamentName: string;
  team1: string;
  team2: string;
}

export function isScorecardUrl(url: string): boolean {
  return CRICHEROES_SCORECARD_URL.test(url.trim());
}

/** Parse a CricHeroes scorecard URL into match id, tournament and team names. */
export function parseCricHeroesUrl(url: string): ParsedScorecardUrl {
  const match = url.match(CRICHEROES_SCORECARD_URL);
  if (!match) {
    throw new Error('Invalid CricHeroes URL format');
  }

  const [, matchId, tournamentName, teamsString] = match;

  // Team names are encoded as Team1-vs-Team2
  const teamsParts = teamsString.split('-vs-');
  if (teamsParts.length !== 2) {
    throw new Error('Could not parse team names from URL');
  }

  return {
    matchId,
    tournamentName: tournamentName.replace(/-/g, ' '),
    team1: teamsParts[0].replace(/-/g, ' '),
    team2: teamsParts[1].replace(/-/g, ' '),
  };
}
