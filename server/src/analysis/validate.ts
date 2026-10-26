import type { AiReport, AnalysisFacts, Confidence, Phase, Role } from '../types';

export type Validation = { ok: true; report: AiReport } | { ok: false; errors: string[] };

const ROLES: Role[] = ['batter', 'bowler', 'all-rounder', 'wicket-keeper'];
const PHASES: Phase[] = ['powerplay', 'middle', 'death'];
const CONF: Confidence[] = ['low', 'medium', 'high'];
const LIMITS = { why: 200, summary: 800, headline: 140, listItem: 240 };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strings = (v: unknown, max: number): string[] => list(v).map(x => text(x, max)).filter(Boolean);

/**
 * Enforce what the JSON schema cannot: real players, 12 distinct picks, a full batting order, a bowling plan
 * that adds up, and a keeper when one is available. Names are rewritten from the pool so spellings match the app.
 */
export function validateReport(raw: unknown, facts: AnalysisFacts): Validation {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['answer is not a JSON object'] };
  const pool = new Map(facts.pool.map(p => [p.player_id, p]));
  const name = (id: number, fallback: unknown): string => pool.get(id)?.name ?? text(fallback, 80);

  // best_xii
  const xiiRaw = list(raw.best_xii);
  if (xiiRaw.length !== 12) errors.push(`best_xii must have 12 entries, got ${xiiRaw.length}`);
  const xii: AiReport['best_xii'] = [];
  const seen = new Set<number>();
  for (const e of xiiRaw) {
    if (!isObj(e)) continue;
    const id = int(e.player_id);
    if (id === null) {
      errors.push(`best_xii entry without a numeric player_id (${text(e.name, 40) || '?'})`);
      continue;
    }
    if (!pool.has(id)) errors.push(`best_xii has player_id ${id} (${text(e.name, 40)}) who is not in the pool`);
    if (seen.has(id)) errors.push(`best_xii lists player_id ${id} twice`);
    seen.add(id);
    const role = ROLES.includes(e.role as Role) ? (e.role as Role) : pool.get(id)?.role === 'unknown' ? 'batter' : (pool.get(id)?.role as Role) ?? 'batter';
    xii.push({ player_id: id, name: name(id, e.name), role, is_twelfth: e.is_twelfth === true, why: text(e.why, LIMITS.why) });
  }
  const twelfth = xii.filter(e => e.is_twelfth);
  if (twelfth.length !== 1) errors.push(`exactly one best_xii entry must have is_twelfth=true, got ${twelfth.length}`);
  const eleven = new Set(xii.filter(e => !e.is_twelfth).map(e => e.player_id));

  // keeper
  const keeperAvailable = facts.pool.some(p => p.role === 'wicket-keeper' || p.can_keep);
  if (keeperAvailable && ![...eleven].some(id => pool.get(id)?.role === 'wicket-keeper' || pool.get(id)?.can_keep)) {
    errors.push('the eleven has no wicket-keeper although a keeper-capable player is available');
  }

  // batting_order
  const orderRaw = list(raw.batting_order);
  const order: AiReport['batting_order'] = [];
  const positions = new Set<number>();
  const ordered = new Set<number>();
  for (const e of orderRaw) {
    if (!isObj(e)) continue;
    const id = int(e.player_id);
    const pos = int(e.position);
    if (id === null || pos === null) {
      errors.push('batting_order entry without numeric position/player_id');
      continue;
    }
    if (!eleven.has(id)) errors.push(`batting_order has player_id ${id} (${text(e.name, 40)}) who is not in the eleven`);
    if (positions.has(pos)) errors.push(`batting_order position ${pos} is used twice`);
    if (ordered.has(id)) errors.push(`batting_order lists player_id ${id} twice`);
    positions.add(pos);
    ordered.add(id);
    order.push({ position: pos, player_id: id, name: name(id, e.name), why: text(e.why, LIMITS.why) });
  }
  if (order.length !== 11) errors.push(`batting_order must have 11 entries, got ${order.length}`);
  for (let p = 1; p <= 11; p += 1) if (order.length === 11 && !positions.has(p)) errors.push(`batting_order is missing position ${p}`);
  order.sort((a, b) => a.position - b.position);

  // bowling_plan
  const planRaw = isObj(raw.bowling_plan) ? raw.bowling_plan : {};
  const bowlers: AiReport['bowling_plan']['bowlers'] = [];
  let total = 0;
  const maxPer = facts.gaps.max_overs_per_bowler;
  for (const e of list(planRaw.bowlers)) {
    if (!isObj(e)) continue;
    const id = int(e.player_id);
    const overs = int(e.overs);
    if (id === null || overs === null) {
      errors.push('bowling_plan entry without numeric overs/player_id');
      continue;
    }
    if (!eleven.has(id)) errors.push(`bowling_plan has player_id ${id} (${text(e.name, 40)}) who is not in the eleven`);
    if (overs < 1) errors.push(`bowling_plan gives ${name(id, e.name)} ${overs} overs`);
    if (overs > maxPer) errors.push(`bowling_plan gives ${name(id, e.name)} ${overs} overs; the maximum is ${maxPer}`);
    total += overs;
    const phases = list(e.phases).filter((p): p is Phase => PHASES.includes(p as Phase));
    bowlers.push({ player_id: id, name: name(id, e.name), overs, phases: phases.length ? phases : ['middle'], why: text(e.why, LIMITS.why) });
  }
  if (total !== facts.match.overs) errors.push(`bowling_plan overs add up to ${total}, the match has ${facts.match.overs}`);

  // prose sections
  const opp = isObj(raw.opposition) ? raw.opposition : {};
  const gaps = isObj(raw.squad_gaps) ? raw.squad_gaps : {};
  const gp = isObj(raw.ground_pitch) ? raw.ground_pitch : {};
  const headline = text(raw.headline, LIMITS.headline);
  if (!headline) errors.push('headline is empty');
  const oppSummary = text(opp.summary, LIMITS.summary);
  if (!oppSummary) errors.push('opposition.summary is empty');
  const batChase = ['bat', 'chase', 'either'].includes(gp.bat_first_or_chase as string) ? (gp.bat_first_or_chase as 'bat' | 'chase' | 'either') : null;
  if (!batChase) errors.push('ground_pitch.bat_first_or_chase must be bat, chase or either');

  if (errors.length) return { ok: false, errors };

  const report: AiReport = {
    headline,
    opposition: {
      summary: oppSummary,
      likely_approach: text(opp.likely_approach, LIMITS.summary),
      key_threats: list(opp.key_threats)
        .filter(isObj)
        .map(t => ({ player_id: int(t.player_id), name: text(t.name, 80), role: text(t.role, 40), why: text(t.why, LIMITS.why) }))
        .filter(t => t.name),
      weaknesses: strings(opp.weaknesses, LIMITS.listItem),
    },
    best_xii: xii,
    batting_order: order,
    bowling_plan: { overs_total: facts.match.overs, bowlers, notes: text(planRaw.notes, LIMITS.summary) },
    squad_gaps: { summary: text(gaps.summary, LIMITS.summary), needs: strings(gaps.needs, LIMITS.listItem), risks: strings(gaps.risks, LIMITS.listItem) },
    ground_pitch: { summary: text(gp.summary, LIMITS.summary), par_score: int(gp.par_score), bat_first_or_chase: batChase as 'bat' | 'chase' | 'either', why: text(gp.why, LIMITS.why) },
    toss_call: text(raw.toss_call, LIMITS.listItem),
    confidence: CONF.includes(raw.confidence as Confidence) ? (raw.confidence as Confidence) : 'medium',
  };
  return { ok: true, report };
}

/** The feedback appended to the prompt for the one retry. */
export function retryFeedback(errors: string[]): string {
  return `\n\nYour previous answer was rejected by the checker:\n- ${errors.slice(0, 12).join('\n- ')}\nFix exactly these and reply again with the complete JSON object.`;
}
