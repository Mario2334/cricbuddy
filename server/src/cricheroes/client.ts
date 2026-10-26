import type { FileCache } from '../cache/fileCache';
import { log } from '../log';
import type { RawEnvelope, RawGround, RawScorecard, RawTeamMatch, RawTeamMatchPage, RawTeamPlayer, RawTeamStat } from './types';

export class CricHeroesError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface CricHeroesClientOptions {
  creds: { apiKey: string; authorization: string; udid: string };
  cache: FileCache;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  /** Minimum gap between requests; CricHeroes answers 429 to bursts. */
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
}

const TTL = {
  teamMatches: 10 * 60_000,
  teamPlayers: 24 * 3_600_000,
  teamStatistic: 24 * 3_600_000,
  ground: 7 * 24 * 3_600_000,
  scorecardLive: 60_000,
};

interface Memo {
  expires: number;
  value: unknown;
}

export class CricHeroesClient {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly memo = new Map<string, Memo>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private nextSlot = 0;

  constructor(private readonly opts: CricHeroesClientOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.baseUrl = (opts.baseUrl ?? 'https://api.cricheroes.in/api/v1').replace(/\/+$/, '');
    this.minIntervalMs = opts.minIntervalMs ?? 300;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.retries = opts.retries ?? 3;
  }

  private headers(): Record<string, string> {
    const c = this.opts.creds;
    return {
      accept: 'application/json, text/plain, */*',
      'api-key': c.apiKey,
      authorization: c.authorization,
      udid: c.udid,
      'device-type': 'Chrome: 137.0.0.0',
      origin: 'https://cricheroes.com',
      referer: 'https://cricheroes.com/',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    };
  }

  /** Reserve the next free slot so concurrent callers queue `minIntervalMs` apart. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.minIntervalMs;
    if (slot > now) await new Promise(r => setTimeout(r, slot - now));
  }

  /** GET `path` (relative to the API base) with throttling and retries on 429/5xx/network errors. */
  async get<T>(path: string): Promise<T> {
    let attempt = 0;
    for (;;) {
      await this.throttle();
      let res: Response;
      try {
        res = await this.fetchFn(`${this.baseUrl}${path}`, { headers: this.headers(), signal: AbortSignal.timeout(this.timeoutMs) });
      } catch (e) {
        if (attempt++ >= this.retries) throw new CricHeroesError(0, `CricHeroes unreachable: ${(e as Error).message}`);
        await this.backoff(attempt, null);
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt++ >= this.retries) throw new CricHeroesError(res.status, `CricHeroes ${res.status} on ${path}`);
        await this.backoff(attempt, res.headers.get('retry-after'));
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new CricHeroesError(res.status, `CricHeroes ${res.status} on ${path}: ${text.slice(0, 200)}`);
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new CricHeroesError(res.status, `CricHeroes returned non-JSON on ${path}`);
      }
    }
  }

  private async backoff(attempt: number, retryAfter: string | null): Promise<void> {
    const hinted = retryAfter ? Number(retryAfter) * 1000 : NaN;
    const ms = Number.isFinite(hinted) && hinted > 0 ? Math.min(hinted, 30_000) : Math.min(1000 * 2 ** (attempt - 1), 15_000);
    log.warn('cricheroes: retrying', { attempt, waitMs: ms });
    await new Promise(r => setTimeout(r, ms));
  }

  /** Memoised + deduplicated fetch. */
  private async memoised<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.memo.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;
    const p = load()
      .then(value => {
        this.memo.set(key, { expires: Date.now() + ttlMs, value });
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  private unwrap<T>(env: RawEnvelope<T>, what: string): T {
    if (!env || env.status === false || env.data === undefined || env.data === null) {
      throw new CricHeroesError(200, `CricHeroes refused ${what}: ${env?.error?.message ?? 'no data'}`);
    }
    return env.data;
  }

  /** Fixtures of any team, newest first as the API returns them. Pages until `minPast` past matches are in hand. */
  async teamMatches(teamId: number, opts: { minPast?: number; maxPages?: number; pageSize?: number } = {}): Promise<RawTeamMatch[]> {
    const { minPast = 20, maxPages = 3, pageSize = 50 } = opts;
    return this.memoised(`team-matches:${teamId}:${minPast}:${pageSize}`, TTL.teamMatches, async () => {
      const out: RawTeamMatch[] = [];
      let next: string | null = `/team/get-team-match/${teamId}?pagesize=${pageSize}&teamId=${teamId}&pageno=1&datetime=${Date.now()}`;
      let pages = 0;
      while (next && pages < maxPages) {
        const page: RawTeamMatchPage = await this.get<RawTeamMatchPage>(next);
        const rows = Array.isArray(page.data) ? page.data : [];
        out.push(...rows);
        pages += 1;
        const past = out.filter(m => m.status === 'past').length;
        if (past >= minPast || rows.length < pageSize) break;
        next = page.page?.next ? (page.page.next.startsWith('/') ? page.page.next : `/${page.page.next}`) : null;
      }
      return out;
    });
  }

  /** Full scorecard. Finished matches never change, so they live in the file cache for good. */
  async scorecard(matchId: number, opts: { immutable: boolean }): Promise<RawScorecard> {
    const key = `scorecards/${matchId}`;
    if (opts.immutable) {
      const cached = this.opts.cache.get<RawScorecard>(key);
      if (cached) return cached;
    }
    return this.memoised(`scorecard:${matchId}`, opts.immutable ? TTL.ground : TTL.scorecardLive, async () => {
      const data = this.unwrap(await this.get<RawEnvelope<RawScorecard>>(`/scorecard/get-scorecard/${matchId}`), `scorecard ${matchId}`);
      if (opts.immutable) this.opts.cache.set(key, data);
      return data;
    });
  }

  async teamPlayers(teamId: number): Promise<RawTeamPlayer[]> {
    return this.memoised(`team-players:${teamId}`, TTL.teamPlayers, async () =>
      this.unwrap(await this.get<RawEnvelope<RawTeamPlayer[]>>(`/team/get-team-players/${teamId}`), `players of team ${teamId}`),
    );
  }

  async teamStatistic(teamId: number): Promise<RawTeamStat[]> {
    return this.memoised(`team-stat:${teamId}`, TTL.teamStatistic, async () =>
      this.unwrap(await this.get<RawEnvelope<RawTeamStat[]>>(`/team/get-team-statistic/${teamId}`), `statistic of team ${teamId}`),
    );
  }

  async groundDetail(groundId: number): Promise<RawGround> {
    return this.memoised(`ground:${groundId}`, TTL.ground, async () =>
      this.unwrap(await this.get<RawEnvelope<RawGround>>(`/booking/get-ground-detail/${groundId}`), `ground ${groundId}`),
    );
  }
}
