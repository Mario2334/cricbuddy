import type { RawTeamMatch } from '../cricheroes/types';
import type { BattingAgg, BowlingAgg, GroundFacts, GroundMatchLine, MatchLine, MatchResult, PlayerAgg, PosBucket } from '../types';
import { ballsToOvers, cleanName, n, otherSide, teamSide, type NormScorecard, type NormTeam } from './scorecard';

const round = (x: number, dp = 2): number => Math.round(x * 10 ** dp) / 10 ** dp;
const safeDiv = (a: number, b: number, dp = 2): number | null => (b > 0 ? round(a / b, dp) : null);

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function posBucket(pos: number | null): PosBucket | null {
  if (pos === null) return null;
  if (pos <= 3) return 'top';
  if (pos <= 7) return 'middle';
  return 'lower';
}

/** yyyy-mm-dd in IST for an ISO instant. */
export function istDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t + 19_800_000).toISOString().slice(0, 10);
}

export const byStartDesc = <T extends { start?: string | null; match_start_time?: string }>(a: T, b: T): number =>
  Date.parse(b.start ?? b.match_start_time ?? '') - Date.parse(a.start ?? a.match_start_time ?? '');

interface Acc {
  player_id: number;
  name: string;
  appearances: Set<number>;
  bat: { inns: number; runs: number; balls: number; outs: number; hs: number; fours: number; sixes: number; positions: number[]; implied: number[]; opened: number; recent: string[] };
  bowl: { inns: number; balls: number; runs: number; wkts: number; maidens: number; best: { wkts: number; runs: number } | null; recent: string[] };
  kept: Set<number>;
}

/** Per-player aggregates for `teamId` over the given scorecards (pass them newest first). */
export function aggregatePlayers(cards: NormScorecard[], teamId: number): Map<number, PlayerAgg> {
  const acc = new Map<number, Acc>();
  const get = (id: number, name: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = {
        player_id: id,
        name,
        appearances: new Set(),
        bat: { inns: 0, runs: 0, balls: 0, outs: 0, hs: 0, fours: 0, sixes: 0, positions: [], implied: [], opened: 0, recent: [] },
        bowl: { inns: 0, balls: 0, runs: 0, wkts: 0, maidens: 0, best: null, recent: [] },
        kept: new Set(),
      };
      acc.set(id, a);
    }
    if (!a.name && name) a.name = name;
    return a;
  };

  for (const card of cards) {
    const side = teamSide(card, teamId);
    if (!side) continue;
    for (const b of side.batting) {
      if (!b.player_id) continue;
      const a = get(b.player_id, b.name);
      a.appearances.add(card.match_id);
      a.bat.inns += 1;
      a.bat.runs += b.runs;
      a.bat.balls += b.balls;
      a.bat.fours += b.fours;
      a.bat.sixes += b.sixes;
      if (b.out) a.bat.outs += 1;
      a.bat.hs = Math.max(a.bat.hs, b.runs);
      a.bat.positions.push(b.pos);
      if (b.pos <= 2) a.bat.opened += 1;
      if (a.bat.recent.length < 5) a.bat.recent.push(`${b.runs}${b.out ? '' : '*'}(${b.balls})`);
      if (b.wk_flag) a.kept.add(card.match_id);
    }
    for (const t of side.to_be_bat) {
      if (!t.player_id) continue;
      const a = get(t.player_id, t.name);
      a.appearances.add(card.match_id);
      a.bat.implied.push(t.implied_pos);
    }
    for (const w of side.bowling) {
      if (!w.player_id) continue;
      const a = get(w.player_id, w.name);
      a.appearances.add(card.match_id);
      a.bowl.inns += 1;
      a.bowl.balls += w.balls;
      a.bowl.runs += w.runs;
      a.bowl.wkts += w.wkts;
      a.bowl.maidens += w.maidens;
      if (!a.bowl.best || w.wkts > a.bowl.best.wkts || (w.wkts === a.bowl.best.wkts && w.runs < a.bowl.best.runs)) a.bowl.best = { wkts: w.wkts, runs: w.runs };
      if (a.bowl.recent.length < 5) a.bowl.recent.push(`${w.wkts}/${w.runs} (${ballsToOvers(w.balls)})`);
    }
    if (side.keeper_id) {
      const name = side.keeper_name ?? '';
      const a = get(side.keeper_id, name);
      a.appearances.add(card.match_id);
      a.kept.add(card.match_id);
    }
  }

  const out = new Map<number, PlayerAgg>();
  for (const a of acc.values()) {
    const appearances = a.appearances.size;
    const usual = a.bat.positions.length >= 2 ? median(a.bat.positions) : median([...a.bat.positions, ...a.bat.implied]);
    const batting: BattingAgg = {
      inns: a.bat.inns,
      runs: a.bat.runs,
      balls: a.bat.balls,
      outs: a.bat.outs,
      hs: a.bat.hs,
      avg: a.bat.inns ? (a.bat.outs ? round(a.bat.runs / a.bat.outs) : null) : null,
      sr: a.bat.balls ? round((a.bat.runs / a.bat.balls) * 100, 1) : null,
      fours: a.bat.fours,
      sixes: a.bat.sixes,
      positions: a.bat.positions,
      usual_pos: usual === null ? null : round(usual, 1),
      pos_bucket: posBucket(usual),
      opened: a.bat.opened,
      recent: a.bat.recent,
    };
    const bowling: BowlingAgg = {
      inns: a.bowl.inns,
      balls: a.bowl.balls,
      runs: a.bowl.runs,
      wkts: a.bowl.wkts,
      maidens: a.bowl.maidens,
      econ: a.bowl.balls ? round(a.bowl.runs / (a.bowl.balls / 6)) : null,
      avg: safeDiv(a.bowl.runs, a.bowl.wkts),
      best: a.bowl.best ? `${a.bowl.best.wkts}/${a.bowl.best.runs}` : null,
      recent: a.bowl.recent,
    };
    out.set(a.player_id, {
      player_id: a.player_id,
      name: a.name,
      appearances,
      batting,
      bowling,
      kept: a.kept.size,
      bowl_rate: appearances ? round(a.bowl.inns / appearances) : 0,
    });
  }
  return out;
}

