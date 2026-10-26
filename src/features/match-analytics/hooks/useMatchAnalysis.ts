import { useEffect, useRef, useState } from 'react';
import { useScreenActivity } from '../../../hooks/useScreenActivity';
import { useStableCallback } from '../../../hooks/useStableCallback';
import { AnalyticsApiClient, AnalyticsError, analyticsApiClient } from '../services/analyticsApiClient';
import type { AnalysisJob, AnalysisPostBody, AnalysisReport, AnalysisResponse } from '../types';
import { isActiveJob } from '../utils/format';

export interface UseMatchAnalysisOptions {
  client?: AnalyticsApiClient;
  /** How often to poll while a job is queued, fetching or thinking. */
  pollMs?: number;
  hint?: AnalysisPostBody['hint'];
}

export interface UseMatchAnalysisResult {
  job: AnalysisJob | null;
  report: AnalysisReport | null;
  stale: boolean;
  /** A job is queued or running. */
  active: boolean;
  loading: boolean;
  requesting: boolean;
  capReached: boolean;
  error: AnalyticsError | null;
  request: () => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Latest game-plan job and report for a match. Polls every `pollMs` while a job is active, and only while
 * this screen is focused and the app is in the foreground.
 */
export function useMatchAnalysis(matchId: string, opts: UseMatchAnalysisOptions = {}): UseMatchAnalysisResult {
  const client = opts.client ?? analyticsApiClient;
  const pollMs = opts.pollMs ?? 5000;
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const [error, setError] = useState<AnalyticsError | null>(null);
  const [screenActive, setScreenActive] = useState(true);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const hint = useRef(opts.hint);
  hint.current = opts.hint;

  useScreenActivity(setScreenActive);

  const load = useStableCallback(async (silent: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await client.getAnalysis(matchId);
      if (!mounted.current) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      // A blip while polling keeps the last good state on screen.
      if (!silent || !data) setError(e instanceof AnalyticsError ? e : new AnalyticsError('server', (e as Error).message));
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  });

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void load(false);
    return () => {
      mounted.current = false;
    };
    // Runs once per match: `load` is stable.
  }, [matchId]);

  const active = isActiveJob(data?.job);
  useEffect(() => {
    if (!screenActive || !active) return undefined;
    void load(true); // catch up at once when the screen comes back
    const id = setInterval(() => void load(true), pollMs);
    return () => clearInterval(id);
  }, [screenActive, active, data?.job?.id, pollMs, load]);

  const request = useStableCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    setError(null);
    try {
      const { job } = await client.requestAnalysis(matchId, hint.current);
      if (!mounted.current) return;
      setCapReached(false);
      setData(prev => ({ job, report: prev?.report ?? null, stale: prev?.stale ?? false }));
      void load(true);
    } catch (e) {
      if (!mounted.current) return;
      const err = e instanceof AnalyticsError ? e : new AnalyticsError('server', (e as Error).message);
      if (err.kind === 'cap') setCapReached(true);
      setError(err);
    } finally {
      if (mounted.current) setRequesting(false);
    }
  });

  const reload = useStableCallback(() => load(false));

  return {
    job: data?.job ?? null,
    report: data?.report ?? null,
    stale: data?.stale ?? false,
    active,
    loading,
    requesting,
    capReached,
    error,
    request,
    reload,
  };
}
