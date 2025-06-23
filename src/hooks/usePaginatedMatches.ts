import { useState, useCallback } from 'react';
import type { Match } from '../types/Match';
import apiService from '../services/apiService';
import { normalizeApiError } from '../utils/normalizeApiError';

interface UsePaginatedMatchesResult {
  matches: Match[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  nextPageUrl: string | null;
  previousPageUrl: string | null;
  hasInitiallyLoaded: boolean;
  loadMatches: (pageUrl?: string | null, isRefresh?: boolean) => Promise<void>;
  loadMoreMatches: () => void;
  onRefresh: () => void;
}

export function usePaginatedMatches(
  fetchMatchesFn: (pageUrl?: string | null) => Promise<any>,
  extractMatches: (response: any) => Match[]
): UsePaginatedMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [previousPageUrl, setPreviousPageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);

  const loadMatches = useCallback(async (pageUrl: string | null = null, isRefresh = false) => {
    if (isRequestInProgress && !isRefresh) return;
    setIsRequestInProgress(true);
    setError(null);
    if (!pageUrl || isRefresh) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = await fetchMatchesFn(pageUrl);
      setMatches(extractMatches(response));
      setNextPageUrl(response.page?.next || null);
      setPreviousPageUrl(response.page?.previous || null);
      setHasInitiallyLoaded(true);
    } catch (error) {
      setError(normalizeApiError(error));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setIsRequestInProgress(false);
    }
  }, [fetchMatchesFn, extractMatches, isRequestInProgress]);

  const onRefresh = useCallback(() => {
    if (isRequestInProgress) return;
    setRefreshing(true);
    loadMatches(null, true);
  }, [isRequestInProgress, loadMatches]);

  const loadMoreMatches = useCallback(() => {
    if (!loadingMore && nextPageUrl && !isRequestInProgress) {
      loadMatches(nextPageUrl);
    }
  }, [loadingMore, nextPageUrl, isRequestInProgress, loadMatches]);

  return {
    matches,
    loading,
    refreshing,
    error,
    nextPageUrl,
    previousPageUrl,
    hasInitiallyLoaded,
    loadMatches,
    loadMoreMatches,
    onRefresh,
  };
}
