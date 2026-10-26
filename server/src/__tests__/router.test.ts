import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type http from 'node:http';
import { requireTailnetUser } from '../http/auth';
import { HttpError, Router, intParam, readJson } from '../http/router';

const req = (body: string, headers: Record<string, string> = {}): http.IncomingMessage =>
  Object.assign(Readable.from([Buffer.from(body)]), { headers }) as unknown as http.IncomingMessage;

test('router matches methods, params and trailing slashes', () => {
  const r = new Router().add('GET', '/matches/:id/availability', () => 'ok').add('POST', '/matches/:id/analysis', () => 'posted');
  assert.equal(r.match('GET', '/matches/42/availability')?.params.id, '42');
  assert.equal(r.match('GET', '/matches/42/availability/')?.params.id, '42');
  assert.equal(r.match('POST', '/matches/42/availability'), null);
  assert.equal(r.match('GET', '/nope'), null);
  assert.equal(r.match('post', '/matches/7/analysis')?.params.id, '7');
});

test('intParam validates ids', () => {
  assert.equal(intParam({ id: '12' }, 'id'), 12);
  assert.throws(() => intParam({ id: 'abc' }, 'id'), HttpError);
  assert.throws(() => intParam({ id: '-1' }, 'id'), HttpError);
});

test('readJson parses, caps and rejects bad bodies', async () => {
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
  assert.equal(await readJson(req('')), null);
  await assert.rejects(readJson(req('{oops')), (e: HttpError) => e.status === 400);
  await assert.rejects(readJson(req('x'.repeat(100), {}), 10), (e: HttpError) => e.status === 413);
});

test('tailnet identity is required and checked', () => {
  const allowed = ['sanket@example.com'];
  assert.throws(() => requireTailnetUser(req('', {}), allowed), (e: HttpError) => e.status === 401);
  assert.throws(() => requireTailnetUser(req('', { 'tailscale-user-login': 'other@example.com' }), allowed), (e: HttpError) => e.status === 403);
  assert.equal(requireTailnetUser(req('', { 'tailscale-user-login': 'Sanket@Example.com' }), allowed), 'sanket@example.com');
  assert.equal(requireTailnetUser(req('', {}), ['*']), null);
});
