import { isScorecardUrl, parseCricHeroesUrl } from '../parseCricHeroesUrl';

describe('parseCricHeroesUrl', () => {
  it('extracts the match id, tournament and teams', () => {
    expect(
      parseCricHeroesUrl('https://cricheroes.in/scorecard/18599605/Virat-Cup-T30-Edition-3/Vikings-Inspired-vs-AVENGERZ-XI'),
    ).toEqual({
      matchId: '18599605',
      tournamentName: 'Virat Cup T30 Edition 3',
      team1: 'Vikings Inspired',
      team2: 'AVENGERZ XI',
    });
  });

  it('accepts www and .com variants', () => {
    expect(parseCricHeroesUrl('https://www.cricheroes.com/scorecard/42/Cup/A-vs-B').matchId).toBe('42');
  });

  it('rejects other links', () => {
    expect(() => parseCricHeroesUrl('https://example.com/scorecard/1/a/b-vs-c')).toThrow('Invalid CricHeroes URL format');
    expect(() => parseCricHeroesUrl('https://cricheroes.in/scorecard/1/Cup/NoVersus')).toThrow('Could not parse team names');
    expect(isScorecardUrl('not a url')).toBe(false);
    expect(isScorecardUrl('  https://cricheroes.in/scorecard/1/Cup/A-vs-B  ')).toBe(true);
  });
});
