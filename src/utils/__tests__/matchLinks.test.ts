import type { Match } from '../../types/Match';
import { buildCricHeroesMatchUrl, matchUrlFor } from '../matchLinks';
import { parseCricHeroesUrl } from '../../screens/calendar/parseCricHeroesUrl';

describe('buildCricHeroesMatchUrl', () => {
  it('builds the public scorecard URL with the WhatsApp message slugs', () => {
    expect(buildCricHeroesMatchUrl(12345, 'Sunday Smash League', { team1: 'Vikings Inspired', team2: 'Titans XI' })).toBe(
      'https://cricheroes.com/scorecard/12345/sunday-smash-league/vikings-inspired-vs-titans-xi',
    );
    expect(buildCricHeroesMatchUrl('7', 'Box  Cricket (Season 2.0)', { team1: 'A', team2: 'B' })).toBe(
      'https://cricheroes.com/scorecard/7/box-cricket-(season-2.0)/a-vs-b',
    );
  });

  it('falls back when names are missing', () => {
    expect(buildCricHeroesMatchUrl(9, undefined, { team1: '', team2: null })).toBe(
      'https://cricheroes.com/scorecard/9/match/team-1-vs-team-2',
    );
  });

  it('round-trips through the add-match link parser', () => {
    const url = buildCricHeroesMatchUrl(18599605, 'Virat Cup T30 Edition 3', { team1: 'Vikings Inspired', team2: 'AVENGERZ XI' });
    expect(parseCricHeroesUrl(url)).toEqual({
      matchId: '18599605',
      tournamentName: 'virat cup t30 edition 3',
      team1: 'vikings inspired',
      team2: 'avengerz xi',
    });
  });
});

describe('matchUrlFor', () => {
  const base = { match_id: 42, tournament_name: 'Night Cup', team_a: 'Dev-Sena', team_b: 'RAPTORS XI' } as Match;

  it('uses the card match fields', () => {
    expect(matchUrlFor(base)).toBe('https://cricheroes.com/scorecard/42/night-cup/dev-sena-vs-raptors-xi');
  });

  it('returns null without an id', () => {
    expect(matchUrlFor({ ...base, match_id: 0, id: undefined })).toBeNull();
  });
});
