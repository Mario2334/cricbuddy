import fc from 'fast-check';
import {
  badgeParts,
  combineDateAndTime,
  countdownParts,
  dayRange,
  formatFullDate,
  formatLocalDateTimeInput,
  formatShortDate,
  formatTime,
  fromDateKey,
  greeting,
  monthGrid,
  msUntilNextMidnight,
  parseLocalDateTimeInput,
  parseLooseDate,
  parseTimeAgo,
  relativeDayLabel,
  startedAgoLabel,
  statusDateLabel,
  toDate,
  toDateKey,
} from '../dates';

// Sunday 25 October 2026, 10:00 local.
const NOW = new Date(2026, 9, 25, 10, 0, 0);

describe('greeting', () => {
  it.each([
    [4, 59, 'Good night'],
    [5, 0, 'Good morning'],
    [11, 59, 'Good morning'],
    [12, 0, 'Good afternoon'],
    [16, 59, 'Good afternoon'],
    [17, 0, 'Good evening'],
    [20, 59, 'Good evening'],
    [21, 0, 'Good night'],
  ])('%i:%i -> %s', (h, m, expected) => {
    expect(greeting(new Date(2026, 9, 25, h, m)).text).toBe(expected);
  });
});

describe('formatting', () => {
  it('formats the full date for the Today hero', () => {
    expect(formatFullDate(NOW)).toBe('Sunday, 25 October 2026');
  });

  it('formats short dates, adding the year only when it differs', () => {
    expect(formatShortDate(new Date(2026, 9, 24), NOW)).toBe('Sat 24 Oct');
    expect(formatShortDate(new Date(2025, 11, 31), NOW)).toBe('Wed 31 Dec 2025');
  });

  it('formats times in 12h', () => {
    expect(formatTime(new Date(2026, 9, 26, 7, 0))).toBe('7:00 AM');
    expect(formatTime(new Date(2026, 9, 26, 18, 30))).toBe('6:30 PM');
  });

  it('builds tear-off badge parts', () => {
    expect(badgeParts(new Date(2026, 9, 26))).toEqual({ weekday: 'MON', day: '26', month: 'OCT' });
  });
});

describe('relativeDayLabel', () => {
  it.each([
    [new Date(2026, 9, 25, 23, 0), 'Today'],
    [new Date(2026, 9, 26, 7, 0), 'Tomorrow'],
    [new Date(2026, 9, 24, 7, 0), 'Yesterday'],
    [new Date(2026, 9, 28), 'In 3 days'],
    [new Date(2026, 9, 23), '2 days ago'],
    [new Date(2026, 10, 15), 'In 3 weeks'],
    [new Date(2026, 7, 25), '2 months ago'],
  ])('%s -> %s', (d, expected) => {
    expect(relativeDayLabel(d, NOW)).toBe(expected);
  });

  it('uses calendar days, not 24h windows', () => {
    const lateNight = new Date(2026, 9, 25, 23, 30);
    expect(relativeDayLabel(new Date(2026, 9, 26, 0, 15), lateNight)).toBe('Tomorrow');
  });
});

describe('startedAgoLabel', () => {
  it.each([
    [0, 'just started'],
    [25, 'started 25m ago'],
    [60, 'started 1h ago'],
    [95, 'started 1h 35m ago'],
  ])('%i minutes -> %s', (mins, expected) => {
    expect(startedAgoLabel(new Date(NOW.getTime() - mins * 60_000), NOW)).toBe(expected);
  });
});

describe('statusDateLabel', () => {
  it('labels upcoming matches by proximity', () => {
    expect(statusDateLabel('upcoming', new Date(2026, 9, 26, 7, 0), NOW).text).toBe('Upcoming · Tomorrow 7:00 AM');
    expect(statusDateLabel('upcoming', new Date(2026, 9, 25, 18, 30), NOW).detail).toBe('Today 6:30 PM');
    expect(statusDateLabel('upcoming', new Date(2026, 9, 29, 7, 0), NOW).detail).toBe('Thu 7:00 AM');
    expect(statusDateLabel('upcoming', new Date(2026, 10, 14, 7, 0), NOW).detail).toBe('Sat 14 Nov, 7:00 AM');
  });

  it('labels live and finished matches', () => {
    expect(statusDateLabel('live', new Date(2026, 9, 25, 9, 0), NOW).text).toBe('LIVE · started 1h ago');
    expect(statusDateLabel('past', new Date(2026, 9, 24, 7, 0), NOW).text).toBe('Done · Sat 24 Oct');
  });

  it('handles missing start times', () => {
    expect(statusDateLabel('upcoming', null, NOW).detail).toBe('Date TBD');
    expect(statusDateLabel('live', null, NOW).detail).toBe('now');
  });
});

