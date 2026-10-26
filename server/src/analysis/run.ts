import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../config';
import type { CodexRunner } from '../codex/exec';
import { friendlyCodexError, parseJsonOutput } from '../codex/exec';
import { availabilityHash } from '../domain/gaps';
import type { AnalysesRepo, AnalysisRow } from '../grist/repo';
import { nowEpoch } from '../grist/client';
import { HttpError } from '../http/router';
import { log } from '../log';
import { buildFacts, resolveMatch, type FactsDeps } from './facts';
import { buildPrompt } from './prompt';
import { retryFeedback, validateReport } from './validate';
import type { AiReport } from '../types';

export interface RunDeps extends FactsDeps {
  cfg: Config;
  analyses: AnalysesRepo;
  codex: CodexRunner;
  promptTemplate: string;
}

async function snapshotFor(deps: RunDeps, matchId: number): Promise<{ hash: string; entries: unknown[] }> {
  const entries = await deps.availability.forMatch(matchId);
  const map = new Map(entries.map(e => [e.player_id, e.status]));
  return { hash: availabilityHash(map), entries: entries.filter(e => e.status !== 'unknown') };
}

/** One job: fetching → facts saved → thinking → validated report saved (or a readable failure). */
export async function runAnalysis(deps: RunDeps, row: AnalysisRow): Promise<void> {
  const { cfg, analyses } = deps;
  const started = Date.now();
  const fail = async (error: string) => {
    await analyses.patch(row.id, { status: 'failed', error: error.slice(0, 900), finished_at: nowEpoch(), duration_s: Math.round((Date.now() - started) / 1000) });
    log.warn('analysis failed', { job: row.id, match: row.match_id, error });
  };

  try {
    await analyses.patch(row.id, { status: 'fetching', started_at: nowEpoch(), error: '' });
    const { ctx } = await resolveMatch(deps, row.match_id);
    const facts = await buildFacts(deps, ctx);
    const snapshot = await snapshotFor(deps, row.match_id);
    await analyses.patch(row.id, {
      status: 'thinking',
      opponent_team_id: ctx.opponent_team_id,
      opponent_name: ctx.opponent_name,
      ground_id: ctx.ground_id,
      ground_name: ctx.ground_name ?? '',
      facts: JSON.stringify(facts),
      availability_snapshot: JSON.stringify(snapshot),
    });
    log.info('facts ready', { job: row.id, pool: facts.pool.length, opp_matches: facts.opposition.last5.length, ground_sample: facts.ground?.sample ?? 0 });

    const workDir = path.join(cfg.workDir, `job-${row.id}`);
    const schemaPath = path.join(cfg.codexDir, 'schema.json');
    let feedback = '';
    let report: AiReport | null = null;
    let attempts = 0;
    let lastError = '';
    while (attempts < 2 && !report) {
      attempts += 1;
      const prompt = buildPrompt(deps.promptTemplate, facts, feedback);
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(path.join(workDir, `prompt-${attempts}.txt`), prompt);
      const run = await deps.codex.run({ prompt, schemaPath, workDir, timeoutMs: cfg.codexTimeoutMs, model: cfg.codexModel, effort: cfg.codexReasoningEffort });
      log.info('codex returned', { job: row.id, attempt: attempts, exit: run.exitCode, seconds: run.seconds, chars: run.text.length });
      const friendly = friendlyCodexError(run, cfg.codexTimeoutMs);
      if (friendly && !run.text.trim()) {
        lastError = friendly;
        break; // login, quota, model or timeout trouble: a retry would hit the same wall
      }
      let parsed: unknown;
      try {
        parsed = parseJsonOutput(run.text);
      } catch (e) {
        lastError = friendly ?? `The model returned no usable JSON (${(e as Error).message}; exit ${run.exitCode}): ${run.tail.slice(-200)}`;
        feedback = retryFeedback(['the reply was not a JSON object matching the schema']);
        continue;
      }
      const v = validateReport(parsed, facts);
      if (v.ok) {
        report = v.report;
      } else {
        lastError = `The plan failed the checks: ${v.errors.slice(0, 4).join('; ')}`;
        feedback = retryFeedback(v.errors);
        log.warn('report rejected', { job: row.id, attempt: attempts, errors: v.errors.slice(0, 6) });
      }
    }
    if (process.env.KEEP_WORK !== '1') fs.rmSync(workDir, { recursive: true, force: true });
    if (!report) {
      await analyses.patch(row.id, { attempts });
      await fail(lastError || 'The model did not produce a valid plan');
      return;
    }
    await analyses.patch(row.id, {
      status: 'done',
      report: JSON.stringify(report),
      headline: report.headline,
      finished_at: nowEpoch(),
      duration_s: Math.round((Date.now() - started) / 1000),
      attempts,
      model: cfg.codexModel,
      reasoning_effort: cfg.codexReasoningEffort,
      error: '',
    });
    log.info('analysis done', { job: row.id, match: row.match_id, seconds: Math.round((Date.now() - started) / 1000), attempts });
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : `Unexpected error: ${(e as Error).message}`;
    await fail(msg);
  }
}

/** Does the latest report still match the current availability? */
export async function isStale(deps: RunDeps, row: AnalysisRow): Promise<boolean> {
  const current = await snapshotFor(deps, row.match_id);
  return (row.availability_hash ?? '') !== current.hash;
}
