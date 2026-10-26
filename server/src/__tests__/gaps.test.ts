import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGaps, availabilityHash, bowlersNeeded, maxOversPerBowler } from '../domain/gaps';
import type { AvailabilityStatus, Role, RosterPlayer } from '../types';

let nextId = 1;
function player(role: Role, extra: Partial<RosterPlayer> = {}, opened = 0): RosterPlayer {
  const id = nextId++;
  return {
    player_id: id,
    name: `P${id}`,
    photo: null,
    hand: null,
    skill_hint: null,
    role,
    confidence: 'high',
    can_keep: role === 'wicket-keeper',
    part_time_bowler: false,
    in_roster: true,
    override: 'auto',
    last_played: null,
    agg: {
      player_id: id,
      name: `P${id}`,
      appearances: 5,
      kept: 0,
      bowl_rate: 0,
      batting: { inns: 5, runs: 50, balls: 60, outs: 4, hs: 20, avg: 12.5, sr: 83.3, fours: 4, sixes: 1, positions: [], usual_pos: 4, pos_bucket: 'middle', opened, recent: [] },
      bowling: { inns: 0, balls: 0, runs: 0, wkts: 0, maidens: 0, econ: null, avg: null, best: null, recent: [] },
    },
    ...extra,
  };
}
const avail = (pairs: [RosterPlayer, AvailabilityStatus][]) => new Map(pairs.map(([p, s]) => [p.player_id, s]));

test('overs split across five bowlers', () => {
  assert.equal(maxOversPerBowler(20), 4);
  assert.equal(maxOversPerBowler(30), 6);
  assert.equal(maxOversPerBowler(25), 5);
  assert.equal(bowlersNeeded(20), 5);
  assert.equal(bowlersNeeded(30), 5);
});

test('flags a thin, keeper-less, bowler-light squad', () => {
  const batters = Array.from({ length: 6 }, () => player('batter', {}, 2));
  const bowlers = Array.from({ length: 3 }, () => player('bowler'));
  const maybes = [player('all-rounder'), player('wicket-keeper')];
  const all = [...batters, ...bowlers, ...maybes];
  const map = avail([...batters.map(p => [p, 'yes'] as [RosterPlayer, AvailabilityStatus]), ...bowlers.map(p => [p, 'yes'] as [RosterPlayer, AvailabilityStatus]), ...maybes.map(p => [p, 'maybe'] as [RosterPlayer, AvailabilityStatus])]);
  const g = analyzeGaps(all, map, 20);
  assert.equal(g.yes, 9);
  assert.equal(g.maybe, 2);
  const codes = g.issues.map(i => i.code);
  assert.ok(codes.includes('RELIES_ON_MAYBE'));
  assert.ok(codes.includes('NO_KEEPER'));
  assert.equal(g.issues.find(i => i.code === 'NO_KEEPER')!.severity, 'medium', 'a maybe keeper exists');
  const few = g.issues.find(i => i.code === 'FEW_BOWLERS')!;
  assert.equal(few.severity, 'high', '3 + 1 maybe is still short of 5');
  assert.match(few.message, /2 more bowling options/);
  assert.ok(!codes.includes('SHORT_OF_11'));
  assert.ok(!codes.includes('NO_OPENERS'));
});

test('a full, balanced squad raises nothing', () => {
  const squad = [player('wicket-keeper', {}, 2), ...Array.from({ length: 5 }, () => player('batter')), ...Array.from({ length: 4 }, () => player('bowler')), player('all-rounder'), player('all-rounder')];
  const g = analyzeGaps(squad, avail(squad.map(p => [p, 'yes'])), 20);
  assert.deepEqual(g.issues, []);
  assert.equal(g.bowling_options, 6);
  assert.equal(g.counts.keepers, 1);
});

test('too few players and too many batters', () => {
  const squad = [...Array.from({ length: 8 }, () => player('batter')), player('bowler')];
  const g = analyzeGaps(squad, avail(squad.map(p => [p, 'yes'])), 20);
  assert.equal(g.issues.find(i => i.code === 'SHORT_OF_11')!.severity, 'high');
  const big = [...Array.from({ length: 8 }, () => player('batter')), player('bowler'), player('bowler'), player('wicket-keeper')];
  const g2 = analyzeGaps(big, avail(big.map(p => [p, 'yes'])), 20);
  assert.ok(g2.issues.some(i => i.code === 'TOO_MANY_BATTERS'));
});

test('availability hash ignores unknowns and order', () => {
  const a = new Map<number, AvailabilityStatus>([[1, 'yes'], [2, 'maybe'], [3, 'unknown']]);
  const b = new Map<number, AvailabilityStatus>([[2, 'maybe'], [1, 'yes']]);
  assert.equal(availabilityHash(a), availabilityHash(b));
  b.set(2, 'no');
  assert.notEqual(availabilityHash(a), availabilityHash(b));
});
