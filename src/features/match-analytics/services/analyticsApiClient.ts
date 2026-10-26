/**
 * HTTP client for cricbuddy-api (server/ in this repo). The server is tailnet-only; Tailscale adds the
 * identity header on the way in, so the app sends none. GETs retry briefly, writes never do.
 */
import { CRICBUDDY_API_URL } from '../../../config/server';
import type {
  AnalysisJob,
  AnalysisPostBody,
  AnalysisResponse,
  AvailabilityPutBody,
  AvailabilityResponse,
  HealthResponse,
  PlayersResponse,
} from '../types';

export type AnalyticsErrorKind = 'unreachable' | 'cap' | 'conflict' | 'not_found' | 'server';

export class AnalyticsError extends Error {
  constructor(
    public readonly kind: AnalyticsErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export const UNREACHABLE_MESSAGE = "Can't reach the CricBuddy server. Is Tailscale on?";

export interface AnalyticsApiClientDeps {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Retries for GETs after a network failure or 5xx. */
  retries?: number;
  retryDelayMs?: number;
}

export interface RequestAnalysisResult {
  /** 'queued' when this call created the job, 'active' when one was already running. */
  outcome: 'queued' | 'active';
  job: AnalysisJob;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class AnalyticsApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(deps: AnalyticsApiClientDeps = {}) {
    this.baseUrl = (deps.baseUrl ?? CRICBUDDY_API_URL).replace(/\/+$/, '');
    this.fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
    this.timeoutMs = deps.timeoutMs ?? 15_000;
    this.retries = deps.retries ?? 2;
    this.retryDelayMs = deps.retryDelayMs ?? 600;
  }

  private async once<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError';
      throw new AnalyticsError('unreachable', aborted ? 'The CricBuddy server took too long to answer. Is Tailscale on?' : UNREACHABLE_MESSAGE);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const message = (data as { error?: string } | null)?.error ?? `Server answered ${res.status}`;
      const kind: AnalyticsErrorKind = res.status === 429 ? 'cap' : res.status === 409 ? 'conflict' : res.status === 404 ? 'not_found' : 'server';
      throw new AnalyticsError(kind, message, res.status);
    }
    return { status: res.status, data: data as T };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const canRetry = method === 'GET';
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.once<T>(method, path, body);
      } catch (e) {
        const err = e as AnalyticsError;
        const retryable = err.kind === 'unreachable' || (err.kind === 'server' && (err.status ?? 0) >= 500);
        if (!canRetry || !retryable || attempt >= this.retries) throw err;
        await sleep(this.retryDelayMs * (attempt + 1));
      }
    }
  }

  async health(): Promise<HealthResponse> {
    return (await this.request<HealthResponse>('GET', '/health')).data;
  }

  async getPlayers(refresh = false): Promise<PlayersResponse> {
    return (await this.request<PlayersResponse>('GET', `/team/players${refresh ? '?refresh=1' : ''}`)).data;
  }

  async getAvailability(matchId: string, all = false): Promise<AvailabilityResponse> {
    return (await this.request<AvailabilityResponse>('GET', `/matches/${encodeURIComponent(matchId)}/availability${all ? '?all=1' : ''}`)).data;
  }

  async putAvailability(matchId: string, entries: AvailabilityPutBody['entries'], all = false): Promise<AvailabilityResponse> {
    const body: AvailabilityPutBody = { entries };
    return (await this.request<AvailabilityResponse>('PUT', `/matches/${encodeURIComponent(matchId)}/availability${all ? '?all=1' : ''}`, body)).data;
  }

  async getAnalysis(matchId: string): Promise<AnalysisResponse> {
    return (await this.request<AnalysisResponse>('GET', `/matches/${encodeURIComponent(matchId)}/analysis`)).data;
  }

  async requestAnalysis(matchId: string, hint?: AnalysisPostBody['hint']): Promise<RequestAnalysisResult> {
    const body: AnalysisPostBody = hint ? { hint } : {};
    const { status, data } = await this.request<{ job: AnalysisJob }>('POST', `/matches/${encodeURIComponent(matchId)}/analysis`, body);
    return { outcome: status === 202 ? 'queued' : 'active', job: data.job };
  }
}

export const analyticsApiClient = new AnalyticsApiClient();
export default analyticsApiClient;
