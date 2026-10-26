import type http from 'node:http';
import { HttpError } from './router';

export const AUTH_HEADER = 'tailscale-user-login';

/** The tailnet identity `tailscale serve` injects; null when the request did not come through it. */
export function tailnetUser(req: http.IncomingMessage): string | null {
  const v = req.headers[AUTH_HEADER];
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.trim().toLowerCase() : null;
}

/** Allow only known logins. `['*']` turns the check off (local development). */
export function requireTailnetUser(req: http.IncomingMessage, allowed: string[]): string | null {
  if (allowed.includes('*')) return tailnetUser(req);
  const user = tailnetUser(req);
  if (!user) throw new HttpError(401, 'No tailnet identity on this request', 'no_identity');
  if (!allowed.includes(user)) throw new HttpError(403, `${user} is not allowed here`, 'forbidden');
  return user;
}
