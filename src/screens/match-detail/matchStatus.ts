// Pure: no React Native imports, so it unit-tests in node.
import { normalizeStatus } from '../../utils/matchDisplay';
import type { ScorecardData } from './types';

export type DetectedStatus = 'live' | 'past' | 'upcoming';

/** No CricHeroes match is still in play this long after its start. */
export const MAX_LIVE_MS = 12 * 60 * 60 * 1000;

export interface DetectOptions {
  /** Status the list card already knew (only a "past" hint is trusted). */
  listStatus?: string | null;
  /** Scheduled start, used to rule out "live" for long-finished matches. */
  start?: Date | null;
  now?: number;
}

const hasText = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : v != null && v !== false && v !== 0);

/**
 * Live / past / upcoming from a scorecard. The API's own status wins; a result
 * means it's over; only then are the innings read, and a match that started
 * more than 12 hours ago is never treated as live (a chase that ended early
 * used to look "incomplete" and auto-refreshed forever).
 */
export function detectMatchStatus(scorecard: ScorecardData | null | undefined, opts: DetectOptions = {}): DetectedStatus {
  const pageProps = scorecard?.pageProps;
  const info = pageProps?.matchInfo ?? {};
  const raw = pageProps?.matchData ?? {};

  const api = normalizeStatus(info.status ?? raw.status);
  if (api !== 'unknown') return api;

  if (hasText(info.matchResult) || hasText(info.winBy) || hasText(info.winningTeam) || hasText(raw.match_result)) {
    return 'past';
  }
  if (normalizeStatus(opts.listStatus) === 'past') return 'past';

  const innings = pageProps?.scorecard;
  if (!Array.isArray(innings) || innings.length === 0) return 'upcoming';

  const now = opts.now ?? Date.now();
  if (opts.start && now - opts.start.getTime() > MAX_LIVE_MS) return 'past';

  const incomplete = innings.some(entry => {
    const inning = entry?.inning;
    if (!inning) return false;
    const overs = parseFloat(inning.overs_played);
    return (
      inning.is_completed === false ||
      inning.status === 'live' ||
      (inning.total_wicket < 10 && !!inning.overs_played && overs < (inning.total_overs || 20))
    );
  });
  return incomplete ? 'live' : 'past';
}
