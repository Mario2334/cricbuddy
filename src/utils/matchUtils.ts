import { StyleSheet } from 'react-native';

export const formatMatchTime = (timeString: string): string => {
  if (!timeString) return 'Time TBD';
  try {
    const date = new Date(timeString);
    const dateStr = date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${dateStr} at ${timeStr}`;
  } catch (error) {
    console.error('Error formatting match time:', error);
    return 'Time TBD';
  }
};

export const getMatchStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'live':
      return '#e74c3c'; // Red for live matches
    case 'completed':
    case 'past':
      return '#2ecc71'; // Green for completed/past matches
    case 'upcoming':
      return '#3498db'; // Blue for upcoming matches
    default:
      return '#95a5a6'; // Gray for unknown status
  }
};

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
  const scorePattern = /(\d+)[\/\-](\d+)/g;
  const matches = matchResult.match(scorePattern);

  if (matches && matches.length > 0) {
    // For now, return a basic structure - this would need more sophisticated parsing
    // based on the actual format of match results from the API
    const firstScore = matches[0].split(/[\/\-]/);
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

export const getMatchCardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tournamentName: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  matchTime: {
    fontSize: 12,
    color: '#95a5a6',
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  vsText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginHorizontal: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
