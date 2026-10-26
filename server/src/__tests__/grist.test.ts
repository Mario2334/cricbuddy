import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromEpoch, json, num, str, toEpoch } from '../grist/client';
import { istDay } from '../grist/repo';

test('epoch helpers round-trip and treat 0 as empty', () => {
  const iso = '2026-10-31T01:45:00.000Z';
  assert.equal(fromEpoch(toEpoch(iso)), iso);
  assert.equal(fromEpoch(toEpoch(iso), true), '2026-10-31');
  assert.equal(fromEpoch(0), null);
  assert.equal(toEpoch(null), null);
  assert.equal(toEpoch('garbage'), null);
});

test('cell coercions', () => {
  assert.equal(str(null), '');
  assert.equal(str(5), '5');
  assert.equal(num('5'), null);
  assert.equal(num(5), 5);
  assert.deepEqual(json('{"a":1}'), { a: 1 });
  assert.equal(json('nope'), null);
});

test('IST calendar day', () => {
  assert.equal(istDay(Date.parse('2026-10-25T18:29:00Z') / 1000), '2026-10-25');
  assert.equal(istDay(Date.parse('2026-10-25T18:30:00Z') / 1000), '2026-10-26');
});
