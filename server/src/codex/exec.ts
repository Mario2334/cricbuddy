import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from '../log';

export interface CodexRunOptions {
  prompt: string;
  schemaPath: string;
  workDir: string;
  timeoutMs: number;
  model: string;
  effort: string;
}

export interface CodexRunResult {
  /** The agent's final message (from `-o`), '' when it wrote none. */
  text: string;
  exitCode: number | null;
  /** Last ~1 KB of stdout+stderr for error reporting. */
  tail: string;
  seconds: number;
  timedOut: boolean;
}

export interface CodexRunner {
  readonly description: string;
  run(opts: CodexRunOptions): Promise<CodexRunResult>;
}

const ENV_KEEP = new Set(['PATH', 'HOME', 'LANG', 'LC_ALL', 'CODEX_HOME', 'TMPDIR', 'USER', 'SHELL']);

/** Codex gets a minimal environment: never our Grist or CricHeroes credentials. */
export function codexEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined && (ENV_KEEP.has(k) || k.startsWith('CODEX_') || k.startsWith('XDG_'))) env[k] = v;
  env.TERM = 'dumb';
  env.NO_COLOR = '1';
  return env;
}

/** The configured binary, else the first `codex` on PATH, else ~/.local/bin/codex if it exists. */
export function resolveCodexBin(configured: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
  if (configured) return configured;
  for (const dir of (env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.join(dir, 'codex');
    if (dir && fs.existsSync(candidate)) return candidate;
  }
  const local = path.join(os.homedir(), '.local', 'bin', 'codex');
  return fs.existsSync(local) ? local : null;
}

export function codexArgs(opts: CodexRunOptions, lastFile: string): string[] {
  return [
    'exec',
    '-C',
    opts.workDir,
    '-s',
    'read-only',
    '--ephemeral',
    '--skip-git-repo-check',
    '-m',
    opts.model,
    '--color',
    'never',
    '-c',
    'approval_policy="never"',
    '-c',
    `model_reasoning_effort="${opts.effort}"`,
    '--output-schema',
    opts.schemaPath,
    '-o',
    lastFile,
    '-',
  ];
}

export class CodexCli implements CodexRunner {
  readonly description: string;

  constructor(private readonly bin: string) {
    this.description = `codex exec (${bin})`;
  }

  run(opts: CodexRunOptions): Promise<CodexRunResult> {
    fs.mkdirSync(opts.workDir, { recursive: true });
    const lastFile = path.join(opts.workDir, 'last.json');
    fs.rmSync(lastFile, { force: true });
    const started = Date.now();
    return new Promise<CodexRunResult>(resolve => {
      const child = spawn(this.bin, codexArgs(opts, lastFile), { cwd: opts.workDir, env: codexEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      const keep = (chunk: Buffer) => {
        out = (out + chunk.toString('utf8')).slice(-8000);
      };
      child.stdout.on('data', keep);
      child.stderr.on('data', keep);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        log.warn('codex: timeout, sending SIGTERM');
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
      }, opts.timeoutMs);
      child.on('error', err => {
        clearTimeout(timer);
        resolve({ text: '', exitCode: null, tail: `spawn failed: ${err.message}`, seconds: (Date.now() - started) / 1000, timedOut });
      });
      child.on('close', code => {
        clearTimeout(timer);
        let text = '';
        try {
          text = fs.readFileSync(lastFile, 'utf8');
        } catch {
          text = '';
        }
        resolve({ text, exitCode: code, tail: out.slice(-1000), seconds: Math.round(((Date.now() - started) / 1000) * 10) / 10, timedOut });
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(opts.prompt);
    });
  }
}

/** Returns a canned report; for UI work and tests (CODEX_FAKE=<file>). */
export class FakeCodex implements CodexRunner {
  readonly description: string;

  constructor(private readonly file: string) {
    this.description = `fake codex (${file})`;
  }

  async run(opts: CodexRunOptions): Promise<CodexRunResult> {
    fs.mkdirSync(opts.workDir, { recursive: true });
    fs.writeFileSync(path.join(opts.workDir, 'prompt.txt'), opts.prompt);
    return { text: fs.readFileSync(this.file, 'utf8'), exitCode: 0, tail: '', seconds: 0.1, timedOut: false };
  }
}

/** Parse the model's final message: plain JSON, a fenced block, or JSON buried in prose. */
export function parseJsonOutput(text: string): unknown {
  let s = text.trim();
  if (!s) throw new Error('empty answer');
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
    throw new Error('answer is not JSON');
  }
}

/** Plain-words reasons for failures Sanket can act on; null for anything else. */
export function friendlyCodexError(run: CodexRunResult, timeoutMs: number): string | null {
  if (run.timedOut) return `The model took longer than ${Math.round(timeoutMs / 60_000)} minutes. Tap Re-run to try again.`;
  const low = run.tail.toLowerCase();
  if (low.includes('refresh_token_failed') || low.includes('not logged in') || (low.includes('login') && low.includes('expired')) || low.includes('401')) {
    return 'Codex login on the server has expired: run `codex login` on veyden, then Re-run.';
  }
  if (low.includes('model_not_found') || low.includes('model is not supported')) {
    const m = /'([^']+)' model is not supported/.exec(run.tail);
    return `Model ${m ? m[1] : ''} is not available on the server's Codex login. Set CODEX_MODEL to one it offers (gpt-6-astra works with a ChatGPT account) or add an OpenAI API key.`.replace('Model  is', 'The model is');
  }
  if (low.includes('usage_limit') || low.includes('rate_limit') || low.includes('quota') || low.includes('usage limit')) {
    return 'ChatGPT usage limit reached for Codex. Try again later.';
  }
  if (low.includes('spawn failed') || low.includes('enoent')) return 'Codex CLI is not installed where the server expects it (CODEX_BIN).';
  return null;
}
