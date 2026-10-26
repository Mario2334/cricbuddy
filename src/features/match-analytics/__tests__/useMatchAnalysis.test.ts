import { AnalyticsApiClient, AnalyticsError } from '../services/analyticsApiClient';
import type { AnalysisJob, AnalysisResponse } from '../types';
import { useMatchAnalysis } from '../hooks/useMatchAnalysis';
import { actOn, flush, renderHook } from './renderHook';

const job = (status: AnalysisJob['status'], id = 1): AnalysisJob => ({ id, match_id: 7, status, requested_at: '2026-10-26T10:00:00Z', started_at: null, finished_at: null, error: null, headline: null, facts: null });
const res = (j: AnalysisJob | null): AnalysisResponse => ({ job: j, report: null, stale: false });

describe('useMatchAnalysis', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('polls while a job is active and stops when it finishes', async () => {
    const getAnalysis = jest.fn().mockResolvedValueOnce(res(job('queued'))).mockResolvedValueOnce(res(job('thinking'))).mockResolvedValue(res(job('done')));
    const client = { getAnalysis, requestAnalysis: jest.fn() } as unknown as AnalyticsApiClient;
    const { result } = renderHook(() => useMatchAnalysis('7', { client, pollMs: 5000 }));
    await flush();
    expect(result.current.active).toBe(true);
    expect(getAnalysis).toHaveBeenCalledTimes(2); // mount + catch-up when polling starts
    await flush(5000);
    expect(getAnalysis).toHaveBeenCalledTimes(3);
    await flush();
    expect(result.current.job?.status).toBe('done');
    expect(result.current.active).toBe(false);
    await flush(20000);
    expect(getAnalysis).toHaveBeenCalledTimes(3);
  });

  it('requests a plan and starts polling', async () => {
    const getAnalysis = jest.fn().mockResolvedValueOnce(res(null)).mockResolvedValue(res(job('fetching', 2)));
    const requestAnalysis = jest.fn().mockResolvedValue({ outcome: 'queued', job: job('queued', 2) });
    const client = { getAnalysis, requestAnalysis } as unknown as AnalyticsApiClient;
    const { result } = renderHook(() => useMatchAnalysis('7', { client, hint: { team_a_id: 1, team_b_id: 2 } }));
    await flush();
    expect(result.current.job).toBeNull();
    await actOn(() => result.current.request());
    await flush();
    expect(requestAnalysis).toHaveBeenCalledWith('7', { team_a_id: 1, team_b_id: 2 });
    expect(result.current.active).toBe(true);
    expect(result.current.job?.id).toBe(2);
  });

  it('reports the daily cap', async () => {
    const client = { getAnalysis: jest.fn().mockResolvedValue(res(null)), requestAnalysis: jest.fn().mockRejectedValue(new AnalyticsError('cap', 'Daily limit', 429)) } as unknown as AnalyticsApiClient;
    const { result } = renderHook(() => useMatchAnalysis('7', { client }));
    await flush();
    await actOn(() => result.current.request());
    await flush();
    expect(result.current.capReached).toBe(true);
    expect(result.current.error?.kind).toBe('cap');
  });
});
