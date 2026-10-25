import { formatShortDate, formatTime, toDate } from './dates';
import { statusColors } from '../theme/colors';
import { normalizeStatus } from './matchDisplay';

export const formatMatchTime = (timeString: string | undefined | null): string => {
  const date = toDate(timeString);
  if (!date) return 'Time TBD';
  return `${formatShortDate(date)} at ${formatTime(date)}`;
};

export const getMatchStatusColor = (status: string): string => statusColors[normalizeStatus(status)].dot;

/**
 * Format mini score for display in match lists
 * @param runs - Number of runs scored
 * @param wickets - Number of wickets lost
 * @param overs - Overs played (e.g., "18.2")
 * @returns Formatted score string (e.g., "150/5 (18.2)")
 */
export const formatMiniScore = (runs: number, wickets: number, overs: string): string => {
  return `${runs}/${wickets} (${overs})`;
};

/**
 * Extract basic score information from match result string
 * This is a fallback method to extract scores when detailed score data is not available
 * @param matchResult - Match result string (e.g., "Team A won by 25 runs")
 * @param teamName - Team name to look for in the result
 * @returns Basic score object or null if not extractable
 */
export const extractScoreFromResult = (matchResult: string, teamName: string): { runs: number; wickets: number; overs: string } | null => {
  if (!matchResult || !teamName) return null;

  // Try to extract score patterns like "150/5" or "150-5"
  const scorePattern = /(\d+)[/-](\d+)/g;
  const matches = matchResult.match(scorePattern);

  if (matches && matches.length > 0) {
    // For now, return a basic structure - this would need more sophisticated parsing
    // based on the actual format of match results from the API
    const firstScore = matches[0].split(/[/-]/);
    if (firstScore.length === 2) {
      return {
        runs: parseInt(firstScore[0]),
        wickets: parseInt(firstScore[1]),
        overs: "20.0" // Default for T20, would need actual overs data
      };
    }
  }

  return null;
};

/**
 * Check if a match should display mini scores
 * @param status - Match status
 * @returns True if mini scores should be displayed
 */
export const shouldShowMiniScore = (status: string): boolean => {
  return status === 'live' || status === 'past' || status === 'completed';
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, ScheduledMatch } from '../types/Match';

export const convertScheduledMatchToMatch = (scheduledMatch: ScheduledMatch): Match => {
  const now = new Date();
  const startTime = new Date(scheduledMatch.matchStartTime || now);
  // Assume 4 hours duration for status inference if not provided
  const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);

  let status = 'upcoming';
  if (now > endTime) {
    status = 'past';
  } else if (now >= startTime) {
    status = 'live';
  }

  return {
    match_id: parseInt(scheduledMatch.matchId) || 0,
    id: parseInt(scheduledMatch.matchId) || 0,
    tournament_name: scheduledMatch.tournamentName,
    team_a: scheduledMatch.teamNames.team1,
    team_b: scheduledMatch.teamNames.team2,
    team1_name: scheduledMatch.teamNames.team1,
    team2_name: scheduledMatch.teamNames.team2,
    ground_name: scheduledMatch.groundName || '',
    ground_id: scheduledMatch.groundId || 0,
    city_name: scheduledMatch.city || '',
    match_start_time: scheduledMatch.matchStartTime || new Date().toISOString(),
    start_time: scheduledMatch.matchStartTime || new Date().toISOString(),
    match_type: scheduledMatch.matchType || 'T20',
    overs: scheduledMatch.overs || 20,
    status: status,
    // Required fields with default values
    match_type_id: 0,
    is_super_over: 0,
    match_event_type: '',
    match_event: '',
    match_inning: 0,
    ball_type: 'White',
    current_inning: 0,
    match_end_time: '',
    created_date: scheduledMatch.scheduledAt,
    created_by: 0,
    city_id: 0,
    latitude: 0,
    longitude: 0,
    balls: null,
    over_reduce: '',
    is_dl: 0,
    is_vjd: 0,
    type: 0,
    winning_team_id: '',
    winning_team: '',
    match_result: '',
    win_by: '',
    team_a_id: 0,
    team_a_logo: '',
    is_a_home_team: 0,
    team_b_id: 0,
    team_b_logo: '',
    is_b_home_team: 0,
    pom_player_id: 0,
    bba_player_id: 0,
    bbo_player_id: 0,
    tournament_id: '',
    tournament_category_id: '',
    tournament_round_id: '',
    association_id: null,
    association_year_id: null,
    association_name: '',
    association_logo: '',
    steaming_url: '',
    is_ticker: 0,
    is_enable_tournament_streaming: 0,
    is_enable_match_streaming: 0,
    is_video_analyst: 0,
    is_backend_match: 0,
    is_fake_match: 0,
    is_live_match_enable_in_web: 0,
    is_live_match_enable_in_app: 0,
    match_category_name: '',
    is_having_ai_commentary: 0,
    is_watch_live: 0,
    is_in_review: 0,
    index: 0,
    match_summary: {
      team_id: 0,
      summary: '',
      short_summary: '',
      full_summary: '',
      rrr: '',
      target: ''
    },
    team_a_summary: '',
    team_a_innings: [],
    team_b_summary: '',
    team_b_innings: [],
    toss_details: ''
  };
};

export const getLocalScheduledMatches = async (): Promise<Match[]> => {
  try {
    const matchesData = await AsyncStorage.getItem('scheduledMatches');
    if (matchesData) {
      const parsedMatches: ScheduledMatch[] = JSON.parse(matchesData);
      return parsedMatches.map(convertScheduledMatchToMatch);
    }
    return [];
  } catch (error) {
    console.error('Error loading scheduled matches:', error);
    return [];
  }
};
