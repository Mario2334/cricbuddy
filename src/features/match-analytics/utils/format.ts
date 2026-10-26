import type { AnalysisJob, MatchResult, Role, Severity } from '../types';

export function formatOvers(balls: number): string {
  const b = Math.max(0, Math.floor(balls));
  return `${Math.floor(b / 6)}${b % 6 ? `.${b % 6}` : ''}`;
}

export function formatRate(n: number | null | undefined, dp = 1): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toFixed(dp);
}

export function formatInt(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '–' : String(Math.round(n));
}

/** "2m 10s" between an ISO instant and now. */
export function elapsedLabel(fromIso: string | null | undefined, now: Date): string {
  if (!fromIso) return '';
  const secs = Math.max(0, Math.floor((now.getTime() - Date.parse(fromIso)) / 1000));
  if (!Number.isFinite(secs)) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 d ago". */
export function agoLabel(iso: string | null | undefined, now: Date): string {
  if (!iso) return '';
  const mins = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} d ago`;
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'batter':
      return 'Batter';
    case 'bowler':
      return 'Bowler';
    case 'all-rounder':
      return 'All-rounder';
    case 'wicket-keeper':
      return 'Keeper';
    default:
      return 'Role unknown';
  }
}

export function roleShort(role: Role): string {
  switch (role) {
    case 'batter':
      return 'BAT';
    case 'bowler':
      return 'BOWL';
    case 'all-rounder':
      return 'AR';
    case 'wicket-keeper':
      return 'WK';
    default:
      return '?';
  }
}

export const isActiveJob = (job: AnalysisJob | null | undefined): boolean =>
  !!job && (job.status === 'queued' || job.status === 'fetching' || job.status === 'thinking');

export function statusLabel(job: AnalysisJob | null): string {
  if (!job) return 'No game plan yet';
  switch (job.status) {
    case 'queued':
      return 'Queued…';
    case 'fetching':
      return 'Fetching the last 5 matches…';
    case 'thinking':
      return 'Thinking it through…';
    case 'done':
      return 'Plan ready';
    case 'failed':
      return 'Plan failed';
    default:
      return '';
  }
}

export type ChipTone = 'green' | 'yellow' | 'coral' | 'neutral';

export function severityTone(severity: Severity): ChipTone {
  return severity === 'high' ? 'coral' : severity === 'medium' ? 'yellow' : 'neutral';
}

export function resultLetter(result: MatchResult): string {
  return result === 'won' ? 'W' : result === 'lost' ? 'L' : result === 'tie' ? 'T' : 'NR';
}

export function resultTone(result: MatchResult): ChipTone {
  return result === 'won' ? 'green' : result === 'lost' ? 'coral' : 'neutral';
}

export function phaseLabel(phase: 'powerplay' | 'middle' | 'death'): string {
  return phase === 'powerplay' ? 'Powerplay' : phase === 'middle' ? 'Middle' : 'Death';
}
