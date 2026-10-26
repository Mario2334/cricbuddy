// Raw CricHeroes payload shapes (only the fields we read). Numbers sometimes arrive as strings.

export interface RawInningsSummary {
  inning?: number | string;
  team_id?: number | string;
  total_run?: number | string;
  total_wicket?: number | string;
  overs_played?: number | string;
  balls_played?: number | string;
  total_extra?: number | string;
  is_allout?: number | string;
  summary?: { score?: string; over?: string; ball?: string; rr?: string } | string;
}

export interface RawTeamMatch {
  match_id: number;
  status: string; // 'upcoming' | 'past' | 'live'
  team_a_id: number;
  team_a: string;
  team_b_id: number;
  team_b: string;
  team_a_logo?: string;
  team_b_logo?: string;
  ground_id: number;
  ground_name: string;
  city_id?: number;
  city_name?: string;
  match_start_time: string;
  match_end_time?: string;
  overs: number;
  match_type: string;
  match_type_id?: number;
  ball_type: string;
  winning_team_id: number | null;
  winning_team: string | null;
  match_result: string | null;
  win_by: string | null;
  toss_details: string | null;
  tournament_id?: number;
  tournament_name?: string;
  tournament_round_name?: string;
  team_a_summary?: string | null;
  team_b_summary?: string | null;
  team_a_innings?: RawInningsSummary[];
  team_b_innings?: RawInningsSummary[];
  match_summary?: unknown;
}

export interface RawTeamMatchPage {
  status: boolean;
  data: RawTeamMatch[];
  page?: { next?: string | null };
}

export interface RawBatting {
  player_id: number;
  name: string;
  runs?: number | string;
  balls?: number | string;
  '4s'?: number | string;
  '6s'?: number | string;
  SR?: number | string;
  batting_hand?: string;
  how_to_out?: string;
}

export interface RawBowling {
  player_id: number;
  name: string;
  overs?: number | string;
  balls?: number | string;
  maidens?: number | string;
  runs?: number | string;
  wickets?: number | string;
  '0s'?: number | string;
  wide?: number | string;
  noball?: number | string;
  economy_rate?: number | string;
  inning?: number | string;
}

export interface RawToBeBat {
  player_id: number;
  name: string;
}

export interface RawScorecardEntry {
  inning?: number | string;
  team_id?: number | string;
  batting?: RawBatting[];
  bowling?: RawBowling[];
  to_be_bat?: RawToBeBat[];
  fall_of_wicket?: { summary?: string } | null;
  extras?: unknown;
  partnership?: unknown;
  power_play?: unknown;
}

export interface RawPlayerInfo {
  team_id?: number;
  player_id?: number;
  player_name?: string;
  is_captain?: number;
  is_wicket_keeper?: number;
}

export interface RawScorecardTeam {
  id: number | string;
  name: string;
  short_name?: string;
  logo?: string;
  summary?: string;
  is_home_team?: number;
  captain_info?: RawPlayerInfo | null;
  wicket_keeper_info?: RawPlayerInfo | null;
  innings?: RawInningsSummary[];
  scorecard?: RawScorecardEntry[];
}

export interface RawScorecard {
  match_id: number | string;
  status?: string;
  match_type?: string;
  overs?: number | string;
  ball_type?: string;
  ground_id?: number | string;
  ground_name?: string;
  city_name?: string;
  start_datetime?: string;
  toss_details?: string;
  match_result?: string;
  winning_team?: string;
  win_by?: string;
  tournament_name?: string;
  tournament_round_name?: string;
  match_summary?: unknown;
  team_a: RawScorecardTeam;
  team_b: RawScorecardTeam;
}

export interface RawTeamPlayer {
  player_id: number;
  name: string;
  playing_role_id?: string | number;
  player_skill?: string;
  batting_hand?: string;
  bowling_type_id?: string | number;
  batter_category?: string;
  bowler_category?: string;
  is_captain?: number;
  is_played_last_match?: number;
  profile_photo?: string;
  team_name?: string;
}

export interface RawTeamStat {
  title: string;
  value: number | string;
}

export interface RawGround {
  ground_id: number | string;
  name: string;
  city_name?: string;
  pitch_types?: { id: number; text: string }[];
  shortest_boundary_length?: number | string | null;
  longest_boundary_length?: number | string | null;
  ground_type?: string | null;
  latitude?: string;
  longitude?: string;
  address?: string;
}

export interface RawEnvelope<T> {
  status: boolean;
  data: T;
  error?: { code?: number; message?: string };
}
