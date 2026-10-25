import type { IconTone } from '../../theme';
import type { IconName } from '../../ui/icons';

export interface StatItem {
  value: string | number;
  title: string;
}

export type StatKind = 'batting' | 'bowling' | 'fielding' | 'captain';

export interface StatsData {
  batting?: StatItem[];
  bowling?: StatItem[];
  fielding?: StatItem[];
  captain?: StatItem[];
}

export interface StatIconSpec {
  icon: IconName;
  tone: IconTone;
}

// Ordered: the first matching rule wins, so specific phrases ("highest runs",
// "run outs", "no balls") sit above the generic words they contain.
export const ICON_RULES: ReadonlyArray<readonly [RegExp, IconName, IconTone]> = [
  [/highest|\bhs\b/, 'star', 'amber'],
  [/\bbest\b|\bbbi?\b/, 'trophy', 'amber'],
  [/strike|\bsr\b/, 'lightning', 'amber'],
  [/econ/, 'chartDown', 'sky'],
  [/aver|\bavg\b/, 'chart', 'teal'],
  [/no\s*-?\s*balls?\b|\bnb\b/, 'noBall', 'rose'],
  [/not\s*outs?|^no$/, 'shield', 'teal'],
  [/run\s*-?\s*outs?/, 'runOut', 'violet'],
  [/stump/, 'stumping', 'violet'],
  [/catch|caught/, 'gloves', 'emerald'],
  [/duck/, 'duck', 'slate'],
  [/hat\s*-?\s*tricks?/, 'hatTrick', 'violet'],
  [/\b[345]\s*w(kts?|ickets?|i)?\b|haul/, 'fire', 'rose'],
  [/\b200s?\b|double/, 'rocket', 'violet'],
  [/\b100s?\b|hundred|centur/, 'century', 'amber'],
  [/\b50s?\b|fift/, 'medal', 'amber'],
  [/\b30s?\b|thirt/, 'fire', 'amber'],
  [/\b6s\b|\bsix/, 'rocket', 'emerald'],
  [/\b4s\b|\bfour/, 'lightning', 'teal'],
  [/maiden/, 'maiden', 'sky'],
  [/wicket|\bwkts?\b/, 'target', 'rose'],
  [/\bdots?\b/, 'dots', 'slate'],
  [/wide/, 'wide', 'sky'],
  [/over/, 'autoRefresh', 'sky'],
  [/ball/, 'ball', 'rose'],
  [/toss/, 'toss', 'amber'],
  [/no\s*result|abandon|\btie|draw/, 'hands', 'teal'],
  [/\bwin|\bwon\b|victor/, 'crown', 'amber'],
  [/\blos[st]|defeat/, 'loss', 'slate'],
  [/inning/, 'innings', 'teal'],
  [/match/, 'stadium', 'emerald'],
  [/run/, 'bat', 'emerald'],
];

export const KIND_FALLBACK: Record<StatKind, StatIconSpec> = {
  batting: { icon: 'bat', tone: 'emerald' },
  bowling: { icon: 'ball', tone: 'rose' },
  fielding: { icon: 'gloves', tone: 'teal' },
  captain: { icon: 'crown', tone: 'amber' },
};

const DEFAULT_ICON: StatIconSpec = { icon: 'sparkle', tone: 'emerald' };

/** Icon + tone for a stat tile, picked from keywords in the API's stat title. */
export function statIcon(title: string, kind?: StatKind): StatIconSpec {
  const t = (title || '').trim().toLowerCase();
  for (const [re, icon, tone] of ICON_RULES) {
    if (re.test(t)) return { icon, tone };
  }
  return kind ? KIND_FALLBACK[kind] : DEFAULT_ICON;
}

/** Personal bests get a one-off wiggle and a highlight star. */
export function isHighlightStat(title: string): boolean {
  return /highest|\bhs\b|\bbest\b|\bbbi?\b/.test((title || '').toLowerCase());
}

export const KIND_EMPTY: Record<StatKind, { icon: IconName; tone: IconTone; title: string; message: string }> = {
  batting: {
    icon: 'bat',
    tone: 'emerald',
    title: 'No batting stats yet',
    message: 'Pad up and face a few balls. Your runs will land here.',
  },
  bowling: {
    icon: 'target',
    tone: 'rose',
    title: 'No bowling stats yet',
    message: 'Roll your arm over in a match to start the tally.',
  },
  fielding: {
    icon: 'gloves',
    tone: 'teal',
    title: 'No fielding stats yet',
    message: 'Hold on to a screamer and it shows up here.',
  },
  captain: {
    icon: 'crown',
    tone: 'amber',
    title: 'No captaincy stats yet',
    message: 'Lead a side and your record as skipper appears here.',
  },
};
