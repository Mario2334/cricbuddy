import type { Match } from '../../../types/Match';
import { resolveTeamIds } from '../utils/teamIds';

const OURS = 5179117;

describe('resolveTeamIds', () => {
  it('reads team_a_id/team_b_id from a My Team fixture', () => {
    const m = { team_a_id: 11573344, team_a: 'INDIRA BRIGADE', team_b_id: OURS, team_b: 'Dev-Sena' } as unknown as Match;
    expect(resolveTeamIds(m, null)).toEqual({ ours: OURS, opponent: 11573344, opponentName: 'INDIRA BRIGADE' });
  });

  it('falls back to the legacy team1/team2 shape from the Home list', () => {
    const m = { team1: { id: String(OURS), name: 'Dev-Sena' }, team2: { id: '4813849', name: 'Rising Suns' } } as unknown as Match;
    expect(resolveTeamIds(m, null)).toEqual({ ours: OURS, opponent: 4813849, opponentName: 'Rising Suns' });
  });

  it('reads the raw scorecard when the match object has no ids', () => {
    const sc = { pageProps: { matchData: { team_a: { id: OURS, name: 'Dev-Sena' }, team_b: { id: 9473036, name: 'KNCC' } } } };
    expect(resolveTeamIds({} as Match, sc)).toEqual({ ours: OURS, opponent: 9473036, opponentName: 'KNCC' });
  });

  it('reads the transformed innings as a last resort', () => {
    const sc = { pageProps: { scorecard: [{ teamName: 'KNCC', teamId: 9473036 }, { teamName: 'Dev-Sena', teamId: OURS }] } };
    expect(resolveTeamIds(null, sc)).toEqual({ ours: OURS, opponent: 9473036, opponentName: 'KNCC' });
  });

  it('returns null when Dev-Sena is not playing, and a null opponent when their id is 0', () => {
    expect(resolveTeamIds({ team_a_id: 1, team_a: 'A', team_b_id: 2, team_b: 'B' } as unknown as Match, null)).toBeNull();
    expect(resolveTeamIds({ team_a_id: OURS, team_a: 'Dev-Sena', team_b_id: 0, team_b: 'TBD' } as unknown as Match, null)).toEqual({ ours: OURS, opponent: null, opponentName: 'TBD' });
  });
});
