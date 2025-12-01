// Interface for match summary details
export interface MatchSummary {
  team_id: number;
  summary: string;
  short_summary: string;
  full_summary: string;
  rrr: string;
  target: string;
}

// Interface for team innings summary
export interface InningsSummary {
  score: string;
  over: string;
  ball: string;
  rr: string;
}

// Interface for team innings details
export interface TeamInnings {
  team_id: number;
  inning: number;
  inning_start_time: string;
  inning_end_time: string;
  is_declare: number;
  is_forfeited: number;
  is_followon: number;
  total_run: number;
  total_wicket: number;
  total_extra: number;
  overs_played: string;
  balls_played: number;
  revised_target: number;
  revised_overs: number;
  lead_by: number;
  trail_by: number;
  summary: InningsSummary;
}

// Interface for pagination
export interface PageInfo {
  next: string;
}

// Interface for sponsor data
export interface SponsorData {
  // Add sponsor fields as needed
}

// Interface for config
export interface MatchConfig {
  sponsor_data: SponsorData[];
}

// Main Match interface with complete API mapping
export interface Match {
  // Basic match identification
  match_id: number;
  id?: number; // Alternative naming

  // Match type and format
  match_type: string;
  match_format?: string; // Alternative naming for match_type
  match_type_id: number;
  is_super_over: number;
  match_event_type: string;
  match_event: string;
  match_inning: number;
  ball_type: string;
  current_inning: number;

  // Match timing
  match_start_time: string;
  start_time?: string; // Alternative naming for match_start_time
  match_end_time: string;
  created_date: string;
  created_by: number;

  // Location details
  city_id: number;
  city_name: string;
  ground_id: number;
  ground_name: string;
  latitude: number;
  longitude: number;

  // Match format details
  overs: number;
  balls: number | null;
  over_reduce: string;
  is_dl: number;
  is_vjd: number;
  type: number;

  // Match status and result
  status: 'upcoming' | 'live' | 'past' | string;
  winning_team_id: string;
  winning_team: string;
  match_result: string;
  win_by: string;

  // Team A details
  team_a_id: number;
  team_a: string;
  team1_name?: string; // Alternative naming convention
  team_a_logo: string;
  is_a_home_team: number;

  // Team B details
  team_b_id: number;
  team_b: string;
  team2_name?: string; // Alternative naming convention
  team_b_logo: string;
  is_b_home_team: number;

  // Player awards
  pom_player_id: number; // Player of the Match
  bba_player_id: number; // Best Batsman
  bbo_player_id: number; // Best Bowler

  // Tournament details
  tournament_id: string;
  tournament_name: string;
  tournament_round_name?: string;
  round_name?: string; // Alternative naming
  tournament_category_id: string;
  tournament_round_id: string;

  // Association details
  association_id: number | null;
  association_year_id: number | null;
  association_name: string;
  association_logo: string;

  // Streaming and media
  steaming_url: string;
  is_ticker: number;
  is_enable_tournament_streaming: number;
  is_enable_match_streaming: number;
  is_video_analyst: number;
  is_backend_match: number;

  // Match settings
  is_fake_match: number;
  is_live_match_enable_in_web: number;
  is_live_match_enable_in_app: number;
  match_category_name: string;
  is_having_ai_commentary: number;
  is_watch_live: number;
  is_in_review: number;
  index: number;

  // Match summary and scores
  match_summary: MatchSummary;
  team_a_summary: string;
  team_a_innings: TeamInnings[];
  team_b_summary: string;
  team_b_innings: TeamInnings[];
  toss_details: string;

  // Legacy support for existing code
  team1?: {
    id: number;
    name: string;
    short_name: string;
  };
  team2?: {
    id: number;
    name: string;
    short_name: string;
  };
  // Mini score information for live and past matches
  team1_score?: {
    runs: number;
    wickets: number;
    overs: string;
    summary?: string; // e.g., "150/5 (18.2 ov)"
  };
  team2_score?: {
    runs: number;
    wickets: number;
    overs: string;
    summary?: string; // e.g., "120/8 (20.0 ov)"
  };
}

// Interface for the complete API response
export interface TeamMatchResponse {
  status: boolean;
  page: PageInfo;
  data: Match[];
  config: MatchConfig;
}

export interface ScheduledMatch {
  matchId: string;
  tournamentName: string;
  teamNames: {
    team1: string;
    team2: string;
  };
  groundName?: string;
  groundId?: number;
  city?: string;
  matchStartTime?: string;
  matchType?: string;
  overs?: number;
  scheduledAt: string;
}
