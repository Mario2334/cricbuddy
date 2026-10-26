import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codexArgs, codexEnv, friendlyCodexError, parseJsonOutput } from '../codex/exec';

test('parses plain, fenced and prose-wrapped JSON', () => {
  assert.deepEqual(parseJsonOutput('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonOutput('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonOutput('Here you go:\n{"a":{"b":2}}\nThanks'), { a: { b: 2 } });
  assert.throws(() => parseJsonOutput(''), /empty/);
  assert.throws(() => parseJsonOutput('no json here'), /not JSON/);
});

test('friendly errors for the failures Sanket can act on', () => {
  const base = { text: '', exitCode: 1, seconds: 1, timedOut: false };
  assert.match(friendlyCodexError({ ...base, tail: '', timedOut: true }, 600_000)!, /longer than 10 minutes/);
  assert.match(friendlyCodexError({ ...base, tail: 'error: usage_limit_reached' }, 1)!, /usage limit/);
  assert.match(friendlyCodexError({ ...base, tail: 'refresh_token_failed' }, 1)!, /codex login/);
  assert.match(friendlyCodexError({ ...base, tail: 'spawn failed: ENOENT' }, 1)!, /not installed/);
  assert.match(friendlyCodexError({ ...base, tail: `ERROR: {"error":{"message":"The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}` }, 1)!, /gpt-6.1-sol is not available/);
  assert.equal(friendlyCodexError({ ...base, tail: 'something else' }, 1), null);
});

test('codex command line and environment', () => {
  const args = codexArgs({ prompt: 'p', schemaPath: '/s.json', workDir: '/w', timeoutMs: 1, model: 'gpt-6.1-sol', effort: 'medium' }, '/w/last.json');
  assert.equal(args[0], 'exec');
  assert.ok(args.includes('gpt-6.1-sol'));
  assert.ok(args.includes('--output-schema') && args.includes('/s.json'));
  assert.ok(args.includes('read-only'));
  assert.equal(args[args.length - 1], '-');
  const env = codexEnv({ PATH: '/bin', HOME: '/root', GRIST_API_KEY: 'secret', CH_AUTHORIZATION: 'x', CODEX_HOME: '/root/.codex' });
  assert.equal(env.PATH, '/bin');
  assert.equal(env.CODEX_HOME, '/root/.codex');
  assert.equal(env.GRIST_API_KEY, undefined);
  assert.equal(env.CH_AUTHORIZATION, undefined);
  assert.equal(env.NO_COLOR, '1');
});
