import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RawScorecard, RawTeamMatch } from '../cricheroes/types';
import { normalizeScorecard } from '../domain/scorecard';
import { aggregatePlayers, groundSummary, headToHead, matchLine, median, posBucket, teamAggregates } from '../domain/stats';
import rawCard from './fixtures/scorecard-past.json';
import oursRaw from './fixtures/team-matches-ours.json';

const DEV_SENA = 5179117;
const card = normalizeScorecard(rawCard as unknown as RawScorecard);
const ours = oursRaw as unknown as RawTeamMatch[];
const past = ours.filter(m => m.status === 'past');

test('median and position buckets', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(posBucket(1), 'top');
  assert.equal(posBucket(5), 'middle');
  assert.equal(posBucket(9), 'lower');
});

test('aggregates batting, bowling and keeping from a scorecard', () => {
  const aggs = aggregatePlayers([card], DEV_SENA);
  const vinit = aggs.get(23500230)!;
  assert.equal(vinit.batting.inns, 1);
  assert.equal(vinit.batting.runs, 12);
  assert.equal(vinit.batting.balls, 18);
  assert.equal(vinit.batting.outs, 1);
  assert.equal(vinit.batting.opened, 1);
  assert.equal(vinit.kept, 1);
  assert.deepEqual(vinit.batting.recent, ['12(18)']);
  const raw = rawCard as unknown as RawScorecard;
  const shivRaw = raw.team_b.scorecard![0].bowling!.find(b => b.name === 'Shiv Singh')!;
  const shiv = [...aggs.values()].find(a => a.name === 'Shiv Singh')!;
  assert.equal(shiv.bowling.inns, 1);
  assert.equal(shiv.bowling.wkts, Number(shivRaw.wickets));
  assert.equal(shiv.bowling.runs, Number(shivRaw.runs));
  assert.equal(shiv.bowl_rate, 1);
  for (const a of aggs.values()) assert.ok(a.appearances >= 1);
});

test('match lines read a fixture from either side', () => {
  const m = past.find(x => x.match_id === 26933291)!;
  const us = matchLine(m, DEV_SENA);
  assert.equal(us.result, 'won');
  assert.equal(us.opponent, 'KNCC-Kings Of The North Cricket Club');
  assert.equal(us.our_score, '210/10');
  assert.equal(us.their_score, '171/10');
  assert.equal(us.margin, '39 runs');
  assert.equal(us.batted_first, true);
  assert.equal(us.date, '2026-10-24');
  const them = matchLine(m, 9473036);
  assert.equal(them.result, 'lost');
  assert.equal(them.opponent, 'Dev-Sena');
  assert.equal(them.batted_first, false);
});

test('head-to-head picks only past meetings with that opponent', () => {
  const h2h = headToHead(ours, DEV_SENA, 11573344);
  assert.ok(h2h.length >= 1);
  for (const line of h2h) assert.equal(line.opponent, 'INDIRA BRIGADE');
  assert.equal(h2h[0].result, 'lost');
});

test('team and ground aggregates from one scorecard', () => {
  const t = teamAggregates([card], DEV_SENA);
  assert.equal(t.avg_bat_first, 210);
  assert.equal(t.wins_bat_first, 1);
  assert.equal(t.avg_wkts_lost, 10);
  const g = groundSummary([card], past.filter(m => m.ground_id === 478116), DEV_SENA);
  assert.equal(g.sample, 1);
  assert.equal(g.aggregates.avg_first_inns, 210);
  assert.equal(g.aggregates.avg_second_inns, 171);
  assert.equal(g.aggregates.bat_first_wins, 1);
  assert.equal(g.aggregates.chase_wins, 0);
  assert.equal(g.matches[0].chased, false);
  assert.ok(g.our_record.played >= 1);
});
