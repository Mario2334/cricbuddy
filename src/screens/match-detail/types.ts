// Local shapes for the MatchDetail screen. The scorecard API is loosely typed,
// so these stay permissive (index signatures) exactly like the originals.

export interface Innings {
  teamName: string;
  [key: string]: any;
}

export interface ScorecardData {
  pageProps?: {
    scorecard?: Innings[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ScorecardRoute {
  key: string;
  title: string;
  innings: Innings;
}

export type MainTabKey = 'info' | 'scorecard' | 'gameplan';

export interface MainTabRoute {
  key: MainTabKey;
  title: string;
}

/** Narrow shape of `getMatchScorecard().data` when it carries match details. */
export interface ScorecardMatchEnvelope {
  data?: unknown;
  [key: string]: unknown;
}

export const BALL_JERSEY_OPTIONS = ['White ball, Coloured Jersey', 'Red Ball, White Jersey'];

export const TARGET_TEAM_ID = 5179117;
