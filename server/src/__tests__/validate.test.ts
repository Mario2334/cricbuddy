import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryFeedback, validateReport } from '../analysis/validate';
import type { AnalysisFacts, PoolPlayer, Role } from '../types';

function pool(id: number, role: Role, canKeep = false): PoolPlayer {
  return {
    player_id: id, name: `Player ${id}`, photo: null, hand: null, skill_hint: null, role, confidence: 'high', can_keep: canKeep, part_time_bowler: false,
    in_roster: true, override: 'auto', last_played: null, agg: null, availability: 'yes',
  };
}

const facts = {
  match: { overs: 20 },
  gaps: { max_overs_per_bowler: 4 },
  pool: [pool(1, 'batter'), pool(2, 'wicket-keeper', true), pool(3, 'batter'), pool(4, 'batter'), pool(5, 'all-rounder'), pool(6, 'all-rounder'), pool(7, 'bowler'), pool(8, 'bowler'), pool(9, 'bowler'), pool(10, 'bowler'), pool(11, 'bowler'), pool(12, 'batter'), pool(13, 'bowler')],
} as unknown as AnalysisFacts;

function good(): Record<string, unknown> {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return {
    headline: 'Bowl first, squeeze the middle overs',
    opposition: { summary: 'They chase well.', likely_approach: 'Bat first.', key_threats: [{ player_id: 500, name: 'Opp A', role: 'batter', why: 'avg 40' }], weaknesses: ['slow starts'] },
    best_xii: [...ids.map(id => ({ player_id: id, name: 'wrong name', role: 'batter', is_twelfth: false, why: 'form' })), { player_id: 12, name: 'x', role: 'batter', is_twelfth: true, why: 'cover' }],
    batting_order: ids.map((id, i) => ({ position: i + 1, player_id: id, name: 'n', why: 'w' })),
    bowling_plan: { overs_total: 20, bowlers: [7, 8, 9, 10, 11].map(id => ({ player_id: id, name: 'n', overs: 4, phases: ['middle'], why: 'econ 6' })), notes: '' },
    squad_gaps: { summary: 'ok', needs: [], risks: [] },
    ground_pitch: { summary: 'flat', par_score: 160, bat_first_or_chase: 'chase', why: 'chasing wins' },
    toss_call: 'bowl',
    confidence: 'medium',
  };
}

test('a correct plan passes and names are rewritten from the pool', () => {
  const v = validateReport(good(), facts);
  assert.ok(v.ok, JSON.stringify(v));
  if (v.ok) {
    assert.equal(v.report.best_xii[0].name, 'Player 1');
    assert.equal(v.report.bowling_plan.overs_total, 20);
    assert.equal(v.report.batting_order[10].position, 11);
  }
});

const expectError = (mutate: (r: Record<string, unknown>) => void, pattern: RegExp) => {
  const r = good();
  mutate(r);
  const v = validateReport(r, facts);
  assert.ok(!v.ok, 'should fail');
  if (!v.ok) assert.ok(v.errors.some(e => pattern.test(e)), `errors: ${v.errors.join(' | ')}`);
};

test('rejects invented players, wrong counts and duplicates', () => {
  expectError(r => ((r.best_xii as any[])[0].player_id = 999), /not in the pool/);
  expectError(r => (r.best_xii as any[]).push({ player_id: 13, name: 'n', role: 'bowler', is_twelfth: false, why: '' }), /12 entries/);
  expectError(r => ((r.best_xii as any[])[0].is_twelfth = true), /exactly one/);
  expectError(r => (r.batting_order as any[]).pop(), /11 entries/);
  expectError(r => ((r.batting_order as any[])[1].position = 1), /used twice/);
  expectError(r => ((r.batting_order as any[])[0].player_id = 12), /not in the eleven/);
});

test('rejects bowling plans that do not add up', () => {
  expectError(r => ((r.bowling_plan as any).bowlers[0].overs = 3), /add up to 19/);
  expectError(r => {
    (r.bowling_plan as any).bowlers[0].overs = 5;
    (r.bowling_plan as any).bowlers[1].overs = 3;
  }, /maximum is 4/);
  expectError(r => ((r.bowling_plan as any).bowlers[0].player_id = 12), /not in the eleven/);
});

test('requires a keeper when one is available', () => {
  expectError(r => {
    (r.best_xii as any[])[1] = { player_id: 13, name: 'n', role: 'bowler', is_twelfth: false, why: '' };
    (r.batting_order as any[])[1].player_id = 13;
  }, /no wicket-keeper/);
});

test('retry feedback lists the errors', () => {
  assert.match(retryFeedback(['a', 'b']), /- a\n- b/);
});