export function resultFor(m: RawTeamMatch, teamId: number): MatchResult {
  const text = String(m.match_result ?? '').toLowerCase();
  if (text.includes('tie')) return 'tie';
  if (text.includes('abandon') || text.includes('no result') || text.includes('cancel') || text.includes('walkover')) return 'nr';
  const w = n(m.winning_team_id);
  if (w && w === teamId) return 'won';
  if (w && w !== teamId) return 'lost';
  const name = cleanName(m.winning_team ?? '');
  if (name) {
    const ours = teamId === n(m.team_a_id) ? cleanName(m.team_a) : cleanName(m.team_b);
    return name === ours ? 'won' : 'lost';
  }
  return 'nr';
}

function inningsSummary(summary: string | null | undefined, innings: RawTeamMatch['team_a_innings']): string {
  if (summary && summary.trim()) return summary.trim();
  const first = innings?.[0];
  if (!first) return '';
  return `${n(first.total_run)}/${n(first.total_wicket)} (${first.overs_played ?? '?'} ov)`;
}

/** One past fixture seen from `teamId`'s side. */
export function matchLine(m: RawTeamMatch, teamId: number): MatchLine {
  const weAreA = n(m.team_a_id) === teamId;
  const ourInnings = weAreA ? m.team_a_innings : m.team_b_innings;
  const theirInnings = weAreA ? m.team_b_innings : m.team_a_innings;
  let battedFirst: boolean | null = null;
  const ourFirst = ourInnings?.[0] ? n(ourInnings[0].inning, 0) : 0;
  const theirFirst = theirInnings?.[0] ? n(theirInnings[0].inning, 0) : 0;
  if (ourFirst && theirFirst) battedFirst = ourFirst < theirFirst;
  else if (m.toss_details) {
    const t = m.toss_details.toLowerCase();
    const ours = cleanName(weAreA ? m.team_a : m.team_b).toLowerCase();
    if (t.includes(ours)) battedFirst = t.includes('bat');
    else battedFirst = !t.includes('bat');
  }
  return {
    match_id: n(m.match_id),
    date: istDate(m.match_start_time),
    opponent: cleanName(weAreA ? m.team_b : m.team_a),
    result: resultFor(m, teamId),
    batted_first: battedFirst,
    our_score: inningsSummary(weAreA ? m.team_a_summary : m.team_b_summary, ourInnings),
    their_score: inningsSummary(weAreA ? m.team_b_summary : m.team_a_summary, theirInnings),
    margin: String(m.win_by ?? '').trim(),
    ground: String(m.ground_name ?? '').trim(),
  };
}

export const pastOnly = (fixtures: RawTeamMatch[]): RawTeamMatch[] =>
  fixtures.filter(m => m.status === 'past').sort(byStartDesc);

