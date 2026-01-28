import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import MatchCalendar from '../components/MatchCalendar';
import type { Match, ScheduledMatch } from '../types/Match';
import apiService from '../services/apiService';
import { convertScheduledMatchToMatch } from '../utils/matchUtils';



const CalendarScreen: React.FC = () => {
  const [scheduledMatches, setScheduledMatches] = useState<ScheduledMatch[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>('');
  const [fetchingMatchDetails, setFetchingMatchDetails] = useState<boolean>(false);
  const navigation = useNavigation();

  const [fetchedMatchDetails, setFetchedMatchDetails] = useState<ScheduledMatch | null>(null);
  const [manualDate, setManualDate] = useState<string>('');

  const loadScheduledMatches = async () => {
    try {
      const matchesData = await AsyncStorage.getItem('scheduledMatches');
      if (matchesData) {
        const parsedMatches = JSON.parse(matchesData);
        // Sort matches by match start time
        const sortedMatches = parsedMatches.sort((a: ScheduledMatch, b: ScheduledMatch) => {
          if (!a.matchStartTime || !b.matchStartTime) return 0;
          return new Date(a.matchStartTime).getTime() - new Date(b.matchStartTime).getTime();
        });
        setScheduledMatches(sortedMatches);

        // Convert to Match format for MatchCalendar component
        const convertedMatches = sortedMatches.map(convertScheduledMatchToMatch);
        setMatches(convertedMatches);
      } else {
        setScheduledMatches([]);
        setMatches([]);
      }
    } catch (error) {
      console.error('Error loading scheduled matches:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load scheduled matches. Please try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFromSchedule = async (matchId: string) => {
    try {
      const matches = await AsyncStorage.getItem('scheduledMatches');
      if (matches) {
        let parsedMatches = JSON.parse(matches);
        parsedMatches = parsedMatches.filter((match: ScheduledMatch) => match.matchId !== matchId);
        await AsyncStorage.setItem('scheduledMatches', JSON.stringify(parsedMatches));
        setScheduledMatches(parsedMatches);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Match removed from schedule.',
          position: 'bottom',
          visibilityTime: 2000
        });
      }
    } catch (error) {
      console.error('Error removing match from schedule:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove match from schedule. Please try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
    }
  };

  const confirmRemoveMatch = (matchId: string, teamNames: { team1: string; team2: string }) => {
    Alert.alert(
      'Remove Match',
      `Are you sure you want to remove "${teamNames.team1} vs ${teamNames.team2}" from your schedule?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromSchedule(matchId) }
      ]
    );
  };

  const handleMatchPress = useCallback((match: Match) => {
    const matchId = match.id || match.match_id;
    if (matchId) {
      navigation.navigate('MatchDetail' as never, {
        matchId: matchId.toString(),
        tournamentName: match.tournament_name || 'Match',
        teamNames: {
          team1: match.team1_name || match.team_a || 'Team 1',
          team2: match.team2_name || match.team_b || 'Team 2',
        },
        groundName: match.ground_name,
        groundId: match.ground_id,
        city: match.city_name,
        matchStartTime: match.match_start_time || match.start_time,
        defaultTab: 'info',
      } as never);
    }
  }, [navigation]);

  const handleRemoveMatch = useCallback((match: Match) => {
    const matchId = (match.id || match.match_id)?.toString();
    if (matchId) {
      const teamNames = {
        team1: match.team1_name || match.team_a || 'Team 1',
        team2: match.team2_name || match.team_b || 'Team 2',
      };
      confirmRemoveMatch(matchId, teamNames);
    }
  }, []);

  const onRefresh = () => {
    loadScheduledMatches();
  };

  /**
   * Handle FAB press - show options for scheduling
   */
  const handleFabPress = () => {
    setShowUrlModal(true);
  };

  // Parse CricHeroes URL to extract match information
  const parseCricHeroesUrl = (url: string) => {
    try {
      // Expected format: https://cricheroes.in/scorecard/18599605/Virat-Cup-T30-Edition-3/Vikings-Inspired-vs-AVENGERZ-XI
      // Also supports .com and other variations
      const urlPattern = /https?:\/\/(?:www\.)?cricheroes\.(?:in|com)\/scorecard\/(\d+)\/([^\/]+)\/([^\/]+)/;
      const match = url.match(urlPattern);

      if (!match) {
        throw new Error('Invalid CricHeroes URL format');
      }

      const [, matchId, tournamentName, teamsString] = match;

      // Parse team names from the URL (format: Team1-vs-Team2)
      const teamsParts = teamsString.split('-vs-');
      if (teamsParts.length !== 2) {
        throw new Error('Could not parse team names from URL');
      }

      const team1 = teamsParts[0].replace(/-/g, ' ');
      const team2 = teamsParts[1].replace(/-/g, ' ');
      const tournament = tournamentName.replace(/-/g, ' ');

      return {
        matchId,
        tournamentName: tournament,
        team1,
        team2,
      };
    } catch (error) {
      console.error('Error parsing CricHeroes URL:', error);
      throw error;
    }
  };

  // Fetch match details and show confirmation
  const fetchMatchDetails = async () => {
    if (!urlInput.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid CricHeroes URL',
        position: 'bottom',
        visibilityTime: 2000
      });
      return;
    }

    setFetchingMatchDetails(true);

    try {
      // First, parse the URL to get the match ID
      const parsedMatch = parseCricHeroesUrl(urlInput.trim());

      // Check if match is already scheduled
      const existingMatches = await AsyncStorage.getItem('scheduledMatches');
      let scheduledMatchesList: ScheduledMatch[] = [];

      if (existingMatches) {
        scheduledMatchesList = JSON.parse(existingMatches);
        const isAlreadyScheduled = scheduledMatchesList.some(
          match => match.matchId === parsedMatch.matchId
        );

        if (isAlreadyScheduled) {
          Toast.show({
            type: 'info',
            text1: 'Already Scheduled',
            text2: 'This match is already in your schedule',
            position: 'bottom',
            visibilityTime: 2000
          });
          setShowUrlModal(false);
          setUrlInput('');
          setFetchingMatchDetails(false);
          return;
        }
      }

      // Fetch actual match details from CricHeroes API
      Toast.show({
        type: 'info',
        text1: 'Fetching Match Details',
        text2: 'Getting match information from CricHeroes...',
        position: 'bottom',
        visibilityTime: 2000
      });

      const matchDetailsResponse = await apiService.getMatchScorecard(
        parsedMatch.matchId,
        parsedMatch.tournamentName,
        `${parsedMatch.team1} vs ${parsedMatch.team2}`
      );

      if (!matchDetailsResponse.success || !matchDetailsResponse.data) {
        throw new Error('Failed to fetch match details from CricHeroes API');
      }

      const matchData = (matchDetailsResponse.data as any).pageProps.matchData;
      const matchInfo = (matchDetailsResponse.data as any).pageProps.matchInfo;

      if (!matchData && !matchInfo) {
        throw new Error('Match data not found in API response');
      }

      const matchStartTime = matchInfo?.startDateTime || matchInfo?.matchStartTime || matchInfo?.matchDate || matchData?.start_datetime || new Date().toISOString();

      // Create new scheduled match with real API data
      const newScheduledMatch: ScheduledMatch = {
        matchId: parsedMatch.matchId,
        tournamentName: matchInfo?.tournamentName || matchData?.tournament_name || parsedMatch.tournamentName,
        teamNames: {
          team1: matchData?.team_a?.name || parsedMatch.team1,
          team2: matchData?.team_b?.name || parsedMatch.team2,
        },
        groundName: matchInfo?.groundName || matchData?.ground_name,
        groundId: matchData?.ground_id,
        city: matchInfo?.cityName || matchData?.city_name,
        matchStartTime: matchStartTime,
        matchType: matchInfo?.matchType || matchData?.match_type || 'T20',
        overs: matchInfo?.overs || matchData?.overs || 20,
        scheduledAt: new Date().toISOString(),
      };

      setFetchedMatchDetails(newScheduledMatch);

      // Format date for manual input (YYYY-MM-DD HH:mm)
      try {
        const date = new Date(matchStartTime);
        const formattedDate = date.toISOString().replace('T', ' ').substring(0, 16);
        setManualDate(formattedDate);
      } catch (e) {
        setManualDate(matchStartTime);
      }

    } catch (error) {
      console.error('Error fetching match details:', error);
      let errorMessage = 'Failed to fetch match details. Please check the URL and try again.';

      if (error instanceof Error) {
        if (error.message.includes('Invalid CricHeroes URL format')) {
          errorMessage = 'Invalid URL format. Please check the CricHeroes scorecard URL.';
        } else if (error.message.includes('Failed to fetch match details') || error.message.includes('Match data not found')) {
          errorMessage = 'Could not fetch match details. The match may be private or restricted.';
        }
      }

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        position: 'bottom',
        visibilityTime: 4000
      });
    } finally {
      setFetchingMatchDetails(false);
    }
  };

  const confirmScheduleMatch = async () => {
    if (!fetchedMatchDetails) return;

    try {
      // Update the match start time with the manual date
      let finalDate = fetchedMatchDetails.matchStartTime;
      try {
        // Try to parse the manual date
        const parsedDate = new Date(manualDate);
        if (!isNaN(parsedDate.getTime())) {
          finalDate = parsedDate.toISOString();
        }
      } catch (e) {
        console.warn('Invalid date format, using original fetched date');
      }

      const matchToAdd = {
        ...fetchedMatchDetails,
        matchStartTime: finalDate
      };

      const existingMatches = await AsyncStorage.getItem('scheduledMatches');
      let scheduledMatchesList: ScheduledMatch[] = existingMatches ? JSON.parse(existingMatches) : [];

      scheduledMatchesList.push(matchToAdd);
      await AsyncStorage.setItem('scheduledMatches', JSON.stringify(scheduledMatchesList));

      setScheduledMatches(scheduledMatchesList);
      const convertedMatches = scheduledMatchesList.map(convertScheduledMatchToMatch);
      setMatches(convertedMatches);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Match "${matchToAdd.teamNames.team1} vs ${matchToAdd.teamNames.team2}" added to schedule`,
        position: 'bottom',
        visibilityTime: 3000
      });

      // Reset state
      setShowUrlModal(false);
      setUrlInput('');
      setFetchedMatchDetails(null);
      setManualDate('');

    } catch (error) {
      console.error('Error saving match:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save match to schedule.',
        position: 'bottom',
        visibilityTime: 2000
      });
    }
  };

  const cancelModal = () => {
    setShowUrlModal(false);
    setUrlInput('');
    setFetchedMatchDetails(null);
    setManualDate('');
  };

  useEffect(() => {
    loadScheduledMatches();
  }, []);

  // Reload matches when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadScheduledMatches();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading your scheduled matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MatchCalendar
        matches={matches}
        loading={loading}
        onMatchPress={handleMatchPress}
        onRefresh={onRefresh}
        onRemoveMatch={handleRemoveMatch}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleFabPress}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* URL Input Modal for Match Scheduling */}
      <Modal
        visible={showUrlModal}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {fetchedMatchDetails ? 'Confirm Match Details' : 'Schedule Match by Link'}
            </Text>

            {!fetchedMatchDetails ? (
              <>
                <Text style={styles.modalSubtitle}>
                  Enter a CricHeroes scorecard URL to add the match to your schedule
                </Text>

                <TextInput
                  style={styles.urlInput}
                  placeholder="https://cricheroes.com/scorecard/..."
                  value={urlInput}
                  onChangeText={setUrlInput}
                  multiline={true}
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </>
            ) : (
              <View style={styles.confirmationContainer}>
                <Text style={styles.confirmTeamText}>
                  {fetchedMatchDetails.teamNames.team1} vs {fetchedMatchDetails.teamNames.team2}
                </Text>
                <Text style={styles.confirmTournamentText}>
                  {fetchedMatchDetails.tournamentName}
                </Text>

                <Text style={styles.inputLabel}>Match Date & Time (YYYY-MM-DD HH:mm)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={manualDate}
                  onChangeText={setManualDate}
                  placeholder="YYYY-MM-DD HH:mm"
                />
                <Text style={styles.helperText}>
                  Please verify the date and time before adding.
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {!fetchedMatchDetails ? (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.addButton,
                    fetchingMatchDetails && styles.disabledButton
                  ]}
                  onPress={fetchMatchDetails}
                  disabled={fetchingMatchDetails}
                >
                  {fetchingMatchDetails ? (
                    <View style={styles.loadingButtonContent}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={[styles.addButtonText, { marginLeft: 8 }]}>
                        Fetching...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.addButtonText}>Next</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.modalButton, styles.addButton]}
                  onPress={confirmScheduleMatch}
                >
                  <Text style={styles.addButtonText}>Add Match</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 10,
  },
  fabText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.34,
    shadowRadius: 6.27,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#0066cc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationContainer: {
    marginBottom: 20,
  },
  confirmTeamText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmTournamentText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default CalendarScreen;
