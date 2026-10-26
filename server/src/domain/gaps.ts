import type { AvailabilityStatus, GapIssue, RosterPlayer, SquadGaps } from '../types';

export const GAP_RULES = {
  XI: 11,
  /** A limited-overs attack: overs are split across at least this many bowlers. */
  BOWLERS_PER_INNINGS: 5,
  /** More specialist batters than this among the confirmed is a surplus. */
  MAX_PURE_BATTERS: 6,
  /** Opened the batting at least this often to count as a regular opener. */
  OPENER_MIN: 2,
};

export const maxOversPerBowler = (overs: number): number => Math.max(1, Math.ceil(overs / GAP_RULES.BOWLERS_PER_INNINGS));
export const bowlersNeeded = (overs: number): number => Math.max(1, Math.ceil(overs / maxOversPerBowler(overs)));

const isBowlingOption = (p: RosterPlayer): boolean => p.role === 'bowler' || p.role === 'all-rounder';
const isKeeper = (p: RosterPlayer): boolean => p.role === 'wicket-keeper' || p.can_keep;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Deterministic squad-gap check over the roster and the match's availability. */
export function analyzeGaps(players: RosterPlayer[], availability: Map<number, AvailabilityStatus>, overs: number): SquadGaps {
  const status = (p: RosterPlayer): AvailabilityStatus => availability.get(p.player_id) ?? 'unknown';
  const yes = players.filter(p => status(p) === 'yes');
  const maybe = players.filter(p => status(p) === 'maybe');
  const no = players.filter(p => status(p) === 'no');
  const maxPer = maxOversPerBowler(overs);
  const need = bowlersNeeded(overs);
  const options = yes.filter(isBowlingOption).length;
  const optionsWithMaybe = options + maybe.filter(isBowlingOption).length;
  const partTimers = yes.filter(p => p.part_time_bowler && !isBowlingOption(p)).length;
  const pureBatters = yes.filter(p => p.role === 'batter').length;
  const keepersYes = yes.filter(isKeeper);
  const keepersMaybe = maybe.filter(isKeeper);
  const issues: GapIssue[] = [];

  if (yes.length + maybe.length < GAP_RULES.XI) {
    issues.push({
      code: 'SHORT_OF_11',
      severity: 'high',
      message: `Only ${yes.length} confirmed${maybe.length ? ` and ${maybe.length} maybe` : ''}: need ${GAP_RULES.XI - yes.length - maybe.length} more ${GAP_RULES.XI - yes.length - maybe.length === 1 ? 'player' : 'players'} for an XI`,
    });
  } else if (yes.length < GAP_RULES.XI) {
    issues.push({
      code: 'RELIES_ON_MAYBE',
      severity: 'medium',
      message: `Only ${yes.length} confirmed: the XI needs ${GAP_RULES.XI - yes.length} of the ${plural(maybe.length, 'maybe')}`,
    });
  }

  if (!keepersYes.length) {
    issues.push(
      keepersMaybe.length
        ? { code: 'NO_KEEPER', severity: 'medium', message: `No confirmed wicket-keeper: ${keepersMaybe.map(p => p.name).join(', ')} ${keepersMaybe.length === 1 ? 'is' : 'are'} a maybe` }
        : { code: 'NO_KEEPER', severity: 'high', message: 'No wicket-keeper available' },
    );
  }

  if (options < need) {
    const short = need - options;
    const extra = partTimers ? ` (${plural(partTimers, 'part-timer')} could fill in)` : '';
    issues.push({
      code: 'FEW_BOWLERS',
      severity: optionsWithMaybe < need ? 'high' : 'medium',
      message: `Need ${plural(short, 'more bowling option')}: ${options} among the confirmed for ${overs} overs at ${maxPer} each${extra}`,
    });
  }

  if (yes.length >= GAP_RULES.XI && pureBatters > GAP_RULES.MAX_PURE_BATTERS && options < need) {
    issues.push({
      code: 'TOO_MANY_BATTERS',
      severity: 'medium',
      message: `${pureBatters} specialist batters confirmed but only ${plural(options, 'bowling option')}: ${pureBatters - GAP_RULES.MAX_PURE_BATTERS} will miss out or must bowl`,
    });
  }

  if (yes.length && !yes.some(p => (p.agg?.batting.opened ?? 0) >= GAP_RULES.OPENER_MIN)) {
    issues.push({ code: 'NO_OPENERS', severity: 'low', message: 'No regular opener among the confirmed players' });
  }

  return {
    yes: yes.length,
    maybe: maybe.length,
    no: no.length,
    counts: {
      batters: pureBatters,
      bowlers: yes.filter(p => p.role === 'bowler').length,
      allrounders: yes.filter(p => p.role === 'all-rounder').length,
      keepers: keepersYes.length,
    },
    bowling_options: options,
    overs,
    max_overs_per_bowler: maxPer,
    issues,
  };
}

/** Stable hash of the yes/maybe/no entries, stored with a report to detect "availability changed". */
export function availabilityHash(availability: Map<number, AvailabilityStatus>): string {
  const parts = [...availability.entries()]
    .filter(([, s]) => s !== 'unknown')
    .map(([id, s]) => `${id}:${s}`)
    .sort();
  // djb2 is enough: this only answers "did anything change".
  let h = 5381;
  for (const ch of parts.join('|')) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `${parts.length}-${h.toString(16)}`;
}
