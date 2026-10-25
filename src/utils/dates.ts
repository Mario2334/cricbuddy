import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isSameDay,
  isValid,
  parse,
  parseISO,
  set,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subHours,
  subMinutes,
  subMonths,
  subSeconds,
  subWeeks,
  subYears,
} from 'date-fns';

// Every date in the UI goes through this module so formatting is identical
// on every device (Hermes' Intl support varies) and always in local time.

export type MatchStatus = 'upcoming' | 'live' | 'past' | 'unknown';
export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

export const WEEK_STARTS_ON = 1 as const; // Monday

export type DateInput = Date | string | number | null | undefined;

/** Parse anything the APIs hand us into a valid Date, or null. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === 'number') {
    // Epoch seconds vs milliseconds.
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return isValid(d) ? d : null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return toDate(Number(trimmed));
  const iso = parseISO(trimmed);
  if (isValid(iso)) return iso;
  const fallback = new Date(trimmed);
  return isValid(fallback) ? fallback : null;
}

export function toDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function fromDateKey(key: string): Date | null {
  const d = parse(key, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function greeting(now: Date): { text: string; key: GreetingKey } {
  const h = now.getHours();
  if (h >= 5 && h < 12) return { text: 'Good morning', key: 'morning' };
  if (h >= 12 && h < 17) return { text: 'Good afternoon', key: 'afternoon' };
  if (h >= 17 && h < 21) return { text: 'Good evening', key: 'evening' };
  return { text: 'Good night', key: 'night' };
}

/** "Sunday, 25 October 2026" */
export function formatFullDate(d: Date): string {
  return format(d, 'EEEE, d MMMM yyyy');
}

/** "Sat 24 Oct", with the year appended when it differs from `now`. */
export function formatShortDate(d: Date, now: Date = new Date()): string {
  return d.getFullYear() === now.getFullYear() ? format(d, 'EEE d MMM') : format(d, 'EEE d MMM yyyy');
}

/** "7:00 AM" */
export function formatTime(d: Date): string {
  return format(d, 'h:mm a');
}

/** "October 2026" */
export function formatMonthYear(d: Date): string {
  return format(d, 'MMMM yyyy');
}

/** "Mon" */
export function formatWeekdayShort(d: Date): string {
  return format(d, 'EEE');
}

/** "Sunday" */
export function formatDayName(d: Date): string {
  return format(d, 'EEEE');
}

/** "25 October 2026" */
export function formatDayMonthYear(d: Date): string {
  return format(d, 'd MMMM yyyy');
}

/** Pieces for the tear-off calendar badge: MON / 27 / OCT. */
export function badgeParts(d: Date): { weekday: string; day: string; month: string } {
  return {
    weekday: format(d, 'EEE').toUpperCase(),
    day: format(d, 'd'),
    month: format(d, 'MMM').toUpperCase(),
  };
}

/** Today / Tomorrow / Yesterday / In 3 days / 2 days ago / In 3 weeks / 2 months ago. */
export function relativeDayLabel(d: Date, now: Date): string {
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const abs = Math.abs(diff);
  let amount: string;
  if (abs < 14) {
    amount = `${abs} days`;
  } else if (abs < 60) {
    const weeks = Math.round(abs / 7);
    amount = `${weeks} weeks`;
  } else if (abs < 365) {
    const months = Math.round(abs / 30);
    amount = months === 1 ? '1 month' : `${months} months`;
  } else {
    const years = Math.round(abs / 365);
    amount = years === 1 ? '1 year' : `${years} years`;
  }
  return diff > 0 ? `In ${amount}` : `${amount} ago`;
}

