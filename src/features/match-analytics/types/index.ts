/**
 * API contract between cricbuddy-api (server/src/types.ts) and the CricBuddy app.
 * This file is a verbatim copy of the server one (plus GamePlanMatch at the bottom): keep both in sync.
 */

export type AvailabilityStatus = 'yes' | 'maybe' | 'no' | 'unknown';
export type Role = 'batter' | 'bowler' | 'all-rounder' | 'wicket-keeper' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';
export type JobStatus = 'queued' | 'fetching' | 'thinking' | 'done' | 'failed';
export type RosterOverride = 'auto' | 'include' | 'exclude';
export type PosBucket = 'top' | 'middle' | 'lower';
export type Phase = 'powerplay' | 'middle' | 'death';
export type MatchResult = 'won' | 'lost' | 'tie' | 'nr';

export interface BattingAgg {
  inns: number;
  runs: number;
  balls: number;
  outs: number;
  hs: number;
  avg: number | null;
  sr: number | null;
  fours: number;
  sixes: number;
  positions: number[];
  usual_pos: number | null;
  pos_bucket: PosBucket | null;
  opened: number;
  /** e.g. "34(21)", newest first */
  recent: string[];
}

export interface BowlingAgg {
  inns: number;
  balls: number;
  runs: number;
  wkts: number;
  maidens: number;
  econ: number | null;
  avg: number | null;
  best: string | null;
  /** e.g. "2/18 (4)", newest first */
  recent: string[];
}

export interface PlayerAgg {
  player_id: number;
  name: string;
  appearances: number;
  batting: BattingAgg;
  bowling: BowlingAgg;
  /** matches in which the player kept wicket */
  kept: number;
  /** innings bowled / appearances */
  bowl_rate: number;
}

export interface RosterPlayer {
  player_id: number;
  name: string;
  photo: string | null;
  hand: string | null;
  skill_hint: string | null;
  role: Role;
  confidence: Confidence;
  can_keep: boolean;
  part_time_bowler: boolean;
  in_roster: boolean;
  override: RosterOverride;
  last_played: string | null;
  agg: PlayerAgg | null;
}

export interface AvailabilityEntry {
  player_id: number;
  status: AvailabilityStatus;
  note: string;
  updated_at: string | null;
}

export type GapCode = 'SHORT_OF_11' | 'NO_KEEPER' | 'FEW_BOWLERS' | 'TOO_MANY_BATTERS' | 'NO_OPENERS' | 'RELIES_ON_MAYBE';
export type Severity = 'high' | 'medium' | 'low';

export interface GapIssue {
  code: GapCode;
  severity: Severity;
  message: string;
}

export interface SquadGaps {
  yes: number;
  maybe: number;
  no: number;
  counts: { batters: number; bowlers: number; allrounders: number; keepers: number };
  bowling_options: number;
  overs: number;
  max_overs_per_bowler: number;
  issues: GapIssue[];
}

export interface MatchCtx {
  match_id: number;
  status: string;
  start: string | null;
  overs: number;
  ball_type: string | null;
  match_type: string | null;
  tournament: string | null;
  our_team_id: number;
  our_team: string;
  opponent_team_id: number;
  opponent_name: string;
  ground_id: number | null;
  ground_name: string | null;
  city: string | null;
}

export interface MatchLine {
  match_id: number;
  date: string;
  opponent: string;
  result: MatchResult;
  batted_first: boolean | null;
  our_score: string;
  their_score: string;
  margin: string;
  ground: string;
}

export interface GroundMatchLine {
  match_id: number;
  date: string;
  team_a: string;
  team_b: string;
  first_inns: string;
  second_inns: string;
  winner: string | null;
  chased: boolean | null;
}

export interface GroundInfo {
  id: number;
  name: string;
  city: string | null;
  pitch_types: string[];
  shortest_boundary: number | null;
  longest_boundary: number | null;
  ground_type: string | null;
}

