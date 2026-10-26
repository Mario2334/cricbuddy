import { agoLabel, elapsedLabel, formatOvers, formatRate, isActiveJob, resultLetter, severityTone, statusLabel } from '../utils/format';
import type { AnalysisJob } from '../types';

const job = (status: AnalysisJob['status']): AnalysisJob => ({ id: 1, match_id: 1, status, requested_at: null, started_at: null, finished_at: null, error: null, headline: null, facts: null });

describe('format helpers', () => {
  it('formats overs and rates', () => {
    expect(formatOvers(22)).toBe('3.4');
    expect(formatOvers(24)).toBe('4');
    expect(formatRate(6.638)).toBe('6.6');
    expect(formatRate(null)).toBe('–');
  });

  it('labels elapsed and relative time', () => {
    const now = new Date('2026-10-26T10:02:10Z');
    expect(elapsedLabel('2026-10-26T10:00:00Z', now)).toBe('2m 10s');
    expect(elapsedLabel('2026-10-26T10:02:05Z', now)).toBe('5s');
    expect(agoLabel('2026-10-26T10:01:50Z', now)).toBe('just now');
    expect(agoLabel('2026-10-26T09:50:00Z', now)).toBe('12 min ago');
    expect(agoLabel('2026-10-26T07:00:00Z', now)).toBe('3 h ago');
    expect(agoLabel('2026-10-25T07:00:00Z', now)).toBe('yesterday');
  });

  it('knows which jobs are active and how to describe them', () => {
    expect(isActiveJob(job('queued'))).toBe(true);
    expect(isActiveJob(job('thinking'))).toBe(true);
    expect(isActiveJob(job('done'))).toBe(false);
    expect(isActiveJob(null)).toBe(false);
    expect(statusLabel(job('fetching'))).toMatch(/last 5 matches/);
    expect(statusLabel(null)).toBe('No game plan yet');
    expect(resultLetter('won')).toBe('W');
    expect(severityTone('high')).toBe('coral');
  });
});
