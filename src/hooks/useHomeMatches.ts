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

/**
 * Upcoming / live / past matches for Home. The three loaders are the ones the
 * old per-tab screens used (same API calls, local-schedule merge, dedupe and
 * sort); they now live together so Home can show all of them at once.
 */
export function useHomeMatches() {
  const [segments, setSegments] = useState<Record<HomeSegment, SegmentState>>({
    upcoming: initialSegment,
    live: initialSegment,
    past: initialSegment,
  });
  const [userRefreshing, setUserRefreshing] = useState(false);
  const lastRefresh = useRef(0);

  const patch = useCallback(
    (key: HomeSegment, p: Partial<SegmentState> | ((s: SegmentState) => Partial<SegmentState>)) => {
      setSegments(prev => ({ ...prev, [key]: { ...prev[key], ...(typeof p === 'function' ? p(prev[key]) : p) } }));
    },
    [],
  );

  const loadUnified = useCallback(
    async (key: 'upcoming' | 'live', pageUrl: string | null = null, isRefresh = false) => {
      if (isRefresh) {
        patch(key, s => (s.loaded ? { refreshing: true } : { loading: true }));
      } else if (pageUrl) {
        patch(key, { loadingMore: true });
      } else {
        patch(key, { loading: true });
      }

      try {
        let segmentMatches: Match[] = [];
        let nextPageUrl: string | null = null;

        if (pageUrl) {
          const result = await apiService.fetchMatchesFromUrl(pageUrl);
          segmentMatches = result.matches.filter((match: Match) => match.status === key);
          nextPageUrl = result.page?.next || null;
        } else {
          const result = key === 'upcoming' ? await apiService.getUpcomingMatches(1, 60) : await apiService.getLiveMatches(1, 60);
          if (result.success && result.data) {
            segmentMatches = result.data.matches || [];
            nextPageUrl = result.data.page?.next || null;
          } else {
            throw new Error(result.error || `Failed to load ${key} matches`);
          }
        }

        if (isRefresh || !pageUrl) {
          const localMatches = await getLocalScheduledMatches();
          const localSegment = localMatches.filter(m => m.status === key);
          const allMatches = [...localSegment, ...segmentMatches];
          const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.match_id, item])).values());
          uniqueMatches.sort((a, b) => new Date(a.match_start_time).getTime() - new Date(b.match_start_time).getTime());
          patch(key, { matches: uniqueMatches });
        } else {
          patch(key, s => ({ matches: [...s.matches, ...segmentMatches] }));
        }

        patch(key, { nextPageUrl, error: null, loaded: true });
      } catch (err) {
        console.error(`Error loading ${key} matches:`, err);
        patch(key, { error: `Failed to load ${key} matches`, loaded: true });
      } finally {
        patch(key, { loading: false, refreshing: false, loadingMore: false });
      }
    },
    [patch],
  );

  const loadPast = useCallback(
    async (pageUrl: string | null = null, isRefresh = false) => {
      if (isRefresh) {
        patch('past', s => (s.loaded ? { refreshing: true } : { loading: true }));
      } else if (pageUrl) {
        patch('past', { loadingMore: true });
      } else {
        patch('past', { loading: true });
      }

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

        if (isRefresh || !pageUrl) {
          const localMatches = await getLocalScheduledMatches();
          const localPastMatches = localMatches.filter(m => m.status === 'past');
          const allMatches = [...localPastMatches, ...pastMatches];
          const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.match_id, item])).values());
          uniqueMatches.sort((a, b) => new Date(b.match_start_time).getTime() - new Date(a.match_start_time).getTime());
          patch('past', { matches: uniqueMatches });
        } else {
          patch('past', s => ({ matches: [...s.matches, ...pastMatches] }));
        }

        patch('past', { nextPageUrl: page?.next || null, error: null, loaded: true });
      } catch {
        patch('past', { error: 'Failed to load past matches', loaded: true });
      } finally {
        patch('past', { loading: false, refreshing: false, loadingMore: false });
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
        await Promise.all([loadUnified('upcoming', null, true), loadUnified('live', null, true)]);
        return;
      }
      lastRefresh.current = Date.now();
      if (userInitiated) setUserRefreshing(true);
      apiService.clearUpcomingLiveCache();
      const past = loadPast(null, true);
      await loadUnified('upcoming', null, true);
      await loadUnified('live', null, true);
      await past;
      setUserRefreshing(false);
    },
    [loadUnified, loadPast],
  );

  const loadMore = useCallback(
    (key: HomeSegment) => {
      const s = segments[key];
      if (!s.nextPageUrl || s.loadingMore) return;
      if (key === 'past') loadPast(s.nextPageUrl);
      else loadUnified(key, s.nextPageUrl);
    },
    [segments, loadPast, loadUnified],
  );

  const allMatches = useMemo(() => {
    const all = [...segments.live.matches, ...segments.upcoming.matches, ...segments.past.matches];
    return Array.from(new Map(all.map(m => [m.match_id, m])).values());
  }, [segments]);

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
