// Grist REST client. Grist trusts the forward-auth header (GRIST_FORWARD_AUTH_HEADER=Tailscale-User-Login):
// on the host we set it ourselves against http://127.0.0.1:8484; through `tailscale serve` it is injected.
export class GristError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface GristRow {
  id: number;
  fields: Record<string, unknown>;
}

export interface GristColumn {
  id: string;
  fields: { label: string; type: string; widgetOptions?: string; isFormula?: boolean; formula?: string };
}

export interface GristClientConfig {
  url: string;
  docId: string;
  user: string;
  apiKey?: string | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const AUTH_HEADER = 'Tailscale-User-Login';

export class GristClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: GristClientConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.timeoutMs = cfg.timeoutMs ?? 30_000;
  }

  get docId(): string {
    return this.cfg.docId;
  }

  /** `path` is relative to `${url}/api`. */
  async call<T>(path: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.user) headers[AUTH_HEADER] = this.cfg.user;
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    const body = init?.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
    const res = await this.fetchFn(`${this.cfg.url}/api${path}`, {
      ...init,
      body,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new GristError(res.status, `Grist ${res.status} on ${init?.method ?? 'GET'} ${path}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  private get doc(): string {
    return `/docs/${this.cfg.docId}`;
  }

  async tables(): Promise<string[]> {
    const { tables } = await this.call<{ tables: { id: string }[] }>(`${this.doc}/tables`);
    return tables.map(t => t.id);
  }

  async columns(table: string): Promise<string[]> {
    const { columns } = await this.call<{ columns: { id: string }[] }>(`${this.doc}/tables/${table}/columns`);
    return columns.map(c => c.id);
  }

  async createTable(table: string, columns: GristColumn[]): Promise<void> {
    await this.call(`${this.doc}/tables`, { method: 'POST', body: { tables: [{ id: table, columns }] } });
  }

  async addColumns(table: string, columns: GristColumn[]): Promise<void> {
    if (!columns.length) return;
    await this.call(`${this.doc}/tables/${table}/columns`, { method: 'POST', body: { columns } });
  }

  async records(
    table: string,
    filter?: Record<string, unknown[]>,
    opts: { sort?: string; limit?: number } = {},
  ): Promise<GristRow[]> {
    const q = new URLSearchParams();
    if (filter && Object.keys(filter).length) q.set('filter', JSON.stringify(filter));
    if (opts.sort) q.set('sort', opts.sort);
    if (opts.limit) q.set('limit', String(opts.limit));
    const qs = q.toString();
    const { records } = await this.call<{ records: GristRow[] }>(`${this.doc}/tables/${table}/records${qs ? `?${qs}` : ''}`);
    return records;
  }

  async addRecords(table: string, rows: Record<string, unknown>[]): Promise<number[]> {
    if (!rows.length) return [];
    const out = await this.call<{ records: { id: number }[] }>(`${this.doc}/tables/${table}/records`, {
      method: 'POST',
      body: { records: rows.map(fields => ({ fields })) },
    });
    return out.records.map(r => r.id);
  }

  async patchRecords(table: string, rows: { id: number; fields: Record<string, unknown> }[]): Promise<void> {
    if (!rows.length) return;
    await this.call(`${this.doc}/tables/${table}/records`, { method: 'PATCH', body: { records: rows } });
  }

  async deleteRecords(table: string, ids: number[]): Promise<void> {
    if (!ids.length) return;
    await this.call(`${this.doc}/tables/${table}/data/delete`, { method: 'POST', body: ids });
  }

  async healthy(): Promise<boolean> {
    try {
      await this.tables();
      return true;
    } catch {
      return false;
    }
  }

  // ── Org / workspace helpers (used by scripts/setup-grist) ──────────────────────────────
  async orgs(): Promise<{ id: number; name: string; domain: string }[]> {
    return this.call('/orgs');
  }

  async workspaces(org: string | number): Promise<{ id: number; name: string; docs: { id: string; name: string }[] }[]> {
    return this.call(`/orgs/${org}/workspaces`);
  }

  async createWorkspace(org: string | number, name: string): Promise<number> {
    return this.call(`/orgs/${org}/workspaces`, { method: 'POST', body: { name } });
  }

  async createDoc(workspaceId: number, name: string): Promise<string> {
    return this.call(`/workspaces/${workspaceId}/docs`, { method: 'POST', body: { name } });
  }
}

// ── Cell helpers: Grist Date/DateTime cells are epoch seconds; an empty Numeric reads as 0. ──
export const toEpoch = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};
export const fromEpoch = (v: unknown, dateOnly = false): string | null => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) return null;
  const iso = new Date(v * 1000).toISOString();
  return dateOnly ? iso.slice(0, 10) : iso;
};
export const nowEpoch = (): number => Math.floor(Date.now() / 1000);
export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const bool = (v: unknown): boolean => v === true || v === 1 || v === 'true';
export const json = <T>(v: unknown): T | null => {
  if (typeof v !== 'string' || !v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
};
