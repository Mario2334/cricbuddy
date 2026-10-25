import { detectMatchStatus, MAX_LIVE_MS } from '../matchStatus';
import type { ScorecardData } from '../types';

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

const inning = (over: Partial<Record<string, unknown>> = {}) => ({
  teamName: 'Dev-Sena',
  inning: { total_run: 120, total_wicket: 4, overs_played: '15.2', total_overs: 20, ...over },
});

const card = (pageProps: Record<string, unknown>): ScorecardData => ({ pageProps });

describe('detectMatchStatus', () => {
  it('trusts the API status first', () => {
    expect(detectMatchStatus(card({ matchInfo: { status: 'live' }, scorecard: [inning()] }), { now: NOW })).toBe('live');
    expect(detectMatchStatus(card({ matchInfo: { status: 'past' }, scorecard: [inning()] }), { now: NOW })).toBe('past');
    expect(detectMatchStatus(card({ matchInfo: { status: 'Resulted' } }), { now: NOW })).toBe('past');
  });

  it('treats a result as finished even when the chase ended before the last over', () => {
    const sc = card({ matchInfo: { matchResult: 'Dev-Sena won by 6 wickets' }, scorecard: [inning({ total_wicket: 6, overs_played: '20.0' }), inning()] });
    expect(detectMatchStatus(sc, { now: NOW })).toBe('past');
  });

  it('trusts a "past" list status', () => {
    expect(detectMatchStatus(card({ scorecard: [inning()] }), { listStatus: 'past', now: NOW })).toBe('past');
  });

  it('never calls a match live long after it started', () => {
    const start = new Date(NOW - MAX_LIVE_MS - 60_000);
    expect(detectMatchStatus(card({ scorecard: [inning()] }), { start, now: NOW })).toBe('past');
  });

  it('falls back to the innings for a recent match', () => {
    const start = new Date(NOW - 2 * 60 * 60 * 1000);
    expect(detectMatchStatus(card({ scorecard: [inning()] }), { start, now: NOW })).toBe('live');
    expect(detectMatchStatus(card({ scorecard: [inning({ total_wicket: 10 }), inning({ overs_played: '20.0' })] }), { start, now: NOW })).toBe('past');
  });

  it('is upcoming with no innings and no status', () => {
    expect(detectMatchStatus(card({ scorecard: [] }), { now: NOW })).toBe('upcoming');
    expect(detectMatchStatus(null, { now: NOW })).toBe('upcoming');
  });
});
