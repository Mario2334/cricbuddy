import { Match } from '../types/Match';
import { StyleSheet } from 'react-native';

export const formatMatchTime = (timeString: string): string => {
  if (!timeString) return 'Time TBD';
  try {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      return '#2ecc71'; // Green for completed matches
    case 'upcoming':
      return '#3498db'; // Blue for upcoming matches
    default:
      return '#95a5a6'; // Gray for unknown status
  }
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
