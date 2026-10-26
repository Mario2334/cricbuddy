import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStableCallback } from '../../../hooks/useStableCallback';
import { AnalyticsApiClient, AnalyticsError, analyticsApiClient } from '../services/analyticsApiClient';
import type { AvailabilityResponse, AvailabilityStatus, MatchCtx, RosterPlayer, SquadGaps } from '../types';

export const AVAILABILITY_CYCLE: AvailabilityStatus[] = ['unknown', 'yes', 'maybe', 'no'];

/** unknown → yes → maybe → no → unknown */
export const nextStatus = (s: AvailabilityStatus): AvailabilityStatus => AVAILABILITY_CYCLE[(AVAILABILITY_CYCLE.indexOf(s) + 1) % AVAILABILITY_CYCLE.length];

export interface AvailabilityCounts {
  yes: number;
  maybe: number;
  no: number;
  unknown: number;
}

export function countStatuses(players: RosterPlayer[], entries: Map<number, AvailabilityStatus>): AvailabilityCounts {
  const counts: AvailabilityCounts = { yes: 0, maybe: 0, no: 0, unknown: 0 };
  for (const p of players) counts[entries.get(p.player_id) ?? 'unknown'] += 1;
  return counts;
}

export interface UseAvailabilityOptions {
  client?: AnalyticsApiClient;
  /** Called after a save lands, with the server's view (the analysis hook uses it to refresh `stale`). */
  onSaved?: (res: AvailabilityResponse) => void;
  debounceMs?: number;
}

export interface UseAvailabilityResult {
  match: MatchCtx | null;
  players: RosterPlayer[];
  entries: Map<number, AvailabilityStatus>;
  gaps: SquadGaps | null;
  counts: AvailabilityCounts;
  /** True once anyone has a yes/maybe/no. */
  known: boolean;
  loading: boolean;
  saving: boolean;
  error: AnalyticsError | null;
  showAll: boolean;
  setStatus: (playerId: number, status: AvailabilityStatus) => void;
  cycleStatus: (playerId: number) => void;
  toggleShowAll: () => void;
  reload: () => Promise<void>;
}

const toMap = (res: AvailabilityResponse): Map<number, AvailabilityStatus> => new Map(res.entries.map(e => [e.player_id, e.status]));

/**
 * Roster + availability for one match. Edits are optimistic and saved in one PUT after a short pause,
 * so tapping through a dozen players costs one request.
 */
export function useAvailability(matchId: string, opts: UseAvailabilityOptions = {}): UseAvailabilityResult {
  const client = opts.client ?? analyticsApiClient;
  const debounceMs = opts.debounceMs ?? 400;
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [entries, setEntries] = useState<Map<number, AvailabilityStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AnalyticsError | null>(null);
  const [showAll, setShowAll] = useState(false);
  const dirty = useRef(new Map<number, AvailabilityStatus>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const onSaved = useRef(opts.onSaved);
  onSaved.current = opts.onSaved;

  const applyResponse = useCallback((res: AvailabilityResponse) => {
    setData(res);
    setEntries(() => {
      const next = toMap(res);
      for (const [id, s] of dirty.current) next.set(id, s); // keep edits made while the request was in flight
      return next;
    });
  }, []);

  const load = useStableCallback(async (all: boolean) => {
    try {
      const res = await client.getAvailability(matchId, all);
      if (!mounted.current) return;
      applyResponse(res);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof AnalyticsError ? e : new AnalyticsError('server', (e as Error).message));
    } finally {
      if (mounted.current) setLoading(false);
    }
  });

  const flush = useStableCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current.size) return;
    const batch = [...dirty.current.entries()].map(([player_id, status]) => ({ player_id, status }));
    dirty.current = new Map();
    setSaving(true);
    try {
      const res = await client.putAvailability(matchId, batch, showAll);
      if (!mounted.current) return;
      applyResponse(res);
      setError(null);
      onSaved.current?.(res);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof AnalyticsError ? e : new AnalyticsError('server', (e as Error).message));
    } finally {
      if (mounted.current) setSaving(false);
    }
  });

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void load(showAll);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current.size) {
        // Leaving the screen with unsaved taps: send them, nobody is listening for the answer.
        const batch = [...dirty.current.entries()].map(([player_id, status]) => ({ player_id, status }));
        dirty.current = new Map();
        client.putAvailability(matchId, batch).catch(() => undefined);
      }
    };
    // Runs once per match: `load` is stable and reads the latest `showAll` on its own.
  }, [matchId]);

  const setStatus = useStableCallback((playerId: number, status: AvailabilityStatus) => {
    setEntries(prev => {
      const next = new Map(prev);
      next.set(playerId, status);
      return next;
    });
    dirty.current.set(playerId, status);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), debounceMs);
  });

  const cycleStatus = useStableCallback((playerId: number) => setStatus(playerId, nextStatus(entries.get(playerId) ?? 'unknown')));

  const toggleShowAll = useStableCallback(() => {
    const next = !showAll;
    setShowAll(next);
    void load(next);
  });

  const reload = useStableCallback(() => load(showAll));

  const players = data?.players ?? [];
  const counts = useMemo(() => countStatuses(players, entries), [players, entries]);
  const known = useMemo(() => [...entries.values()].some(s => s !== 'unknown'), [entries]);

  return {
    match: data?.match ?? null,
    players,
    entries,
    gaps: data?.gaps ?? null,
    counts,
    known,
    loading,
    saving,
    error,
    showAll,
    setStatus,
    cycleStatus,
    toggleShowAll,
    reload,
  };
}