export function headToHead(fixtures: RawTeamMatch[], teamId: number, oppId: number, limit = 5): MatchLine[] {
  return pastOnly(fixtures)
    .filter(m => (n(m.team_a_id) === teamId && n(m.team_b_id) === oppId) || (n(m.team_b_id) === teamId && n(m.team_a_id) === oppId))
    .slice(0, limit)
    .map(m => matchLine(m, teamId));
}

/** Scores and results for `teamId` across its scorecards (newest first). */
export function teamAggregates(cards: NormScorecard[], teamId: number): { avg_bat_first: number | null; avg_chasing: number | null; wins_bat_first: number; wins_chasing: number; avg_wkts_lost: number | null } {
  const first: number[] = [];
  const chase: number[] = [];
  const wkts: number[] = [];
  let winsFirst = 0;
  let winsChase = 0;
  for (const c of cards) {
    const side = teamSide(c, teamId);
    const inn = side?.innings[0];
    if (!side || !inn) continue;
    wkts.push(inn.wkts);
    const won = c.winning_team_id === teamId;
    if (side.batted_first === true) {
      first.push(inn.runs);
      if (won) winsFirst += 1;
    } else if (side.batted_first === false) {
      chase.push(inn.runs);
      if (won) winsChase += 1;
    }
  }
  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((s, x) => s + x, 0) / xs.length, 0) : null);
  return { avg_bat_first: avg(first), avg_chasing: avg(chase), wins_bat_first: winsFirst, wins_chasing: winsChase, avg_wkts_lost: wkts.length ? round(wkts.reduce((s, x) => s + x, 0) / wkts.length, 1) : null };
}

const scoreText = (t: NormTeam | null): string => {
  const inn = t?.innings[0];
  return inn ? `${inn.runs}/${inn.wkts} (${ballsToOvers(inn.balls)} ov)` : '';
};

/** Ground history from scorecards played there (newest first) plus our fixtures at the ground. */
export function groundSummary(cards: NormScorecard[], ourFixturesAtGround: RawTeamMatch[], ourTeamId: number): GroundFacts {
  const firstInns: number[] = [];
  const secondInns: number[] = [];
  const firstWkts: number[] = [];
  let batFirstWins = 0;
  let chaseWins = 0;
  const matches: GroundMatchLine[] = cards.map(c => {
    const [a, b] = c.teams;
    const firstSide = a.batted_first === true ? a : b.batted_first === true ? b : null;
    const secondSide = firstSide ? (firstSide === a ? b : a) : null;
    const f = firstSide?.innings[0];
    const s = secondSide?.innings[0];
    if (f) {
      firstInns.push(f.runs);
      firstWkts.push(f.wkts);
    }
    if (s) secondInns.push(s.runs);
    let chased: boolean | null = null;
    if (c.winning_team_id && firstSide && secondSide) {
      chased = c.winning_team_id === secondSide.id;
      if (chased) chaseWins += 1;
      else batFirstWins += 1;
    }
    return {
      match_id: c.match_id,
      date: istDate(c.start),
      team_a: firstSide?.name ?? a.name,
      team_b: secondSide?.name ?? b.name,
      first_inns: scoreText(firstSide ?? a),
      second_inns: scoreText(secondSide ?? b),
      winner: c.winning_team_name,
      chased,
    };
  });
  const avg = (xs: number[], dp = 0) => (xs.length ? round(xs.reduce((s, x) => s + x, 0) / xs.length, dp) : null);
  const ours = pastOnly(ourFixturesAtGround);
  const won = ours.filter(m => resultFor(m, ourTeamId) === 'won').length;
  const lost = ours.filter(m => resultFor(m, ourTeamId) === 'lost').length;
  return {
    sample: cards.length,
    matches,
    aggregates: {
      avg_first_inns: avg(firstInns),
      avg_second_inns: avg(secondInns),
      bat_first_wins: batFirstWins,
      chase_wins: chaseWins,
      highest: firstInns.length || secondInns.length ? Math.max(...firstInns, ...secondInns) : null,
      lowest: firstInns.length || secondInns.length ? Math.min(...firstInns, ...secondInns) : null,
      avg_wkts_first_inns: avg(firstWkts, 1),
    },
    our_record: { played: ours.length, won, lost },
  };
}

/** The opposition's captain and keeper names as seen in their most recent scorecard. */
export function leaders(cards: NormScorecard[], teamId: number): { captain: string | null; keeper: string | null } {
  for (const c of cards) {
    const side = teamSide(c, teamId);
    if (side && (side.captain_name || side.keeper_name)) return { captain: side.captain_name, keeper: side.keeper_name };
  }
  return { captain: null, keeper: null };
}

export { otherSide };
