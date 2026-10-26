// Normalises a raw CricHeroes scorecard into a shape the stats code can trust.
// In the raw payload, team_X.scorecard[k].batting are team_X's batters and .bowling are the
// OPPOSITION's bowlers for that innings (the bowlers who bowled at team_X).
import type { RawBatting, RawBowling, RawInningsSummary, RawScorecard, RawScorecardTeam } from '../cricheroes/types';

export interface NormInnings {
  inning: number;
  runs: number;
  wkts: number;
  balls: number;
  extras: number;
  all_out: boolean;
}

export interface NormBat {
  player_id: number;
  name: string;
  inning: number;
  pos: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  how_out: string;
  wk_flag: boolean;
}

export interface NormBowl {
  player_id: number;
  name: string;
  inning: number;
  balls: number;
  runs: number;
  wkts: number;
  maidens: number;
  wides: number;
  noballs: number;
  dots: number;
}

export interface NormToBeBat {
  player_id: number;
  name: string;
  inning: number;
  implied_pos: number;
}

export interface NormTeam {
  id: number;
  name: string;
  captain_id: number | null;
  captain_name: string | null;
  keeper_id: number | null;
  keeper_name: string | null;
  batted_first: boolean | null;
  innings: NormInnings[];
  batting: NormBat[];
  /** This team's own bowlers (taken from the other side's scorecard entries). */
  bowling: NormBowl[];
  to_be_bat: NormToBeBat[];
}

export interface NormScorecard {
  match_id: number;
  status: string;
  start: string | null;
  ground_id: number | null;
  ground_name: string | null;
  city: string | null;
  overs: number;
  ball_type: string | null;
  match_type: string | null;
  tournament: string | null;
  toss: string | null;
  result_text: string | null;
  win_by: string | null;
  winning_team_name: string | null;
  winning_team_id: number | null;
  teams: [NormTeam, NormTeam];
}

export const n = (v: unknown, d = 0): number => {
  if (v === null || v === undefined || v === '') return d;
  const x = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(x) ? x : d;
};

/** "3.4" overs → 22 balls; 4 → 24. `extraBalls` handles payloads that split overs and balls. */
export function oversToBalls(overs: unknown, extraBalls: unknown = 0): number {
  const s = String(overs ?? '0').trim();
  const [whole, part] = s.split('.');
  const w = n(whole);
  const p = part !== undefined ? n(part) : 0;
  const split = part !== undefined && p > 0 ? p : n(extraBalls);
  return w * 6 + Math.min(split, 5);
}

export function ballsToOvers(balls: number): string {
  const b = Math.max(0, Math.floor(balls));
  return `${Math.floor(b / 6)}${b % 6 ? `.${b % 6}` : ''}`;
}

