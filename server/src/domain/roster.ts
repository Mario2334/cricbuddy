import type { RawTeamPlayer } from '../cricheroes/types';
import type { Confidence, PlayerAgg, Role, RosterOverride, RosterPlayer } from '../types';
import { cleanName, teamSide, type NormScorecard } from './scorecard';
import { istDate } from './stats';

/** Named thresholds for role derivation; tune here, the tests pin the table. */
export const ROLE_RULES = {
  /** Fewer appearances than this: trust CricHeroes' skill hint over the numbers. */
  LOW_SAMPLE: 3,
  /** Kept wicket in at least this share of appearances → wicket-keeper. */
  KEEPER_RATE: 0.5,
  /** Bowled in at least this share of appearances → bowler (if not a real batting option). */
  BOWLER_RATE: 0.6,
  /** Bowled in at least this share → all-rounder when also a batting option. */
  ALLROUNDER_RATE: 0.4,
  /** Bowls less often than this → pure batter. */
  BATTER_MAX_RATE: 0.25,
  /** Median batting position at or below this counts as lower order. */
  LOWER_ORDER_POS: 7,
  /** Balls faced per appearance below this → not a batting option. */
  FEW_BALLS: 8,
  /** Balls faced per appearance at or above this → a batting option even from the lower order. */
  SOME_BALLS: 10,
  /** Appearances at or above this make a derived role 'high' confidence. */
  HIGH_SAMPLE: 6,
};

export interface RoleCall {
  role: Role;
  confidence: Confidence;
  can_keep: boolean;
  part_time_bowler: boolean;
}

const hintRole = (skillHint: string | null): Role => {
  const h = (skillHint ?? '').toUpperCase();
  return h === 'BAT' ? 'batter' : h === 'BOWL' ? 'bowler' : h === 'ALL' ? 'all-rounder' : 'unknown';
};

export function deriveRole(agg: PlayerAgg | null, skillHint: string | null): RoleCall {
  const hint = hintRole(skillHint);
  if (!agg || agg.appearances === 0) return { role: hint, confidence: 'low', can_keep: false, part_time_bowler: false };

  const R = ROLE_RULES;
  const apps = agg.appearances;
  const canKeep = agg.kept >= 1;
  const keeperRate = agg.kept / apps;
  const ballsPerApp = agg.batting.balls / apps;
  const pos = agg.batting.usual_pos;
  const rate = agg.bowl_rate;
  const lowerOrder = pos !== null && pos >= R.LOWER_ORDER_POS;
  const batsEnough = !lowerOrder || ballsPerApp >= R.SOME_BALLS;

  if (apps < R.LOW_SAMPLE) {
    if (keeperRate >= R.KEEPER_RATE) return { role: 'wicket-keeper', confidence: 'low', can_keep: true, part_time_bowler: false };
    const seen: Role =
      rate >= R.BOWLER_RATE && ballsPerApp < R.FEW_BALLS ? 'bowler' : rate >= R.ALLROUNDER_RATE ? 'all-rounder' : agg.batting.inns > 0 ? 'batter' : 'unknown';
    return { role: hint !== 'unknown' ? hint : seen, confidence: 'low', can_keep: canKeep, part_time_bowler: rate > 0 && rate < R.ALLROUNDER_RATE };
  }

  const confidence: Confidence = apps >= R.HIGH_SAMPLE ? 'high' : 'medium';
  if (keeperRate >= R.KEEPER_RATE) return { role: 'wicket-keeper', confidence, can_keep: true, part_time_bowler: rate >= R.BATTER_MAX_RATE };
  if (rate >= R.BOWLER_RATE && (lowerOrder || ballsPerApp < R.FEW_BALLS)) return { role: 'bowler', confidence, can_keep: canKeep, part_time_bowler: false };
  if (rate >= R.ALLROUNDER_RATE && batsEnough) return { role: 'all-rounder', confidence, can_keep: canKeep, part_time_bowler: false };
  if (rate >= R.ALLROUNDER_RATE) return { role: 'bowler', confidence, can_keep: canKeep, part_time_bowler: false };
  if (rate < R.BATTER_MAX_RATE) return { role: 'batter', confidence, can_keep: canKeep, part_time_bowler: rate > 0 };
  return { role: 'batter', confidence, can_keep: canKeep, part_time_bowler: true };
}