export interface TeamTotals {
  matches: number;
  won: number;
  lost: number;
  win_pct: string;
  toss_won: number;
  bat_first: number;
  field_first: number;
}

export interface OppositionFacts {
  id: number;
  name: string;
  totals: TeamTotals | null;
  last5: MatchLine[];
  aggregates: {
    avg_bat_first: number | null;
    avg_chasing: number | null;
    wins_bat_first: number;
    wins_chasing: number;
    avg_wkts_lost: number | null;
  };
  batters: PlayerAgg[];
  bowlers: PlayerAgg[];
  captain: string | null;
  keeper: string | null;
}

export interface GroundFacts {
  sample: number;
  matches: GroundMatchLine[];
  aggregates: {
    avg_first_inns: number | null;
    avg_second_inns: number | null;
    bat_first_wins: number;
    chase_wins: number;
    highest: number | null;
    lowest: number | null;
    avg_wkts_first_inns: number | null;
  };
  our_record: { played: number; won: number; lost: number };
}

export interface PoolPlayer extends RosterPlayer {
  availability: 'yes' | 'maybe';
}

export interface AnalysisFacts {
  generated_at: string;
  match: MatchCtx;
  ground_info: GroundInfo | null;
  our_team: { id: number; name: string; last10: MatchLine[]; vs_opponent: MatchLine[] };
  opposition: OppositionFacts;
  ground: GroundFacts | null;
  pool: PoolPlayer[];
  unavailable: { player_id: number; name: string; role: Role }[];
  gaps: SquadGaps;
  availability_known: boolean;
}

export interface AiReport {
  headline: string;
  opposition: {
    summary: string;
    likely_approach: string;
    key_threats: { player_id: number | null; name: string; role: string; why: string }[];
    weaknesses: string[];
  };
  best_xii: { player_id: number; name: string; role: Role; is_twelfth: boolean; why: string }[];
  batting_order: { position: number; player_id: number; name: string; why: string }[];
  bowling_plan: {
    overs_total: number;
    bowlers: { player_id: number; name: string; overs: number; phases: Phase[]; why: string }[];
    notes: string;
  };
  squad_gaps: { summary: string; needs: string[]; risks: string[] };
  ground_pitch: { summary: string; par_score: number | null; bat_first_or_chase: 'bat' | 'chase' | 'either'; why: string };
  toss_call: string;
  confidence: Confidence;
}

export interface AnalysisJob {
  id: number;
  match_id: number;
  status: JobStatus;
  requested_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  headline: string | null;
  facts: AnalysisFacts | null;
}

export interface AnalysisReport {
  id: number;
  facts: AnalysisFacts;
  ai: AiReport;
  finished_at: string | null;
  model: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  grist: boolean;
  codex_bin: boolean;
  queue: { active: number };
}

export interface PlayersResponse {
  players: RosterPlayer[];
  roster_count: number;
  updated_at: string | null;
}

export interface AvailabilityResponse {
  match: MatchCtx;
  players: RosterPlayer[];
  entries: AvailabilityEntry[];
  gaps: SquadGaps;
}

export interface AvailabilityPutBody {
  entries: { player_id: number; status: AvailabilityStatus; note?: string }[];
}

export interface AnalysisPostBody {
  hint?: { team_a_id?: number; team_b_id?: number; ground_id?: number; overs?: number; match_start_time?: string };
}

export interface AnalysisResponse {
  job: AnalysisJob | null;
  report: AnalysisReport | null;
  stale: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

// ── App-only ──────────────────────────────────────────────────────────────────────────────────

/** What the Game plan tab needs from MatchDetail about the match it is showing. */
export interface GamePlanMatch {
  matchId: string;
  ourTeamId: number;
  opponentTeamId: number | null;
  opponentName: string;
  groundId?: number;
  groundName?: string;
  overs?: number;
  startTime?: string;
}
