import type { Match } from '../../types/Match';
import {
  buildMarkedDates,
  buildMatchDetailParams,
  normalizeStatus,
  teamColor,
  teamInitials,
} from '../matchDisplay';

const match = (overrides: Partial<Match>): Match => ({
  match_id: 1,
  status: 'upcoming',
  match_start_time: '2026-10-26T01:30:00.000Z',
  team_a: 'Vikings Inspired',
  team_b: 'Titans',
  tournament_name: 'Sunday League',
  ground_name: 'HSR Ground',
  ground_id: 7,
  ...overrides,
} as Match);

describe('normalizeStatus', () => {
  it.each([
    ['live', 'live'],
    ['LIVE', 'live'],
    ['upcoming', 'upcoming'],
    ['past', 'past'],
    ['completed', 'past'],
    ['', 'unknown'],
    [undefined, 'unknown'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeStatus(input as string | undefined)).toBe(expected);
  });
});

describe('teamInitials and teamColor', () => {
  it('makes initials', () => {
    expect(teamInitials('Vikings Inspired')).toBe('VI');
    expect(teamInitials('Titans')).toBe('TI');
    expect(teamInitials('Dev-Sena')).toBe('DS');
    expect(teamInitials('')).toBe('?');
  });

  it('picks a stable colour per name', () => {
    expect(teamColor('Titans')).toEqual(teamColor('titans'));
  });
});

describe('buildMarkedDates', () => {
  it('groups matches by local day', () => {
    const marked = buildMarkedDates([
      match({ match_id: 1, match_start_time: '2026-10-26T01:30:00.000Z' }),
      match({ match_id: 2, match_start_time: '2026-10-26T10:30:00.000Z', status: 'live' }),
      match({ match_id: 3, match_start_time: '' }),
    ]);
    expect(marked['2026-10-26']).toEqual({ count: 2, statuses: ['upcoming', 'live'] });
    expect(Object.keys(marked)).toHaveLength(1);
  });
});

describe('buildMatchDetailParams', () => {
  it('mirrors the params Home and My Team always passed', () => {
    expect(buildMatchDetailParams(match({ status: 'past' }))).toEqual({
      matchId: '1',
      tournamentName: 'Sunday League',
      teamNames: { team1: 'Vikings Inspired', team2: 'Titans' },
      groundName: 'HSR Ground',
      groundId: 7,
      city: undefined,
      matchStartTime: '2026-10-26T01:30:00.000Z',
      defaultTab: 'scorecard',
    });
    expect(buildMatchDetailParams(match({}))?.defaultTab).toBe('info');
  });

  it('accepts the Calendar overrides', () => {
    const params = buildMatchDetailParams(match({ status: 'past', city_name: 'Bengaluru' }), {
      city: 'Bengaluru',
      defaultTab: 'info',
    });
    expect(params?.city).toBe('Bengaluru');
    expect(params?.defaultTab).toBe('info');
  });

  it('returns null without an id', () => {
    expect(buildMatchDetailParams(match({ match_id: 0, id: undefined }))).toBeNull();
  });
});
