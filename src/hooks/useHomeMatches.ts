import { useCallback, useMemo, useRef, useState } from 'react';
import apiService from '../services/apiService';
import type { Match } from '../types/Match';
import { getLocalScheduledMatches } from '../utils/matchUtils';
import { getMatchStart } from '../utils/matchDisplay';

export type HomeSegment = 'upcoming' | 'live' | 'past';

export interface SegmentState {
  matches: Match[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  nextPageUrl: string | null;
  loaded: boolean;
}

const initialSegment: SegmentState = {
  matches: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: null,
  nextPageUrl: null,
  loaded: false,
};

// A focus within this window reuses the last load instead of refetching.
const FOCUS_REFRESH_MS = 30_000;

const startMs = (m: Match) => getMatchStart(m)?.getTime() ?? 0;

/** Dedupe by match id (first wins) and sort by start time, parsing each date once. */
function uniqueSorted(list: Match[], dir: 'asc' | 'desc'): Match[] {
  const byId = new Map<unknown, Match>();
  for (const m of list) if (!byId.has(m.match_id)) byId.set(m.match_id, m);
  const sign = dir === 'asc' ? 1 : -1;
  return Array.from(byId.values())
    .map(m => ({ m, t: startMs(m) }))
    .sort((a, b) => (a.t - b.t) * sign)
    .map(x => x.m);
}

/** Append a page, skipping matches already listed (a page can overlap the previous one). */
function appendUnique(existing: Match[], page: Match[]): Match[] {
  const seen = new Set(existing.map(m => m.match_id));
  const fresh = page.filter(m => !seen.has(m.match_id));
  return fresh.length ? [...existing, ...fresh] : existing;
}

const sameMatches = (a: Match[], b: Match[]) => a.length === b.length && a.every((m, i) => m === b[i]);

function sameSegment(a: SegmentState, b: SegmentState): boolean {
  return (
    sameMatches(a.matches, b.matches) &&
    a.loading === b.loading &&
    a.refreshing === b.refreshing &&
    a.loadingMore === b.loadingMore &&
    a.error === b.error &&
    a.nextPageUrl === b.nextPageUrl &&
    a.loaded === b.loaded
  );
}

/**
 * Upcoming / live / past matches for Home. Same API calls, local-schedule merge,
 * dedupe and sort as the old per-tab screens. Each load makes one state update,
 * and an update that changes nothing (a refetch on focus, mostly) is dropped, so
 * Home doesn't re-render on every return from a match.
 */
export function useHomeMatches() {
  const [segments, setSegments] = useState<Record<HomeSegment, SegmentState>>({
    upcoming: initialSegment,
    live: initialSegment,
    past: initialSegment,
  });
  const [userRefreshing, setUserRefreshing] = useState(false);
  const lastRefresh = useRef(0);
  const inFlight = useRef<Record<HomeSegment, boolean>>({ upcoming: false, live: false, past: false });
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const patch = useCallback(
    (key: HomeSegment, p: Partial<SegmentState> | ((s: SegmentState) => Partial<SegmentState>)) => {
      setSegments(prev => {
        const next = { ...prev[key], ...(typeof p === 'function' ? p(prev[key]) : p) };
        return sameSegment(prev[key], next) ? prev : { ...prev, [key]: next };
      });
    },
    [],
  );

  const loadUnified = useCallback(
    async (key: 'upcoming' | 'live', pageUrl: string | null = null) => {
      if (inFlight.current[key]) return;
      inFlight.current[key] = true;
      if (pageUrl) patch(key, { loadingMore: true });
      else patch(key, s => (s.loaded ? {} : { loading: true }));

      try {
        if (pageUrl) {
          const result = await apiService.fetchMatchesFromUrl(pageUrl);
          const segmentMatches = result.matches.filter((match: Match) => match.status === key);
          patch(key, s => ({
            matches: appendUnique(s.matches, segmentMatches),
            nextPageUrl: result.page?.next || null,
            error: null,
            loaded: true,
            loadingMore: false,
          }));
          return;
        }

        const result: any = await apiService.getUpcomingAndLiveMatches(1, 60);
        if (!result.success || !result.data) throw new Error(result.error || `Failed to load ${key} matches`);
        const segmentMatches: Match[] = (key === 'upcoming' ? result.data.upcomingMatches : result.data.liveMatches) || [];
        // A locally scheduled match the API already lists goes by the API's status,
        // so it can't show as both "upcoming" (API) and "live" (local guess).
        const apiIds = new Set((result.data.allMatches || []).map((m: Match) => m.match_id));
        const localSegment = (await getLocalScheduledMatches()).filter(m => m.status === key && !apiIds.has(m.match_id));
        patch(key, {
          matches: uniqueSorted([...localSegment, ...segmentMatches], 'asc'),
          nextPageUrl: result.data.page?.next || null,
          error: null,
          loaded: true,
          loading: false,
          loadingMore: false,
        });
      } catch (err) {
        console.error(`Error loading ${key} matches:`, err);
        patch(key, { error: `Failed to load ${key} matches`, loaded: true, loading: false, loadingMore: false });
      } finally {
        inFlight.current[key] = false;
      }
    },
    [patch],
  );

  const loadPast = useCallback(
    async (pageUrl: string | null = null) => {
      if (inFlight.current.past) return;
      inFlight.current.past = true;
      if (pageUrl) patch('past', { loadingMore: true });
      else patch('past', s => (s.loaded ? {} : { loading: true }));

      try {
        let pageNo = '1';
        if (pageUrl) {
          try {
            const url = new URL(pageUrl);
            pageNo = url.searchParams.get('pageno') || '1';
          } catch {
            const numericPageUrl = parseInt(pageUrl);
            if (!isNaN(numericPageUrl)) {
              pageNo = pageUrl;
            } else {
              const pageMatch = pageUrl.match(/pageno=(\d+)/);
              pageNo = pageMatch ? pageMatch[1] : '1';
            }
          }
        }
        const response = await apiService.getPlayerPastMatches(parseInt(pageNo), 12);
        const { matches: pastMatches, page } = response;
        const nextPageUrl = page?.next || null;

        if (!pageUrl) {
          const localPastMatches = (await getLocalScheduledMatches()).filter(m => m.status === 'past');
          patch('past', {
            matches: uniqueSorted([...localPastMatches, ...pastMatches], 'desc'),
            nextPageUrl,
            error: null,
            loaded: true,
            loading: false,
            loadingMore: false,
          });
        } else {
          patch('past', s => ({
            matches: appendUnique(s.matches, pastMatches),
            nextPageUrl,
            error: null,
            loaded: true,
            loadingMore: false,
          }));
        }
      } catch {
        patch('past', { error: 'Failed to load past matches', loaded: true, loading: false, loadingMore: false });
      } finally {
        inFlight.current.past = false;
      }
    },
    [patch],
  );

  /**
   * Reload all segments. Upcoming then live run in sequence so live reuses the
   * shared 30s matches cache (one network call); past runs alongside.
   */
  const refreshAll = useCallback(
    async (userInitiated = false) => {
      const stale = Date.now() - lastRefresh.current > FOCUS_REFRESH_MS;
      if (!userInitiated && !stale) {
        // Still fresh: just re-merge locally scheduled matches via a cached reload.
        await Promise.all([loadUnified('upcoming'), loadUnified('live')]);
        return;
      }
      lastRefresh.current = Date.now();
      if (userInitiated) setUserRefreshing(true);
      apiService.clearUpcomingLiveCache();
      const past = loadPast(null);
      await loadUnified('upcoming');
      await loadUnified('live');
      await past;
      setUserRefreshing(false);
    },
    [loadUnified, loadPast],
  );

  const loadMore = useCallback(
    (key: HomeSegment) => {
      const s = segmentsRef.current[key];
      if (!s.nextPageUrl || s.loadingMore || inFlight.current[key]) return;
      if (key === 'past') loadPast(s.nextPageUrl);
      else loadUnified(key, s.nextPageUrl);
    },
    [loadPast, loadUnified],
  );

  const allMatches = useMemo(() => {
    const all = [...segments.live.matches, ...segments.upcoming.matches, ...segments.past.matches];
    return Array.from(new Map(all.map(m => [m.match_id, m])).values());
  }, [segments.live.matches, segments.upcoming.matches, segments.past.matches]);

  const liveMatch = segments.live.matches[0] ?? null;

  const nextMatch = useCallback(
    (now: Date): Match | null => {
      const t = now.getTime();
      let best: Match | null = null;
      let bestTime = Infinity;
      for (const m of segments.upcoming.matches) {
        const start = getMatchStart(m)?.getTime();
        if (start !== undefined && start > t && start < bestTime) {
          best = m;
          bestTime = start;
        }
      }
      return best;
    },
    [segments.upcoming.matches],
  );

  const initialLoading = !segments.upcoming.loaded && !segments.live.loaded;

  return { segments, refreshAll, loadMore, allMatches, liveMatch, nextMatch, userRefreshing, initialLoading };
}
