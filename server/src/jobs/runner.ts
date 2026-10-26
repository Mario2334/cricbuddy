import { nowEpoch } from '../grist/client';
import { log } from '../log';
import { runAnalysis, type RunDeps } from '../analysis/run';

/** In-process queue over the Grist `Analyses` table: one job at a time, nothing lost across restarts. */
export class JobRunner {
  private draining = false;
  private activeId: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: RunDeps) {}

  get active(): number {
    return this.activeId === null ? 0 : 1;
  }

  /** A restart mid-job leaves rows in fetching/thinking: fail them with a readable reason. */
  async recoverOnStart(): Promise<void> {
    const stuck = await this.deps.analyses.byStatus(['fetching', 'thinking']);
    for (const row of stuck) {
      await this.deps.analyses.patch(row.id, { status: 'failed', error: 'Interrupted (server restarted). Tap Re-run.', finished_at: nowEpoch() });
      log.warn('job interrupted by restart', { job: row.id, match: row.match_id });
    }
  }

  enqueue(): void {
    setImmediate(() => void this.drain());
  }

  startSweep(intervalMs = 60_000): void {
    this.timer = setInterval(() => void this.drain(), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (;;) {
        const [next] = await this.deps.analyses.byStatus(['queued']);
        if (!next) break;
        this.activeId = next.id;
        log.info('job start', { job: next.id, match: next.match_id });
        try {
          await runAnalysis(this.deps, next);
        } catch (e) {
          log.error('job crashed', { job: next.id, error: (e as Error).message });
          try {
            await this.deps.analyses.patch(next.id, { status: 'failed', error: `Worker error: ${(e as Error).message}`.slice(0, 900), finished_at: nowEpoch() });
          } catch {
            /* Grist is down; the sweep retries the queue later */
          }
        } finally {
          this.activeId = null;
        }
      }
    } catch (e) {
      log.error('drain failed', { error: (e as Error).message });
    } finally {
      this.draining = false;
    }
  }
}
