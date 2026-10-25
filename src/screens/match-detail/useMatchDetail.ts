// All MatchDetail state, effects and handlers. Moved verbatim from the original
// MatchDetailScreen (dependency arrays and quirks included). Intentional
// changes are marked "CHANGED:".
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Clipboard from '@react-native-clipboard/clipboard';
import type { Ground } from '../../types/Ground';
import type { Match } from '../../types/Match';
import type { RootStackParamList } from '../../types/navigation';
import apiService from '../../services/apiService';
import googleMapsService, { type GoogleMapsPlace } from '../../services/googleMapsService';
import { useConfetti } from '../../ui/Confetti';
import {
  extractPlayersFromScorecard as extractPlayers,
  generatePaymentWhatsAppMessage as buildPaymentMessage,
  generateWhatsAppMessage as buildWhatsAppMessage,
} from './messageBuilders';
import {
  BALL_JERSEY_OPTIONS,
  type Innings,
  type MainTabRoute,
  type ScorecardData,
  type ScorecardMatchEnvelope,
  type ScorecardRoute,
} from './types';

export type MatchDetailParams = RootStackParamList['MatchDetail'];

export function useMatchDetail(params: MatchDetailParams) {
  const { matchId, tournamentName, teamNames, groundName, groundId, city, matchStartTime, defaultTab } = params;
  const confetti = useConfetti();
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [matchData, setMatchData] = useState<Match | null>(null);
  const [groundData, setGroundData] = useState<Ground | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [groundLoading, setGroundLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mainTabIndex, setMainTabIndex] = useState<number>(
    defaultTab === 'scorecard' ? 1 : 0
  );
  const [scorecardTabIndex, setScorecardTabIndex] = useState<number>(0);
  const [mainTabRoutes] = useState<MainTabRoute[]>([
    { key: 'info', title: 'Info' },
    { key: 'scorecard', title: 'Scorecard' }
  ]);
  const [scorecardRoutes, setScorecardRoutes] = useState<ScorecardRoute[]>([]);
  const [matchStatus, setMatchStatus] = useState<string>('unknown');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showGroundDropdown, setShowGroundDropdown] = useState<boolean>(false);
  const [selectedGroundForWhatsApp, setSelectedGroundForWhatsApp] = useState<Ground | null>(null);
  const [availableGrounds, setAvailableGrounds] = useState<Ground[]>([]);
  const [showGoogleMapsModal, setShowGoogleMapsModal] = useState<boolean>(false);
  const [googleMapsPlaces, setGoogleMapsPlaces] = useState<GoogleMapsPlace[]>([]);
  const [selectedGoogleMapsPlace, setSelectedGoogleMapsPlace] = useState<GoogleMapsPlace | null>(null);
  const [searchingPlaces, setSearchingPlaces] = useState<boolean>(false);
  const [selectedBallJersey, setSelectedBallJersey] = useState<string>('White ball, Coloured Jersey');
  const [showBallJerseyDropdown, setShowBallJerseyDropdown] = useState<boolean>(false);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [schedulingLoading, setSchedulingLoading] = useState<boolean>(false);
  const [isTeam5179117Match, setIsTeam5179117Match] = useState<boolean>(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState<boolean>(false);
  const [paymentMessage, setPaymentMessage] = useState<string>('');
  const [showFeesInputDialog, setShowFeesInputDialog] = useState<boolean>(false);
  const [matchFees, setMatchFees] = useState<string>('8500');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);

  const ballJerseyOptions = BALL_JERSEY_OPTIONS;

  useEffect(() => {
    fetchMatchData();
    fetchScorecard();
    if (groundId) {
      fetchGroundDetail();
    }
    checkIfMatchIsScheduled();
  }, []);

  // Auto-refresh for live matches
  useEffect(() => {
    if (matchStatus === 'live' && mainTabIndex === 1) { // Only refresh when on scorecard tab
      const interval = setInterval(() => {
        fetchScorecard();
      }, 30000); // Refresh every 30 seconds for live matches

      setAutoRefreshInterval(interval);

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else {
      // Clear interval if not on live match or not on scorecard tab
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        setAutoRefreshInterval(null);
      }
    }
  }, [matchStatus, mainTabIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, []);

  // Process scorecard data into tab routes when it's loaded
  useEffect(() => {
    if (scorecard && scorecard.pageProps && Array.isArray(scorecard.pageProps.scorecard) && scorecard.pageProps.scorecard.length > 0) {
      const inningsArr = scorecard?.pageProps?.scorecard;
      if (Array.isArray(inningsArr)) {
        const newRoutes = inningsArr.map((innings: Innings, idx: number) => ({
          key: String(idx),
          title: innings.teamName || `Innings ${idx + 1}`,
          innings: innings
        }));
        setScorecardRoutes(newRoutes);
      }
    }
  }, [scorecard]);

  // Helper function to check if either team in the match is team 5179117
  const isTeam5179117InMatch = (match: any) => {
    const targetTeamId = 5179117;
    return (
      (match.team_a && match.team_a.id === targetTeamId) ||
      (match.team_b && match.team_b.id === targetTeamId) ||
      (match.team_a_id === targetTeamId) ||
      (match.team_b_id === targetTeamId)
    );
  };

  const fetchMatchData = async () => {
    try {
      // Fetch matches from the team matches API to get match details
      const response = await apiService.getTeamMatches('5179117', 1, 100); // Get first 100 matches
      if (response.status && response.data) {
        // Find the specific match by ID
        const match = response.data.find((m: Match) =>
          m.match_id?.toString() === matchId || m.id?.toString() === matchId
        );
        if (match) {
          setMatchData(match);
          // Check if either team in the match is team 5179117
          setIsTeam5179117Match(isTeam5179117InMatch(match));
          return;
        } else {
          console.log('Match not found in current page, trying more pages...');
          // If not found in first page, try a few more pages
          for (let page = 2; page <= 5; page++) {
            const pageResponse = await apiService.getTeamMatches('5179117', page, 100);
            if (pageResponse.status && pageResponse.data) {
              const foundMatch = pageResponse.data.find((m: Match) =>
                m.match_id?.toString() === matchId || m.id?.toString() === matchId
              );
              if (foundMatch) {
                setMatchData(foundMatch);
                // Check if either team in the match is team 5179117
                setIsTeam5179117Match(isTeam5179117InMatch(foundMatch));
                return;
              }
            }
          }
        }
      }

      // If match not found in API, try to get match data from scorecard API
      console.log('Match not found in team API, trying to get match data from scorecard API...');
      try {
        const matchIdParam: string | number = matchId ?? '';
        const tournamentSlug = (tournamentName || 'tournament')
          .toLowerCase()
          .replace(/\s+/g, '-');
        const teamNamesSlug = `${teamNames.team1 || 'Team A'}-vs-${teamNames.team2 || 'Team B'}`
          .toLowerCase()
          .replace(/\s+/g, '-');
        const scorecardResponse = await apiService.getMatchScorecard(matchIdParam, tournamentSlug, teamNamesSlug);
        // CHANGED (types only): `data` is `unknown` on the API response; narrow it
        // to an envelope so `.data.data` type-checks. Same runtime checks.
        const scorecardEnvelope = scorecardResponse?.data as ScorecardMatchEnvelope | undefined;

        if (scorecardResponse && scorecardEnvelope && scorecardEnvelope.data) {
          const matchDataFromScorecard = scorecardEnvelope.data as Match;
          setMatchData(matchDataFromScorecard);
          // Check if either team in the match is team 5179117
          setIsTeam5179117Match(isTeam5179117InMatch(matchDataFromScorecard));
          return;
        }
      } catch (scorecardError) {
        console.log('Failed to get match data from scorecard API:', scorecardError);
      }

      // If match not found in any API, create fallback data from route parameters
      console.log('Match not found in any API, creating fallback data from route parameters');
      const fallbackMatchData: Partial<Match> = {
        match_id: parseInt(matchId) || 0,
        tournament_name: tournamentName,
        team_a: teamNames.team1,
        team_b: teamNames.team2,
        ground_name: groundName,
        ground_id: groundId || 0,
        city_name: city,
        match_type: 'T20', // Default match type
        overs: 20, // Default overs
        status: 'upcoming', // Default status
        match_start_time: matchStartTime || undefined // Use actual match start time if available
      };
      setMatchData(fallbackMatchData as Match);
      // For fallback data, we can't determine team IDs, so set to false
      setIsTeam5179117Match(false);
    } catch (error) {
      console.error('Error fetching match data:', error);
      // Create fallback data even on error
      console.log('Creating fallback data due to API error');
      const fallbackMatchData: Partial<Match> = {
        match_id: parseInt(matchId) || 0,
        tournament_name: tournamentName,
        team_a: teamNames.team1,
        team_b: teamNames.team2,
        ground_name: groundName,
        ground_id: groundId || 0,
        city_name: city,
        match_type: 'T20', // Default match type
        overs: 20, // Default overs
        status: 'upcoming', // Default status
        match_start_time: matchStartTime || undefined // Use actual match start time if available
      };
      setMatchData(fallbackMatchData as Match);
      // For fallback data, we can't determine team IDs, so set to false
      setIsTeam5179117Match(false);
    }
  };

  const fetchScorecard = async () => {
    try {
      setLoading(true);
      setError(null);
      // Extract match details for API call
      const matchIdParam: string | number = matchId ?? '';
      // Convert to slug format: lowercase, spaces to dashes, preserve parentheses and dots
      const tournamentSlug = (tournamentName || 'tournament')
        .toLowerCase()
        .replace(/\s+/g, '-');
      const teamNamesSlug = `${teamNames.team1 || 'Team A'}-vs-${teamNames.team2 || 'Team B'}`
        .toLowerCase()
        .replace(/\s+/g, '-');
      const response = await apiService.getMatchScorecard(matchIdParam, tournamentSlug, teamNamesSlug);
      if (response && response.data) {
        setScorecard(response.data);

        // Detect match status from scorecard data
        const scorecardData = response.data && typeof response.data === 'object' && response.data !== null && 'pageProps' in response.data
          ? (response.data as ScorecardData).pageProps?.scorecard
          : null;
        if (scorecardData && Array.isArray(scorecardData) && scorecardData.length > 0) {
          // Check if match is live by looking for ongoing innings or incomplete match data
          const hasIncompleteInnings = scorecardData.some((innings: any) => {
            return innings.inning && (
              innings.inning.is_completed === false ||
              innings.inning.status === 'live' ||
              (innings.inning.total_wicket < 10 && innings.inning.overs_played &&
               parseFloat(innings.inning.overs_played) < (innings.inning.total_overs || 20))
            );
          });

          if (hasIncompleteInnings) {
            setMatchStatus('live');
          } else {
            setMatchStatus('past');
          }
        } else {
          // No scorecard data available - could be upcoming or very early live match
          setMatchStatus('upcoming');
        }
      } else {
        setError('Failed to load scorecard');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load scorecard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGroundDetail = async () => {
    if (!groundId) return;

    try {
      setGroundLoading(true);
      const response = await apiService.getGroundDetail(groundId);

      if (response.success && response.data) {
        setGroundData(response.data);
        // Set current ground as default selection for WhatsApp
        setSelectedGroundForWhatsApp(response.data);
      } else {
        console.error('Failed to load ground details:', response.error);
      }
    } catch (error) {
      console.error('Error fetching ground details:', error);
    } finally {
      setGroundLoading(false);
    }
  };

  const fetchAvailableGrounds = async () => {
    try {
      // This is a placeholder - you might need to implement a grounds search API
      // For now, we'll use the current ground data if available
      if (groundData) {
        setAvailableGrounds([groundData]);
      }
    } catch (error) {
      console.error('Error fetching available grounds:', error);
    }
  };

  const extractPlayersFromScorecard = (): string[] => extractPlayers(matchData, scorecard);

  const generateWhatsAppMessage = () =>
    buildWhatsAppMessage({
      matchId,
      tournamentName,
      teamNames,
      groundName,
      matchData,
      groundData,
      selectedGroundForWhatsApp,
      selectedGoogleMapsPlace,
      selectedBallJersey,
    });

  const generatePaymentWhatsAppMessage = (fees?: number) =>
    buildPaymentMessage(
      {
        matchId,
        tournamentName,
        teamNames,
        groundName,
        matchData,
        groundData,
        selectedGroundForWhatsApp,
        selectedGoogleMapsPlace,
        selectedPlayers,
        matchFees,
        scorecard,
      },
      fees,
    );

  const searchGoogleMapsPlaces = async () => {
    setSearchingPlaces(true);
    try {
      const searchQuery = groundName || selectedGroundForWhatsApp?.name || 'Cricket Ground';
      const places = await googleMapsService.searchPlaces(searchQuery);
      setGoogleMapsPlaces(places);
      setShowGoogleMapsModal(true);
    } catch (error) {
      console.error('Error searching Google Maps places:', error);
      Alert.alert(
        'Error',
        'Failed to search for places. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSearchingPlaces(false);
    }
  };

  const copyToWhatsApp = () => {
    // First search for Google Maps places
    searchGoogleMapsPlaces();
  };

  const copyToWhatsAppWithSelectedPlace = () => {
    try {
      const message = generateWhatsAppMessage();
      Clipboard.setString(message);
      setShowGoogleMapsModal(false);
      // CHANGED: success Alert became a playful toast + confetti.
      Toast.show({ type: 'success', text1: 'Copied! Paste it in WhatsApp', position: 'bottom' });
      confetti.fire();
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to copy message to clipboard. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const togglePlayerSelection = (playerName: string) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerName)) {
        return prev.filter(name => name !== playerName);
      } else {
        return [...prev, playerName];
      }
    });
  };

  const selectAllPlayers = () => {
    setSelectedPlayers(availablePlayers);
  };

  const deselectAllPlayers = () => {
    setSelectedPlayers([]);
  };

  const openFeesInputDialog = () => {
    const players = extractPlayersFromScorecard();
    setAvailablePlayers(players);
    setSelectedPlayers(players); // All players are selected by default
    setShowFeesInputDialog(true);
  };

  const openPaymentDialog = (fees?: number) => {
    try {
      const message = generatePaymentWhatsAppMessage(fees);
      setPaymentMessage(message);
      setShowPaymentDialog(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to generate payment message. Please try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
    }
  };

  const handleFeesSubmit = () => {
    const fees = parseInt(matchFees);
    if (isNaN(fees) || fees <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Amount',
        text2: 'Please enter a valid amount greater than 0.',
        position: 'bottom',
        visibilityTime: 2000
      });
      return;
    }
    setShowFeesInputDialog(false);
    openPaymentDialog(fees);
  };

  const copyPaymentMessageFromDialog = () => {
    try {
      Clipboard.setString(paymentMessage);
      setShowPaymentDialog(false);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Payment message copied to clipboard! You can now paste it in WhatsApp.',
        position: 'bottom',
        visibilityTime: 2000
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to copy payment message to clipboard. Please try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchMatchData(),
      fetchScorecard(),
      groundId ? fetchGroundDetail() : Promise.resolve()
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  // Scheduling functions
  const checkIfMatchIsScheduled = async () => {
    try {
      const scheduledMatches = await AsyncStorage.getItem('scheduledMatches');
      if (scheduledMatches) {
        const matches = JSON.parse(scheduledMatches);
        const isCurrentMatchScheduled = matches.some((match: any) => match.matchId === matchId);
        setIsScheduled(isCurrentMatchScheduled);
      }
    } catch (error) {
      console.error('Error checking scheduled matches:', error);
    }
  };

  const scheduleMatch = async () => {
    console.log('scheduleMatch called, matchData:', matchData);

    if (!matchData) {
      console.log('matchData is null, showing toast');
      Toast.show({
        type: 'info',
        text1: 'Loading',
        text2: 'Match data is still loading. Please wait a moment and try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
      return;
    }

    setSchedulingLoading(true);
    try {
      const scheduledMatches = await AsyncStorage.getItem('scheduledMatches');
      let matches = scheduledMatches ? JSON.parse(scheduledMatches) : [];

      const matchToSchedule: any = {
        matchId: matchId,
        tournamentName: matchData.tournament_name || tournamentName,
        teamNames: teamNames,
        groundName: matchData.ground_name || groundName,
        groundId: groundId,
        city: matchData.city_name || city,
        matchStartTime: matchData.match_start_time || matchData.start_time,
        matchType: matchData.match_type,
        overs: matchData.overs,
        scheduledAt: new Date().toISOString(),
      };

      console.log('Scheduling match:', matchToSchedule);

      // Check if already scheduled
      const alreadyScheduled = matches.some((match: any) => match.matchId === matchId);
      if (!alreadyScheduled) {
        matches.push(matchToSchedule);
        await AsyncStorage.setItem('scheduledMatches', JSON.stringify(matches));
        setIsScheduled(true);
        console.log('Match scheduled successfully');

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Match has been scheduled!',
          position: 'bottom',
          visibilityTime: 3000
        });
        // CHANGED: celebrate a successful add.
        confetti.fire();
      } else {
        console.log('Match already scheduled');
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'This match is already in your schedule.',
          position: 'bottom',
          visibilityTime: 2000
        });
      }
    } catch (error) {
      console.error('Error scheduling match:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to schedule match. Please try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
    } finally {
      setSchedulingLoading(false);
    }
  };

  const unscheduleMatch = async () => {
    setSchedulingLoading(true);
    try {
      const scheduledMatches = await AsyncStorage.getItem('scheduledMatches');
      if (scheduledMatches) {
        let matches = JSON.parse(scheduledMatches);

        // Remove from local storage
        matches = matches.filter((match: any) => match.matchId !== matchId);
        await AsyncStorage.setItem('scheduledMatches', JSON.stringify(matches));
        setIsScheduled(false);

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Match has been removed from your schedule.',
          position: 'bottom',
          visibilityTime: 3000
        });
      }
    } catch (error) {
      console.error('Error unscheduling match:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove match from schedule. Please try again.',
        position: 'bottom',
        visibilityTime: 2000
      });
    } finally {
      setSchedulingLoading(false);
    }
  };

  return {
    // Route params
    matchId,
    tournamentName,
    teamNames,
    groundName,
    groundId,
    city,
    matchStartTime,
    // State
    scorecard,
    matchData,
    groundData,
    loading,
    groundLoading,
    refreshing,
    error,
    mainTabIndex,
    scorecardTabIndex,
    mainTabRoutes,
    scorecardRoutes,
    matchStatus,
    autoRefreshInterval,
    showGroundDropdown,
    selectedGroundForWhatsApp,
    availableGrounds,
    showGoogleMapsModal,
    googleMapsPlaces,
    selectedGoogleMapsPlace,
    searchingPlaces,
    selectedBallJersey,
    showBallJerseyDropdown,
    isScheduled,
    schedulingLoading,
    isTeam5179117Match,
    showPaymentDialog,
    paymentMessage,
    showFeesInputDialog,
    matchFees,
    selectedPlayers,
    availablePlayers,
    ballJerseyOptions,
    // Setters used directly by the UI (exactly as the original inline handlers did)
    setMainTabIndex,
    setScorecardTabIndex,
    setShowGroundDropdown,
    setSelectedGroundForWhatsApp,
    setShowGoogleMapsModal,
    setSelectedGoogleMapsPlace,
    setSelectedBallJersey,
    setShowBallJerseyDropdown,
    setShowPaymentDialog,
    setShowFeesInputDialog,
    setMatchFees,
    // Actions
    fetchMatchData,
    fetchScorecard,
    fetchGroundDetail,
    fetchAvailableGrounds,
    searchGoogleMapsPlaces,
    copyToWhatsApp,
    copyToWhatsAppWithSelectedPlace,
    togglePlayerSelection,
    selectAllPlayers,
    deselectAllPlayers,
    openFeesInputDialog,
    openPaymentDialog,
    handleFeesSubmit,
    copyPaymentMessageFromDialog,
    onRefresh,
    checkIfMatchIsScheduled,
    scheduleMatch,
    unscheduleMatch,
    generateWhatsAppMessage,
    generatePaymentWhatsAppMessage,
    extractPlayersFromScorecard,
  };
}

export type MatchDetailModel = ReturnType<typeof useMatchDetail>;

export default useMatchDetail;