describe('countdownParts', () => {
  it('splits the remaining time', () => {
    const target = new Date(NOW.getTime() + ((26 * 60 + 3) * 60 + 4) * 1000);
    expect(countdownParts(target, NOW)).toMatchObject({ days: 1, hours: 2, minutes: 3, seconds: 4, isPast: false });
  });

  it('clamps past targets to zero', () => {
    expect(countdownParts(new Date(NOW.getTime() - 1000), NOW)).toMatchObject({ days: 0, seconds: 0, isPast: true });
  });
});

describe('dayRange and monthGrid', () => {
  it('builds a range centred on the given day', () => {
    const days = dayRange(NOW, 3, 3);
    expect(days).toHaveLength(7);
    expect(toDateKey(days[3])).toBe('2026-10-25');
    expect(days[0].getHours()).toBe(0);
  });

  it('builds a Monday-first 6 week grid', () => {
    const cells = monthGrid(new Date(2026, 9, 1));
    expect(cells).toHaveLength(42);
    expect(cells[0].key).toBe('2026-09-28');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[3].key).toBe('2026-10-01');
    expect(cells[3].inMonth).toBe(true);
  });
});

describe('local date-time input', () => {
  it('round-trips in local time (fixes the old UTC prefill bug)', () => {
    const d = new Date(2026, 9, 26, 7, 0);
    const s = formatLocalDateTimeInput(d);
    expect(s).toBe('2026-10-26 07:00');
    const parsed = parseLocalDateTimeInput(s);
    expect(parsed?.getHours()).toBe(7);
    expect(parsed?.getDate()).toBe(26);
  });

  it('rejects invalid input', () => {
    expect(parseLocalDateTimeInput('2026-02-30 07:00')).toBeNull();
    expect(parseLocalDateTimeInput('bad')).toBeNull();
    expect(parseLocalDateTimeInput('')).toBeNull();
  });

  it('combines a day and a time', () => {
    const d = combineDateAndTime(new Date(2026, 9, 27, 15, 45), 7, 30);
    expect(formatLocalDateTimeInput(d)).toBe('2026-10-27 07:30');
  });
});

describe('toDate', () => {
  it('parses the formats the APIs send', () => {
    expect(toDate('2026-10-25T04:30:00Z')?.toISOString()).toBe('2026-10-25T04:30:00.000Z');
    expect(toDate('2026-10-26 07:00:00')?.getHours()).toBe(7);
    expect(toDate(1793000000)?.getTime()).toBe(1793000000 * 1000);
    expect(toDate(1793000000000)?.getTime()).toBe(1793000000000);
    expect(toDate('')).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('not a date')).toBeNull();
  });

  it('round-trips date keys', () => {
    expect(toDateKey(fromDateKey('2026-10-25')!)).toBe('2026-10-25');
  });
});

describe('msUntilNextMidnight', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 25, 23, 59, 30))).toBe(30_000);
  });
});

describe('parseTimeAgo', () => {
  it.each([
    ['Just now', 0],
    ['5 mins ago', 5],
    ['1 min ago', 1],
    ['2 hours ago', 120],
    ['an hour ago', 60],
    ['3 days ago', 3 * 1440],
    ['a week ago', 7 * 1440],
  ])('%s', (label, minutesAgo) => {
    const d = parseTimeAgo(label, NOW);
    expect(d).not.toBeNull();
    expect(Math.round((NOW.getTime() - d!.getTime()) / 60_000)).toBe(minutesAgo);
  });

  it('returns null for unknown text', () => {
    expect(parseTimeAgo('someday', NOW)).toBeNull();
    expect(parseTimeAgo(undefined, NOW)).toBeNull();
  });

  it('never throws', () => {
    fc.assert(fc.property(fc.string(), s => {
      parseTimeAgo(s, NOW);
      return true;
    }));
  });
});

describe('parseLooseDate', () => {
  it('parses common API formats and rejects junk', () => {
    expect(toDateKey(parseLooseDate('2026-10-31')!)).toBe('2026-10-31');
    expect(toDateKey(parseLooseDate('31/10/2026')!)).toBe('2026-10-31');
    expect(toDateKey(parseLooseDate('31 Oct 2026')!)).toBe('2026-10-31');
    expect(toDateKey(parseLooseDate('Sat, 31 Oct 2026')!)).toBe('2026-10-31');
    expect(parseLooseDate('Sat, 31 Oct 2026 7:30 AM')?.getHours()).toBe(7);
    expect(parseLooseDate('Every weekend')).toBeNull();
    expect(parseLooseDate(undefined)).toBeNull();
  });
});
