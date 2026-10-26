import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RawScorecard, RawTeamPlayer } from '../cricheroes/types';
import { buildRoster, deriveRole, lastPlayedMap } from '../domain/roster';
import { normalizeScorecard } from '../domain/scorecard';
import { aggregatePlayers } from '../domain/stats';
import type { PlayerAgg } from '../types';
import rawCard from './fixtures/scorecard-past.json';
import membersRaw from './fixtures/team-players-ours.json';

const DEV_SENA = 5179117;

function agg(o: { apps: number; spells?: number; balls?: number; pos?: number | null; kept?: number; inns?: number }): PlayerAgg {
  const spells = o.spells ?? 0;
  return {
    player_id: 1,
    name: 'X',
    appearances: o.apps,
    kept: o.kept ?? 0,
    bowl_rate: o.apps ? Math.round((spells / o.apps) * 100) / 100 : 0,
    batting: { inns: o.inns ?? (o.balls ? o.apps : 0), runs: 0, balls: o.balls ?? 0, outs: 0, hs: 0, avg: null, sr: null, fours: 0, sixes: 0, positions: [], usual_pos: o.pos ?? null, pos_bucket: null, opened: 0, recent: [] },
    bowling: { inns: spells, balls: spells * 24, runs: 0, wkts: 0, maidens: 0, econ: null, avg: null, best: null, recent: [] },
  };
}

test('role table', () => {
  assert.equal(deriveRole(agg({ apps: 8, spells: 6, balls: 20, pos: 9 }), null).role, 'bowler');
  assert.equal(deriveRole(agg({ apps: 8, spells: 4, balls: 120, pos: 5 }), null).role, 'all-rounder');
  assert.equal(deriveRole(agg({ apps: 8, spells: 4, balls: 10, pos: 10 }), null).role, 'bowler', 'bowls regularly, barely bats');
  const pure = deriveRole(agg({ apps: 8, spells: 0, balls: 160, pos: 3 }), null);
  assert.equal(pure.role, 'batter');
  assert.equal(pure.part_time_bowler, false);
  assert.equal(pure.confidence, 'high');
  const part = deriveRole(agg({ apps: 8, spells: 1, balls: 160, pos: 3 }), null);
  assert.equal(part.role, 'batter');
  assert.equal(part.part_time_bowler, true);
  const keeper = deriveRole(agg({ apps: 8, kept: 6, balls: 100, pos: 2 }), null);
  assert.equal(keeper.role, 'wicket-keeper');
  assert.equal(keeper.can_keep, true);
  assert.equal(deriveRole(agg({ apps: 4, spells: 0, balls: 50, pos: 4 }), null).confidence, 'medium');
});

test('low samples fall back to the CricHeroes skill hint', () => {
  const low = deriveRole(agg({ apps: 2, spells: 2, balls: 4, pos: 10 }), 'BOWL');
  assert.equal(low.role, 'bowler');
  assert.equal(low.confidence, 'low');
  assert.equal(deriveRole(agg({ apps: 1, balls: 30, pos: 4, inns: 1 }), null).role, 'batter');
  assert.equal(deriveRole(null, 'ALL').role, 'all-rounder');
  assert.equal(deriveRole(null, '').role, 'unknown');
});

test('roster membership follows appearances, last-match flag and overrides', () => {
  const card = normalizeScorecard(rawCard as unknown as RawScorecard);
  const members = membersRaw as unknown as RawTeamPlayer[];
  const aggs = aggregatePlayers([card], DEV_SENA);
  const played = new Set(aggs.keys());
  const bench = members.find(m => !played.has(m.player_id) && Number(m.is_played_last_match) !== 1)!;
  const regular = members.find(m => played.has(m.player_id))!;
  const overrides = new Map<number, 'include' | 'exclude' | 'auto'>([
    [bench.player_id, 'include'],
    [regular.player_id, 'exclude'],
  ]);
  const roster = buildRoster({ members, aggs, lastPlayed: lastPlayedMap([card], DEV_SENA), overrides, now: new Date('2026-10-26T00:00:00Z') });
  const byId = new Map(roster.map(r => [r.player.player_id, r.player]));
  assert.equal(roster.length, members.length, 'every member is listed (no guests in this card)');
  assert.equal(byId.get(bench.player_id)!.in_roster, true, 'include override pulls a bench player in');
  assert.equal(byId.get(regular.player_id)!.in_roster, false, 'exclude override drops a regular');
  const inRoster = roster.filter(r => r.player.in_roster);
  assert.ok(inRoster.length >= 11 && inRoster.length <= 25, `roster size ${inRoster.length}`);
  assert.equal(byId.get(23500230)!.last_played, '2026-10-24');
  assert.equal(byId.get(23500230)!.can_keep, true);
});

test('a lone appearance months ago does not make the roster, a recent one does', () => {
  const card = normalizeScorecard(rawCard as unknown as RawScorecard);
  const members = (membersRaw as unknown as RawTeamPlayer[]).map(m => ({ ...m, is_played_last_match: 0 }));
  const aggs = aggregatePlayers([card], DEV_SENA);
  const lastPlayed = lastPlayedMap([card], DEV_SENA);
  const recent = buildRoster({ members, aggs, lastPlayed, overrides: new Map(), now: new Date('2026-11-20T00:00:00Z') });
  assert.equal(recent.find(r => r.player.player_id === 23500230)!.player.in_roster, true, '27 days later: still in');
  const old = buildRoster({ members, aggs, lastPlayed, overrides: new Map(), now: new Date('2027-02-01T00:00:00Z') });
  assert.equal(old.find(r => r.player.player_id === 23500230)!.player.in_roster, false, '100 days later, one appearance: out');
  assert.equal(old.filter(r => r.player.in_roster).length, 0);
});
