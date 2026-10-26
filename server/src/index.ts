import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config';
import { GristClient } from './grist/client';
import { ensureSchema } from './grist/schema';
import { AnalysesRepo, AvailabilityRepo, PlayersRepo } from './grist/repo';
import { FileCache } from './cache/fileCache';
import { CricHeroesClient } from './cricheroes/client';
import { CodexCli, FakeCodex, resolveCodexBin, type CodexRunner, type CodexRunOptions, type CodexRunResult } from './codex/exec';
import { loadPromptTemplate } from './analysis/prompt';
import { JobRunner } from './jobs/runner';
import { buildRouter, type AppDeps } from './http/routes';
import { requireTailnetUser } from './http/auth';
import { HttpError, Reply, sendJson } from './http/router';
import { log } from './log';

/** Stands in when no codex binary is found, so jobs fail with a clear message instead of ENOENT noise. */
class MissingCodex implements CodexRunner {
  readonly description = 'codex missing';
  async run(_opts: CodexRunOptions): Promise<CodexRunResult> {
    return { text: '', exitCode: null, tail: 'spawn failed: codex not found', seconds: 0, timedOut: false };
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  fs.mkdirSync(cfg.cacheDir, { recursive: true });
  fs.mkdirSync(cfg.workDir, { recursive: true });

  const grist = new GristClient({ url: cfg.gristUrl, docId: cfg.gristDocId, user: cfg.gristUser, apiKey: cfg.gristApiKey });
  await ensureSchema(grist);

  const codexBin = cfg.codexFake ? null : resolveCodexBin(cfg.codexBin);
  const codex: CodexRunner = cfg.codexFake ? new FakeCodex(cfg.codexFake) : codexBin ? new CodexCli(codexBin) : new MissingCodex();
  if (!cfg.codexFake && !codexBin) log.warn('codex binary not found; set CODEX_BIN');

  const deps: AppDeps = {
    cfg,
    ch: new CricHeroesClient({ creds: cfg.cricheroes, cache: new FileCache(cfg.cacheDir) }),
    players: new PlayersRepo(grist),
    availability: new AvailabilityRepo(grist),
    analyses: new AnalysesRepo(grist),
    codex,
    promptTemplate: loadPromptTemplate(cfg.codexDir),
    runner: null as unknown as JobRunner,
    codexBin,
  };
  deps.runner = new JobRunner(deps);
  await deps.runner.recoverOnStart();
  deps.runner.startSweep();
  deps.runner.enqueue();

  const router = buildRouter(deps);
  const server = http.createServer(async (req, res) => {
    const startedAt = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    let status = 200;
    try {
      const user = url.pathname === '/health' ? null : requireTailnetUser(req, cfg.allowedUsers);
      const hit = router.match(req.method ?? 'GET', url.pathname);
      if (!hit) throw new HttpError(404, `No route for ${req.method} ${url.pathname}`);
      const out = await hit.handler({ req, res, params: hit.params, query: url.searchParams, user });
      if (out instanceof Reply) {
        status = out.status;
        sendJson(res, out.status, out.body);
      } else {
        sendJson(res, 200, out ?? null);
      }
    } catch (e) {
      if (e instanceof HttpError) {
        status = e.status;
        sendJson(res, e.status, { error: e.message, code: e.code });
      } else {
        status = 500;
        log.error('request failed', { method: req.method, path: url.pathname, error: (e as Error).stack ?? String(e) });
        sendJson(res, 500, { error: `Server error: ${(e as Error).message}` });
      }
    } finally {
      log.info(`${req.method} ${url.pathname}`, { status, ms: Date.now() - startedAt });
    }
  });
  server.listen(cfg.port, cfg.host, () => log.info('cricbuddy-api listening', { host: cfg.host, port: cfg.port, codex: codex.description, model: cfg.codexModel, grist: cfg.gristUrl, doc: cfg.gristDocId }));

  const shutdown = () => {
    log.info('shutting down');
    deps.runner.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(e => {
  log.error('fatal', { error: (e as Error).stack ?? String(e) });
  process.exit(1);
});