export const cleanName = (name: unknown): string =>
  String(name ?? '')
    .replace(/\((wk|c|c & wk|wk & c|c&wk)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const isOut = (howOut: string): boolean => {
  const s = howOut.trim().toLowerCase();
  if (!s) return false;
  return !(s === 'not out' || s.startsWith('not out') || s.includes('retired hurt') || s.includes('retired not out'));
};

function normInnings(list: RawInningsSummary[] | undefined): NormInnings[] {
  return (list ?? []).map(i => ({
    inning: n(i.inning, 1),
    runs: n(i.total_run),
    wkts: n(i.total_wicket),
    balls: oversToBalls(i.overs_played, i.balls_played && n(i.balls_played) < 6 ? i.balls_played : 0),
    extras: n(i.total_extra),
    all_out: n(i.is_allout) === 1,
  }));
}

function normBatting(team: RawScorecardTeam): NormBat[] {
  const out: NormBat[] = [];
  for (const entry of team.scorecard ?? []) {
    const inning = n(entry.inning, 1);
    (entry.batting ?? []).forEach((b: RawBatting, i) => {
      const howOut = String(b.how_to_out ?? '');
      out.push({
        player_id: n(b.player_id),
        name: cleanName(b.name),
        inning,
        pos: i + 1,
        runs: n(b.runs),
        balls: n(b.balls),
        fours: n(b['4s']),
        sixes: n(b['6s']),
        out: isOut(howOut),
        how_out: howOut,
        wk_flag: /\(wk\)|\(c & wk\)|\(wk & c\)|\(c&wk\)/i.test(String(b.name ?? '')),
      });
    });
  }
  return out;
}

/** Bowling entries listed under `against` are the bowlers of the other team. */
function normBowling(against: RawScorecardTeam): NormBowl[] {
  const out: NormBowl[] = [];
  for (const entry of against.scorecard ?? []) {
    const inning = n(entry.inning, 1);
    for (const b of entry.bowling ?? ([] as RawBowling[])) {
      out.push({
        player_id: n(b.player_id),
        name: cleanName(b.name),
        inning: n(b.inning, inning),
        balls: oversToBalls(b.overs, b.balls),
        runs: n(b.runs),
        wkts: n(b.wickets),
        maidens: n(b.maidens),
        wides: n(b.wide),
        noballs: n(b.noball),
        dots: n(b['0s']),
      });
    }
  }
  return out;
}

function normToBeBat(team: RawScorecardTeam): NormToBeBat[] {
  const out: NormToBeBat[] = [];
  for (const entry of team.scorecard ?? []) {
    const inning = n(entry.inning, 1);
    const batted = (entry.batting ?? []).length;
    (entry.to_be_bat ?? []).forEach((p, i) => out.push({ player_id: n(p.player_id), name: cleanName(p.name), inning, implied_pos: batted + i + 1 }));
  }
  return out;
}

function normTeam(team: RawScorecardTeam, other: RawScorecardTeam): NormTeam {
  const innings = normInnings(team.innings);
  const otherInnings = normInnings(other.innings);
  let battedFirst: boolean | null = null;
  if (innings.length && otherInnings.length) battedFirst = Math.min(...innings.map(i => i.inning)) < Math.min(...otherInnings.map(i => i.inning));
  else if (innings.length && !otherInnings.length) battedFirst = true;
  else if (!innings.length && otherInnings.length) battedFirst = false;
  return {
    id: n(team.id),
    name: cleanName(team.name),
    captain_id: team.captain_info?.player_id ? n(team.captain_info.player_id) : null,
    captain_name: team.captain_info?.player_name ? cleanName(team.captain_info.player_name) : null,
    keeper_id: team.wicket_keeper_info?.player_id ? n(team.wicket_keeper_info.player_id) : null,
    keeper_name: team.wicket_keeper_info?.player_name ? cleanName(team.wicket_keeper_info.player_name) : null,
    batted_first: battedFirst,
    innings,
    batting: normBatting(team),
    bowling: normBowling(other),
    to_be_bat: normToBeBat(team),
  };
}

export function normalizeScorecard(raw: RawScorecard): NormScorecard {
  const a = normTeam(raw.team_a, raw.team_b);
  const b = normTeam(raw.team_b, raw.team_a);
  // Toss text is the fallback for who batted first when innings are missing (an upcoming match).
  if (a.batted_first === null && raw.toss_details) {
    const t = raw.toss_details.toLowerCase();
    const aFirst = t.includes(a.name.toLowerCase()) && t.includes('bat');
    const bFirst = t.includes(b.name.toLowerCase()) && t.includes('bat');
    if (aFirst !== bFirst) {
      a.batted_first = aFirst;
      b.batted_first = bFirst;
    }
  }
  const winner = cleanName(raw.winning_team ?? '');
  const winnerId = winner ? (winner === a.name ? a.id : winner === b.name ? b.id : null) : null;
  return {
    match_id: n(raw.match_id),
    status: String(raw.status ?? ''),
    start: raw.start_datetime ?? null,
    ground_id: raw.ground_id ? n(raw.ground_id) : null,
    ground_name: raw.ground_name ?? null,
    city: raw.city_name ?? null,
    overs: n(raw.overs),
    ball_type: raw.ball_type ?? null,
    match_type: raw.match_type ?? null,
    tournament: raw.tournament_name ?? null,
    toss: raw.toss_details ?? null,
    result_text: raw.match_result ?? null,
    win_by: raw.win_by ?? null,
    winning_team_name: winner || null,
    winning_team_id: winnerId,
    teams: [a, b],
  };
}

export function teamSide(card: NormScorecard, teamId: number): NormTeam | null {
  return card.teams.find(t => t.id === teamId) ?? null;
}

export function otherSide(card: NormScorecard, teamId: number): NormTeam | null {
  return card.teams.find(t => t.id !== teamId) ?? null;
}
