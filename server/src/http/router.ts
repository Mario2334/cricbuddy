import type http from 'node:http';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Return one of these from a handler for a non-200 success (e.g. 202 Accepted). */
export class Reply {
  constructor(public status: number, public body: unknown) {}
}

export interface Ctx {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  user: string | null;
}

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

interface Route {
  method: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
}

/** Tiny method + ':param' router (Node 20 has no URLPattern). */
export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    const keys: string[] = [];
    const src = pattern
      .split('/')
      .map(seg => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({ method: method.toUpperCase(), re: new RegExp(`^${src}/?$`), keys, handler });
    return this;
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method.toUpperCase()) continue;
      const m = r.re.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return null;
  }
}

export async function readJson(req: http.IncomingMessage, limit = 1_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(buf);
  }
  if (!size) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body is not valid JSON');
  }
}

export function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body ?? null);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  res.end(text);
}

/** Parse ':id'-style params that must be positive integers. */
export function intParam(params: Record<string, string>, key: string): number {
  const n = Number(params[key]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${key} must be a positive integer`);
  return n;
}
