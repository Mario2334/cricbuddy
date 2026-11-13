import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpError, readJson, type Router } from './router';
import { CalendarRepo, validateMatch } from '../grist/calendar';
import type { AppDeps } from './routes';
const patterns = [ /^\/match\/get-my-web-Matches$/, /^\/scorecard\/get-scorecard\/[1-9]\d{0,14}$/, /^\/player\/get-player-(?:statistic|match)\/[1-9]\d{0,14}$/, /^\/team\/get-team-(?:match|players|statistic)\/[1-9]\d{0,14}$/, /^\/booking\/get-ground-detail\/[1-9]\d{0,14}$/, /^\/looking\/get-looking-for-feed$/ ];
export function proxyPath(raw: string): string {
  const u = new URL(raw, 'https://api.cricheroes.in');
  if (!['api.cricheroes.in', 'cricheroes.in'].includes(u.hostname) || u.username || u.password || u.port) throw new HttpError(400, 'Unsupported upstream');
  const p = u.pathname.replace(/^\/api\/v1/, '').replace(/^\/api\/cricheroes/, '');
  if (!patterns.some(re => re.test(p))) throw new HttpError(400, 'Unsupported CricHeroes route');
  for (const [key, value] of u.searchParams) {
    if (!['pagesize','pageno','datetime','teamId','cityid','typeid','skill_level','team_type','ball_type'].includes(key) || value.length > 100) throw new HttpError(400, 'Unsupported query');
    if (['pagesize','pageno','teamId','cityid','typeid'].includes(key) && (!/^[1-9]\d*$/.test(value) || Number(value) > (key === 'pagesize' ? 100 : key === 'pageno' ? 10000 : Number.MAX_SAFE_INTEGER))) throw new HttpError(400, 'Invalid pagination or ID');
  }
  return p + u.search;
}
export function normalizePages(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (value.page) for (const key of ['next','previous']) if (value.page[key]) {
    try { value.page[key] = '/api/cricheroes' + proxyPath(value.page[key]); } catch { value.page[key] = ''; }
  }
  return value;
}
export function addPwaRoutes(r: Router, deps: AppDeps, calendar: CalendarRepo) {
  r.add('GET', '/api/session', ({user}) => ({ user }));
  r.add('GET', '/api/calendar/matches', async ({user}) => ({ matches: await calendar.list(user!) }));
  r.add('PUT', '/api/calendar/matches/:id', async ({user,params,req}) => {
    const match = validateMatch(await readJson(req));
    if (match.matchId !== params.id) throw new HttpError(400, 'Match ID mismatch');
    return calendar.put(user!, params.id, match);
  });
  r.add('DELETE', '/api/calendar/matches/:id', ({user,params}) => {
    if (!/^[1-9]\d{0,14}$/.test(params.id)) throw new HttpError(400, 'Invalid match ID');
    return calendar.put(user!,params.id,null);
  });
  r.add('POST', '/api/calendar/import', async ({user,req}) => {
    const body = await readJson(req) as any;
    if (!Array.isArray(body?.matches) || body.matches.length > 1000) throw new HttpError(400, 'Expected matches');
    return calendar.import(user!,body.matches.map(validateMatch));
  });
  for (const p of ['/match/get-my-web-Matches','/scorecard/get-scorecard/:id','/player/get-player-statistic/:id','/player/get-player-match/:id','/team/get-team-match/:id','/team/get-team-players/:id','/team/get-team-statistic/:id','/booking/get-ground-detail/:id','/looking/get-looking-for-feed']) {
    r.add('GET', '/api/cricheroes'+p, async ({params,query}) => {
      const route = proxyPath(p.replace(':id',params.id ?? '') + (query.size ? '?'+query : ''));
      return normalizePages(await deps.ch.get(route));
    });
  }
  r.add('GET','/api/places/search',async ({query}) => {
    const q = query.get('query')?.trim(); if (!q || q.length > 300) throw new HttpError(400,'Invalid query');
    if (!process.env.GOOGLE_PLACES_API_KEY) throw new HttpError(503,'Places unavailable');
    const response = await fetch('https://maps.googleapis.com/maps/api/place/textsearch/json?'+ new URLSearchParams({query:q,key:process.env.GOOGLE_PLACES_API_KEY}),{signal:AbortSignal.timeout(15000),redirect:'error'});
    if (!response.ok) throw new HttpError(502,'Places request failed');
    const result = await response.json() as {status?: string};
    if (!['OK','ZERO_RESULTS'].includes(result.status ?? '')) throw new HttpError(503,'Places provider unavailable; use ground-name map search','provider_unavailable');
    return result;
  });
  r.add('POST','/api/feed/query',async ({req}) => {
    if (!process.env.OPENROUTER_API_KEY) throw new HttpError(503,'Natural language search unavailable','unavailable');
    const body = await readJson(req,10000) as any;
    if (!Array.isArray(body?.messages) || body.messages.length > 2 || body.messages.some((m:any) => !['system','user'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 6000)) throw new HttpError(400,'Invalid query');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENROUTER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',messages:body.messages,max_tokens:500,temperature:0.1}),signal:AbortSignal.timeout(30000),redirect:'error'});
    if (!response.ok) throw new HttpError(502,'Search provider unavailable');
    return response.json();
  });
}
export function checkBrowserWrite(req: IncomingMessage, origin: string) {
  if (['GET','HEAD','OPTIONS'].includes(req.method ?? 'GET')) return;
  if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403,'Cross-origin writes forbidden');
}
const mime: Record<string,string> = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml','.css':'text/css'};
export async function serveFrontend(req: IncomingMessage, res: ServerResponse, pathname: string, root: string) {
  if (!['GET','HEAD'].includes(req.method ?? '')) throw new HttpError(404,'Not found');
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) throw new HttpError(400,'Invalid path');
  let file = path.join(root, decoded === '/' ? 'index.html' : decoded);
  try { if (!(await fs.stat(file)).isFile()) throw new Error(); } catch {
    if (path.extname(decoded) || !/^\/(?:match\/\d+|find|stats(?:\/(?:Batting|Bowling|Fielding|Captain))?|team(?:\/match\/\d+)?|calendar(?:\/match\/\d+)?)?\/?$/.test(decoded)) throw new HttpError(404,'Not found');
    file = path.join(root,'index.html');
  }
  const data = await fs.readFile(file);
  res.writeHead(200,{'content-type':mime[path.extname(file)] ?? 'application/octet-stream','cache-control':file.includes('/assets/') || file.includes('/_expo/') ? 'private, max-age=31536000, immutable' : 'no-cache','x-content-type-options':'nosniff','referrer-policy':'same-origin'});
  res.end(req.method === 'HEAD' ? undefined : data);
}
