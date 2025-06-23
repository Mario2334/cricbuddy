export interface Match {
  id: number;
  match_id?: number;
  tournament_name: string;
  tournament_round_name?: string;
  round_name?: string;  // Alternative naming
  status: 'upcoming' | 'live' | 'past' | string;
  team_a: string;
  team_b: string;
  team1_name?: string;  // Alternative naming convention
  team2_name?: string;  // Alternative naming convention
  match_summary?: { summary?: string };
  match_type: string;
  match_format?: string;  // Alternative naming for match_type
  overs: number;
  ground_name: string;
  match_start_time: string;
  start_time?: string;  // Alternative naming for match_start_time
  match_result?: string;  // Match result text
  // Add other properties used in the app
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
  // Add more properties as needed
}