/** "just started" / "started 25m ago" / "started 1h ago" / "started 1h 35m ago" */
export function startedAgoLabel(start: Date, now: Date): string {
  const mins = Math.max(0, differenceInMinutes(now, start));
  if (mins < 1) return 'just started';
  if (mins < 60) return `started ${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `started ${h}h ago` : `started ${h}h ${m}m ago`;
}

export interface StatusDateLabel {
  status: MatchStatus;
  /** Short status word: Upcoming / LIVE / Done / Match */
  label: string;
  /** Date/time part: "Tomorrow 7:00 AM", "started 1h ago", "Sat 24 Oct" */
  detail: string;
  /** Full plain text for accessibility: "Upcoming · Tomorrow 7:00 AM" */
  text: string;
}

const STATUS_WORD: Record<MatchStatus, string> = {
  upcoming: 'Upcoming',
  live: 'LIVE',
  past: 'Done',
  unknown: 'Match',
};

export function upcomingWhenLabel(start: Date, now: Date): string {
  const diff = differenceInCalendarDays(start, now);
  const time = formatTime(start);
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff > 1 && diff < 7) return `${format(start, 'EEE')} ${time}`;
  return `${formatShortDate(start, now)}, ${time}`;
}

export function statusDateLabel(status: MatchStatus, start: Date | null, now: Date): StatusDateLabel {
  const label = STATUS_WORD[status];
  let detail: string;
  if (!start) {
    detail = status === 'live' ? 'now' : 'Date TBD';
  } else if (status === 'live') {
    detail = start.getTime() > now.getTime() ? 'now' : startedAgoLabel(start, now);
  } else if (status === 'past') {
    detail = formatShortDate(start, now);
  } else {
    detail = upcomingWhenLabel(start, now);
  }
  return { status, label, detail, text: `${label} · ${detail}` };
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isPast: boolean;
}

export function countdownParts(target: Date, now: Date): CountdownParts {
  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true };
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    isPast: false,
  };
}

/** Consecutive days around `center` (inclusive), each at local midnight. */
export function dayRange(center: Date, before: number, after: number): Date[] {
  const start = subDays(startOfDay(center), before);
  return Array.from({ length: before + after + 1 }, (_, i) => addDays(start, i));
}

export interface MonthCell {
  date: Date;
  key: string;
  inMonth: boolean;
}

/** 6 weeks x 7 days covering `month`, starting on `weekStartsOn`. */
export function monthGrid(month: Date, weekStartsOn: 0 | 1 = WEEK_STARTS_ON): MonthCell[] {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first, { weekStartsOn });
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, key: toDateKey(date), inMonth: date.getMonth() === first.getMonth() };
  });
}

export function weekdayLabels(weekStartsOn: 0 | 1 = WEEK_STARTS_ON): string[] {
  const start = startOfWeek(new Date(2026, 0, 5), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'EEEEE'));
}

/** Local "yyyy-MM-dd HH:mm" for text inputs. */
export function formatLocalDateTimeInput(d: Date): string {
  return format(d, 'yyyy-MM-dd HH:mm');
}

/** Strict local parse of "yyyy-MM-dd HH:mm"; `new Date(str)` is invalid on Hermes. */
export function parseLocalDateTimeInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/.test(trimmed)) return null;
  const d = parse(trimmed, 'yyyy-MM-dd H:mm', new Date());
  return isValid(d) && format(d, 'yyyy-MM-dd') === trimmed.slice(0, 10) ? d : null;
}

export function combineDateAndTime(day: Date, hours: number, minutes: number): Date {
  return set(startOfDay(day), { hours, minutes, seconds: 0, milliseconds: 0 });
}

export function shiftMinutes(d: Date, delta: number): Date {
  return addMinutes(d, delta);
}

export function msUntilNextMidnight(now: Date): number {
  return startOfDay(addDays(now, 1)).getTime() - now.getTime();
}

const TIME_AGO_UNITS: Record<string, (d: Date, n: number) => Date> = {
  sec: subSeconds,
  second: subSeconds,
  min: subMinutes,
  minute: subMinutes,
  hr: subHours,
  hour: subHours,
  day: subDays,
  week: subWeeks,
  month: subMonths,
  year: subYears,
};

/** Turn "5 mins ago", "an hour ago", "Just now" into a Date. Never throws. */
export function parseTimeAgo(label: string | undefined | null, now: Date): Date | null {
  if (typeof label !== 'string') return null;
  const text = label.trim().toLowerCase();
  if (!text) return null;
  if (text === 'just now' || text === 'now' || text === 'moments ago') return now;
  if (text === 'yesterday') return subDays(now, 1);
  const match = text.match(/^(\d+|a|an|one)\s*(sec|second|min|minute|hr|hour|day|week|month|year)s?\s*ago$/);
  if (!match) return null;
  const amount = /^\d+$/.test(match[1]) ? parseInt(match[1], 10) : 1;
  const fn = TIME_AGO_UNITS[match[2]];
  if (!fn || !Number.isFinite(amount)) return null;
  const d = fn(now, amount);
  return isValid(d) ? d : null;
}

const LOOSE_FORMATS = [
  'EEE, d MMM yyyy',
  'EEE, d MMM yyyy h:mm a',
  'EEE d MMM yyyy',
  'd MMM yyyy, h:mm a',
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'd MMM yyyy',
  'd MMMM yyyy',
  'd MMM yyyy h:mm a',
  'd MMM, yyyy',
  'MMM d, yyyy',
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
];

/** Best-effort parse of free-form API date strings. Returns null when unsure. */
export function parseLooseDate(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = parseISO(trimmed);
  if (isValid(iso)) return iso;
  for (const f of LOOSE_FORMATS) {
    const d = parse(trimmed, f, new Date());
    if (isValid(d)) return d;
  }
  return null;
}
