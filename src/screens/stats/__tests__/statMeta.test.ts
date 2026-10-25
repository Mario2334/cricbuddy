import { ICON_RULES, isHighlightStat, KIND_EMPTY, KIND_FALLBACK, statIcon } from '../statMeta';

describe('statIcon', () => {
  it('lets specific phrases win over the generic words they contain', () => {
    expect(statIcon('Highest Runs', 'batting')).toEqual({ icon: 'star', tone: 'amber' });
    expect(statIcon('Run Outs', 'fielding')).toEqual({ icon: 'runOut', tone: 'violet' });
    expect(statIcon('No Balls', 'bowling')).toEqual({ icon: 'noBall', tone: 'rose' });
    expect(statIcon('Not Out', 'batting')).toEqual({ icon: 'shield', tone: 'teal' });
    expect(statIcon('Best Bowling', 'bowling')).toEqual({ icon: 'trophy', tone: 'amber' });
  });

  it('maps generic stat words', () => {
    expect(statIcon('Runs', 'batting')).toEqual({ icon: 'bat', tone: 'emerald' });
    expect(statIcon('Strike Rate', 'batting').icon).toBe('lightning');
    expect(statIcon('Economy', 'bowling')).toEqual({ icon: 'chartDown', tone: 'sky' });
    expect(statIcon('Average', 'batting')).toEqual({ icon: 'chart', tone: 'teal' });
    expect(statIcon('Catches', 'fielding')).toEqual({ icon: 'gloves', tone: 'emerald' });
    expect(statIcon('Stumpings', 'fielding').icon).toBe('stumping');
    expect(statIcon('Ducks', 'batting').icon).toBe('duck');
    expect(statIcon('Hat-tricks', 'bowling').icon).toBe('hatTrick');
    expect(statIcon('3 Wickets', 'bowling')).toEqual({ icon: 'fire', tone: 'rose' });
    expect(statIcon('200s', 'batting').icon).toBe('rocket');
    expect(statIcon('100s', 'batting')).toEqual({ icon: 'century', tone: 'amber' });
    expect(statIcon('50s', 'batting')).toEqual({ icon: 'medal', tone: 'amber' });
    expect(statIcon('30s', 'batting')).toEqual({ icon: 'fire', tone: 'amber' });
    expect(statIcon('Maidens', 'bowling').icon).toBe('maiden');
    expect(statIcon('Wickets', 'bowling')).toEqual({ icon: 'target', tone: 'rose' });
    expect(statIcon('Dot Balls', 'bowling').icon).toBe('dots');
    expect(statIcon('Wides', 'bowling').icon).toBe('wide');
    expect(statIcon('Overs', 'bowling').icon).toBe('autoRefresh');
    expect(statIcon('Balls', 'bowling')).toEqual({ icon: 'ball', tone: 'rose' });
    expect(statIcon('Toss Won', 'captain').icon).toBe('toss');
    expect(statIcon('Tie', 'captain').icon).toBe('hands');
    expect(statIcon('Wins', 'captain')).toEqual({ icon: 'crown', tone: 'amber' });
    expect(statIcon('Lost', 'captain')).toEqual({ icon: 'loss', tone: 'slate' });
    expect(statIcon('Innings', 'batting').icon).toBe('innings');
    expect(statIcon('Matches', 'batting')).toEqual({ icon: 'stadium', tone: 'emerald' });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(statIcon('  HIGHEST runs ', 'batting').icon).toBe('star');
  });

  it('falls back to the tab kind when no rule matches', () => {
    expect(statIcon('Something else', 'batting')).toEqual(KIND_FALLBACK.batting);
    expect(statIcon('Something else', 'bowling')).toEqual({ icon: 'ball', tone: 'rose' });
    expect(statIcon('Something else', 'fielding')).toEqual({ icon: 'gloves', tone: 'teal' });
    expect(statIcon('Something else', 'captain')).toEqual({ icon: 'crown', tone: 'amber' });
  });

  it('has a default for an unknown title without a kind', () => {
    expect(statIcon('', undefined)).toEqual({ icon: 'sparkle', tone: 'emerald' });
  });

  it('keeps the rule list free of emoji', () => {
    for (const [, icon] of ICON_RULES) {
      expect(icon).toMatch(/^[a-zA-Z]+$/);
    }
  });
});

describe('isHighlightStat', () => {
  it('flags personal bests only', () => {
    expect(isHighlightStat('Highest Runs')).toBe(true);
    expect(isHighlightStat('Best Bowling')).toBe(true);
    expect(isHighlightStat('HS')).toBe(true);
    expect(isHighlightStat('Runs')).toBe(false);
    expect(isHighlightStat('')).toBe(false);
  });
});

describe('KIND_EMPTY', () => {
  it('uses icons for every kind', () => {
    expect(KIND_EMPTY.batting.icon).toBe('bat');
    expect(KIND_EMPTY.bowling.icon).toBe('target');
    expect(KIND_EMPTY.fielding.icon).toBe('gloves');
    expect(KIND_EMPTY.captain.icon).toBe('crown');
  });
});
