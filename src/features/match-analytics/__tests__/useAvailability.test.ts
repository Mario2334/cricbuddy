import { AnalyticsApiClient } from '../services/analyticsApiClient';
import type { AvailabilityResponse, RosterPlayer } from '../types';
import { nextStatus, useAvailability } from '../hooks/useAvailability';
import { actOn, flush, renderHook } from './renderHook';

const player = (id: number, name: string): RosterPlayer => ({
  player_id: id, name, photo: null, hand: null, skill_hint: null, role: 'batter', confidence: 'high', can_keep: false, part_time_bowler: false, in_roster: true, override: 'auto', last_played: null, agg: null,
});
const response = (entries: AvailabilityResponse['entries'], yes = 0): AvailabilityResponse => ({
  match: { match_id: 7, status: 'upcoming', start: null, overs: 20, ball_type: null, match_type: null, tournament: null, our_team_id: 1, our_team: 'Dev-Sena', opponent_team_id: 2, opponent_name: 'Opp', ground_id: null, ground_name: null, city: null },
  players: [player(1, 'A'), player(2, 'B'), player(3, 'C')],
  entries,
  gaps: { yes, maybe: 0, no: 0, counts: { batters: yes, bowlers: 0, allrounders: 0, keepers: 0 }, bowling_options: 0, overs: 20, max_overs_per_bowler: 4, issues: [] },
});

describe('useAvailability', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('cycles statuses', () => {
    expect(nextStatus('unknown')).toBe('yes');
    expect(nextStatus('yes')).toBe('maybe');
    expect(nextStatus('maybe')).toBe('no');
    expect(nextStatus('no')).toBe('unknown');
  });

  it('loads, edits optimistically and saves one debounced PUT', async () => {
    const client = { getAvailability: jest.fn().mockResolvedValue(response([])), putAvailability: jest.fn().mockResolvedValue(response([{ player_id: 1, status: 'yes', note: '', updated_at: null }, { player_id: 2, status: 'maybe', note: '', updated_at: null }], 1)) } as unknown as AnalyticsApiClient;
    const onSaved = jest.fn();
    const { result } = renderHook(() => useAvailability('7', { client, onSaved, debounceMs: 400 }));
    expect(result.current.loading).toBe(true);
    await flush();
    expect(result.current.loading).toBe(false);
    expect(result.current.players).toHaveLength(3);
    expect(result.current.known).toBe(false);

    await flush();
    await actOn(() => result.current.cycleStatus(1)); // unknown → yes
    await actOn(() => result.current.cycleStatus(2)); // unknown → yes
    await actOn(() => result.current.cycleStatus(2)); // yes → maybe
    expect(result.current.entries.get(1)).toBe('yes');
    expect(result.current.entries.get(2)).toBe('maybe');
    expect(result.current.counts).toEqual({ yes: 1, maybe: 1, no: 0, unknown: 1 });
    expect(client.putAvailability).not.toHaveBeenCalled();

    await flush(400);
    expect(client.putAvailability).toHaveBeenCalledTimes(1);
    expect(client.putAvailability).toHaveBeenCalledWith('7', [{ player_id: 1, status: 'yes' }, { player_id: 2, status: 'maybe' }], false);
    await flush();
    expect(result.current.gaps?.yes).toBe(1);
    expect(result.current.known).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('reloads with all=1 when asked for every member', async () => {
    const client = { getAvailability: jest.fn().mockResolvedValue(response([])), putAvailability: jest.fn() } as unknown as AnalyticsApiClient;
    const { result } = renderHook(() => useAvailability('7', { client }));
    await flush();
    await actOn(() => result.current.toggleShowAll());
    await flush();
    expect(client.getAvailability).toHaveBeenLastCalledWith('7', true);
    expect(result.current.showAll).toBe(true);
  });
});
