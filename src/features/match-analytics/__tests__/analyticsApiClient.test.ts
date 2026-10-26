import { AnalyticsApiClient, AnalyticsError } from '../services/analyticsApiClient';
import { jsonResponse } from './renderHook';

const client = (fetchFn: jest.Mock, extra = {}) => new AnalyticsApiClient({ baseUrl: 'http://api.test/', fetchFn: fetchFn as unknown as typeof fetch, retries: 2, retryDelayMs: 0, ...extra });

describe('AnalyticsApiClient', () => {
  it('builds URLs and parses JSON', async () => {
    const f = jest.fn().mockResolvedValue(jsonResponse(200, { players: [], roster_count: 0, updated_at: null }));
    const res = await client(f).getPlayers(true);
    expect(res.roster_count).toBe(0);
    expect(f).toHaveBeenCalledWith('http://api.test/team/players?refresh=1', expect.objectContaining({ method: 'GET' }));
  });

  it('maps HTTP errors to kinds', async () => {
    const f = jest.fn().mockResolvedValue(jsonResponse(429, { error: 'Daily limit reached', code: 'daily_cap' }));
    await expect(client(f).requestAnalysis('1')).rejects.toMatchObject({ kind: 'cap', status: 429, message: 'Daily limit reached' });
    const g = jest.fn().mockResolvedValue(jsonResponse(409, { error: 'not upcoming' }));
    await expect(client(g).requestAnalysis('1')).rejects.toMatchObject({ kind: 'conflict' });
    const h = jest.fn().mockResolvedValue(jsonResponse(404, { error: 'nope' }));
    await expect(client(h).getAvailability('1')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('turns a network failure into an unreachable error and retries GETs', async () => {
    const f = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValue(jsonResponse(200, { job: null, report: null, stale: false }));
    const res = await client(f).getAnalysis('7');
    expect(res.stale).toBe(false);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retries with a Tailscale hint', async () => {
    const f = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const err = await client(f).getAnalysis('7').catch(e => e);
    expect(err).toBeInstanceOf(AnalyticsError);
    expect(err.kind).toBe('unreachable');
    expect(err.message).toMatch(/Tailscale/);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('never retries writes', async () => {
    const f = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(client(f).putAvailability('7', [{ player_id: 1, status: 'yes' }])).rejects.toMatchObject({ kind: 'unreachable' });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ entries: [{ player_id: 1, status: 'yes' }] }) });
  });

  it('distinguishes a freshly queued job from an already active one', async () => {
    const job = { id: 1, match_id: 7, status: 'queued' };
    expect((await client(jest.fn().mockResolvedValue(jsonResponse(202, { job }))).requestAnalysis('7')).outcome).toBe('queued');
    expect((await client(jest.fn().mockResolvedValue(jsonResponse(200, { job }))).requestAnalysis('7')).outcome).toBe('active');
  });
});
