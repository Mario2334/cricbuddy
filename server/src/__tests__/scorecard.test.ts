import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RawScorecard } from '../cricheroes/types';
import { ballsToOvers, cleanName, normalizeScorecard, oversToBalls, teamSide } from '../domain/scorecard';
import rawCard from './fixtures/scorecard-past.json';

const card = () => normalizeScorecard(rawCard as unknown as RawScorecard);
const DEV_SENA = 5179117;

test('overs text converts to balls and back', () => {
  assert.equal(oversToBalls('3.3'), 21);
  assert.equal(oversToBalls(4, 0), 24);
  assert.equal(oversToBalls('27.3'), 165);
  assert.equal(oversToBalls(3, 4), 22);
  assert.equal(ballsToOvers(22), '3.4');
  assert.equal(ballsToOvers(24), '4');
});

test('names lose the (wk)/(c) suffixes', () => {
  assert.equal(cleanName('Vinit Dhoke  (wk)'), 'Vinit Dhoke');
  assert.equal(cleanName('Rupesh (c)'), 'Rupesh');
});

test('normalises both teams with innings, order and who batted first', () => {
  const c = card();
  const us = teamSide(c, DEV_SENA);
  assert.ok(us);
  assert.equal(us.name, 'Dev-Sena');
  assert.equal(us.batted_first, true);
  assert.equal(c.teams[1].batted_first, false);
  assert.equal(us.innings[0].runs, 210);
  assert.equal(us.innings[0].wkts, 10);
  assert.equal(us.innings[0].balls, 165);
  assert.equal(us.batting[0].pos, 1);
  assert.equal(us.batting[0].name, 'Vinit Dhoke');
  assert.equal(us.batting[0].wk_flag, true);
  assert.equal(us.batting[0].out, true);
  assert.equal(us.keeper_id, 23500230);
  assert.equal(c.winning_team_id, DEV_SENA);
  assert.equal(c.ground_id, 478116);
});

test("each side's bowling list holds its own bowlers", () => {
  const c = card();
  const us = teamSide(c, DEV_SENA)!;
  const them = c.teams.find(t => t.id !== DEV_SENA)!;
  assert.ok(us.bowling.some(b => b.name === 'Shiv Singh'), 'Dev-Sena bowled Shiv Singh');
  assert.ok(them.bowling.some(b => b.name === 'Ashish Rathore'), 'the opposition bowled Ashish Rathore');
  const krishna = them.bowling.find(b => b.name === 'Krishna Thakur')!;
  assert.equal(krishna.balls, 21, '3.3 overs');
});

test('yet-to-bat players get implied positions after the batters', () => {
  const us = teamSide(card(), DEV_SENA)!;
  const batted = us.batting.length;
  assert.deepEqual(us.to_be_bat.map(t => t.implied_pos), us.to_be_bat.map((_, i) => batted + i + 1));
});