/** Latest match date per player for `teamId`, from scorecards sorted newest first. */
export function lastPlayedMap(cards: NormScorecard[], teamId: number): Map<number, string> {
  const out = new Map<number, string>();
  for (const card of cards) {
    const side = teamSide(card, teamId);
    if (!side) continue;
    const date = istDate(card.start);
    for (const id of [...side.batting.map(b => b.player_id), ...side.bowling.map(b => b.player_id), ...side.to_be_bat.map(t => t.player_id)]) {
      if (id && !out.has(id)) out.set(id, date);
    }
  }
  return out;
}

export interface RosterInputs {
  members: RawTeamPlayer[];
  aggs: Map<number, PlayerAgg>;
  lastPlayed: Map<number, string>;
  overrides: Map<number, RosterOverride>;
  /** "Today", for the recency rule; defaults to now. */
  now?: Date;
}

/** Who counts as a squad member without a hand-made override. */
export const ROSTER_RULES = {
  /** Appeared at least this often in the window → regular. */
  MIN_APPEARANCES: 2,
  /** A single appearance still counts when it was within this many days. */
  RECENT_DAYS: 60,
};

const daysSince = (date: string | null, now: Date): number => (date ? (now.getTime() - Date.parse(date)) / 86_400_000 : Infinity);

export interface RosterEntry {
  player: RosterPlayer;
  hints: { role_hint: string; bowl_type_hint: string; batter_category: string; bowler_category: string; is_captain: boolean };
}

const inRoster = (override: RosterOverride, appearances: number, playedLast: boolean, lastPlayed: string | null, now: Date): boolean => {
  if (override === 'include') return true;
  if (override === 'exclude') return false;
  if (playedLast || appearances >= ROSTER_RULES.MIN_APPEARANCES) return true;
  return appearances > 0 && daysSince(lastPlayed, now) <= ROSTER_RULES.RECENT_DAYS;
};

/** Every team member plus any guest who appeared in the window, with derived roles and roster membership. */
export function buildRoster(inp: RosterInputs): RosterEntry[] {
  const out: RosterEntry[] = [];
  const seen = new Set<number>();
  const now = inp.now ?? new Date();
  for (const m of inp.members) {
    const id = Number(m.player_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const agg = inp.aggs.get(id) ?? null;
    const override = inp.overrides.get(id) ?? 'auto';
    const call = deriveRole(agg, m.player_skill ?? null);
    out.push({
      player: {
        player_id: id,
        name: cleanName(m.name) || agg?.name || `Player ${id}`,
        photo: m.profile_photo || null,
        hand: m.batting_hand || null,
        skill_hint: m.player_skill || null,
        role: call.role,
        confidence: call.confidence,
        can_keep: call.can_keep,
        part_time_bowler: call.part_time_bowler,
        in_roster: inRoster(override, agg?.appearances ?? 0, Number(m.is_played_last_match) === 1, inp.lastPlayed.get(id) ?? null, now),
        override,
        last_played: inp.lastPlayed.get(id) ?? null,
        agg,
      },
      hints: {
        role_hint: String(m.playing_role_id ?? ''),
        bowl_type_hint: String(m.bowling_type_id ?? ''),
        batter_category: m.batter_category ?? '',
        bowler_category: m.bowler_category ?? '',
        is_captain: Number(m.is_captain) === 1,
      },
    });
  }
  for (const [id, agg] of inp.aggs) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const override = inp.overrides.get(id) ?? 'auto';
    const call = deriveRole(agg, null);
    out.push({
      player: {
        player_id: id,
        name: agg.name || `Player ${id}`,
        photo: null,
        hand: null,
        skill_hint: null,
        role: call.role,
        confidence: call.confidence,
        can_keep: call.can_keep,
        part_time_bowler: call.part_time_bowler,
        in_roster: inRoster(override, agg.appearances, false, inp.lastPlayed.get(id) ?? null, now),
        override,
        last_played: inp.lastPlayed.get(id) ?? null,
        agg,
      },
      hints: { role_hint: '', bowl_type_hint: '', batter_category: '', bowler_category: '', is_captain: false },
    });
  }
  return out.sort((a, b) => a.player.name.localeCompare(b.player.name));
}
