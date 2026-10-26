// All MatchDetail state, effects and handlers. Moved verbatim from the original
// MatchDetailScreen (dependency arrays and quirks included). Intentional
// changes are marked "CHANGED:".
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { useScreenActivity } from '../../hooks/useScreenActivity';
import { useStableCallback } from '../../hooks/useStableCallback';
import { toDate } from '../../utils/dates';
import { getRememberedMatch } from '../../utils/matchRegistry';
import { buildCricHeroesMatchUrl } from '../../utils/matchLinks';
import { copyMatchLink as copyLinkToClipboard } from '../../utils/copyMatchLink';
import { resolveTeamIds } from '../../features/match-analytics/utils/teamIds';
import { detectMatchStatus } from './matchStatus';
import {
  extractPlayersFromScorecard as extractPlayers,
  generatePaymentWhatsAppMessage as buildPaymentMessage,
  generateWhatsAppMessage as buildWhatsAppMessage,
} from './messageBuilders';
import {
  BALL_JERSEY_OPTIONS,
  TARGET_TEAM_ID,
  type Innings,
  type MainTabKey,
  type MainTabRoute,
  type ScorecardData,
  type ScorecardRoute,
} from './types';

/** Live scorecards poll this often while on show. */
const LIVE_REFRESH_MS = 30_000;
const NO_ROUTES: ScorecardRoute[] = [];
const BASE_TAB_ROUTES: MainTabRoute[] = [
  { key: 'info', title: 'Info' },
  { key: 'scorecard', title: 'Scorecard' },
];
const GAME_PLAN_ROUTE: MainTabRoute = { key: 'gameplan', title: 'Game plan' };

// Helper function to check if either team in the match is team 5179117
const isTeam5179117InMatch = (match: any) => {
  const targetTeamId = TARGET_TEAM_ID;
  return (
    (match.team_a && match.team_a.id === targetTeamId) ||
    (match.team_b && match.team_b.id === targetTeamId) ||
    (match.team_a_id === targetTeamId) ||
    (match.team_b_id === targetTeamId)
  );
};

/**
 * Keep the previous object for every innings whose content didn't change, so a
 * live update only re-renders the innings that actually moved.
 */
function shareUnchangedInnings(prev: ScorecardData | null, next: ScorecardData): ScorecardData {
  const before = prev?.pageProps?.scorecard;
  const after = next.pageProps?.scorecard;
  if (!Array.isArray(before) || !Array.isArray(after) || !next.pageProps) return next;
  return {
    ...next,
    pageProps: {
      ...next.pageProps,
      scorecard: after.map((innings, i) =>
        before[i] && JSON.stringify(before[i]) === JSON.stringify(innings) ? before[i] : innings,
      ),
    },
  };
}

export type MatchDetailParams = RootStackParamList['MatchDetail'];

export function useMatchDetail(params: MatchDetailParams) {
  const { matchId, tournamentName, teamNames, groundName, groundId, city, matchStartTime, defaultTab } = params;
  const confetti = useConfetti();
  // CHANGED: a match opened from a list card renders at once from what the card had.
  const remembered = getRememberedMatch(matchId);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [matchData, setMatchData] = useState<Match | null>(remembered ?? null);
  const [groundData, setGroundData] = useState<Ground | null>(null);
  // `loading` is the first load only; `updating` is a silent (live/pull) refresh.
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [groundLoading, setGroundLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // CHANGED: the main tab is keyed, so the Game plan tab can appear for an
  // upcoming Dev-Sena match without shifting the other tabs' indexes.
  const [mainTabKey, setMainTabKey] = useState<MainTabKey>(defaultTab ?? 'info');
  const [scorecardTabIndex, setScorecardTabIndex] = useState<number>(0);
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
  const [isTeam5179117Match, setIsTeam5179117Match] = useState<boolean>(() => !!remembered && isTeam5179117InMatch(remembered));
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

  // CHANGED: status is derived from the scorecard (API status first, then the
  // result, then the innings with a 12h recency guard) instead of an innings
  // heuristic that kept finished chases "live" forever.
  const matchStatus = useMemo<string>(
    () =>
      scorecard
        ? detectMatchStatus(scorecard, {
            listStatus: remembered?.status,
            start: toDate(matchData?.match_start_time || matchData?.start_time || matchStartTime),
          })
        : 'unknown',
    [scorecard, remembered, matchData, matchStartTime],
  );

  // The Game plan tab exists only for an upcoming Dev-Sena match.
  const showGamePlan = isTeam5179117Match && matchStatus === 'upcoming';
  const mainTabRoutes = useMemo<MainTabRoute[]>(() => (showGamePlan ? [...BASE_TAB_ROUTES, GAME_PLAN_ROUTE] : BASE_TAB_ROUTES), [showGamePlan]);
  const mainTabIndex = Math.max(0, mainTabRoutes.findIndex(r => r.key === mainTabKey));
  const setMainTabIndex = useStableCallback((index: number) => {
    const key = mainTabRoutes[index]?.key;
    if (key) setMainTabKey(key);
  });
  const teamIds = useMemo(() => resolveTeamIds(matchData, scorecard), [matchData, scorecard]);

  // CHANGED: routes are derived (no effect + extra render, no empty-routes frame).
  const scorecardRoutes = useMemo<ScorecardRoute[]>(() => {
    const inningsArr = scorecard?.pageProps?.scorecard;
    if (!Array.isArray(inningsArr) || inningsArr.length === 0) return NO_ROUTES;
    return inningsArr.map((innings: Innings, idx: number) => ({
      key: String(idx),
      title: innings.teamName || `Innings ${idx + 1}`,
      innings,
    }));
  }, [scorecard]);

  // The team can also be read off the scorecard (matches added from the calendar carry no team ids).
  useEffect(() => {
    const innings = scorecard?.pageProps?.scorecard;
    if (Array.isArray(innings) && innings.some(i => i?.teamId === TARGET_TEAM_ID)) {
      setIsTeam5179117Match(true);
    }
  }, [scorecard]);

  // CHANGED: live auto-refresh runs only while the match is live, the scorecard
  // tab is showing, the screen is focused and the app is in the foreground, and
  // catches up at once when coming back. Refreshes are silent.
  const autoRefreshing = matchStatus === 'live' && mainTabKey === 'scorecard';
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchAt = useRef(0);
  useScreenActivity(active => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = null;
    if (!active) return;
    if (Date.now() - lastFetchAt.current >= LIVE_REFRESH_MS) fetchScorecard({ silent: true });
    refreshTimer.current = setInterval(() => fetchScorecard({ silent: true }), LIVE_REFRESH_MS);
  }, autoRefreshing);

  const fetchMatchData = async () => {
    // CHANGED: the list card's Match is used as-is; otherwise look on the first
    // page of team fixtures only (it used to page through up to 500 matches).
    if (remembered) return;
    try {
      const response = await apiService.getTeamMatches('5179117', 1, 100);
      if (response.status && response.data) {
        const match = response.data.find((m: Match) =>
          m.match_id?.toString() === matchId || m.id?.toString() === matchId
        );
        if (match) {
          setMatchData(match);
          // Check if either team in the match is team 5179117
          setIsTeam5179117Match(isTeam5179117InMatch(match));
          return;
        }
      }

      // If match not found in API, create fallback data from route parameters
      // (the scorecard fills in round, ground, format and result when it lands).
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

  // CHANGED: `silent` refreshes (live polling, pull-to-refresh) keep the current
  // scorecard on screen, never show the error view over good data, and skip the
  // state update entirely when nothing changed. Overlapping requests are dropped.
  const scorecardInFlight = useRef(false);
  const lastScorecardJson = useRef<string | null>(null);
  const fetchScorecard = useStableCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (scorecardInFlight.current) return;
    scorecardInFlight.current = true;
    lastFetchAt.current = Date.now();
    const hasData = lastScorecardJson.current !== null;
    try {
      if (silent) {
        setUpdating(true);
      } else {
        setLoading(true);
        setError(null);
      }
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
        const json = JSON.stringify(response.data);
        if (json !== lastScorecardJson.current) {
          lastScorecardJson.current = json;
          setScorecard(prev => shareUnchangedInnings(prev, response.data as ScorecardData));
        }
        setError(null);
      } else if (!silent || !hasData) {
        setError('Failed to load scorecard');
      }
    } catch (err: unknown) {
      if (!silent || !hasData) {
        setError(err instanceof Error ? err.message : 'Failed to load scorecard');
      }
    } finally {
      scorecardInFlight.current = false;
      setLoading(false);
      setUpdating(false);
      setRefreshing(false);
    }
  });

  // Fill gaps in fallback match data (round, ground, format, result) from the scorecard.
  useEffect(() => {
    const info = scorecard?.pageProps?.matchInfo;
    if (!info) return;
    setMatchData(prev => {
      if (!prev) return prev;
      const patch: Partial<Match> = {};
      if (!prev.tournament_round_name && info.tournamentRound) patch.tournament_round_name = info.tournamentRound;
      if (!prev.ground_name && info.groundName) patch.ground_name = info.groundName;
      if (!prev.match_result && typeof info.matchResult === 'string' && info.matchResult) patch.match_result = info.matchResult;
      if (!prev.match_start_time && (info.matchStartTime || info.startDateTime)) {
        patch.match_start_time = info.matchStartTime || info.startDateTime;
      }
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
  }, [scorecard]);

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

  // CHANGED: stable identity (memoized scorecard scenes) and a silent scorecard refresh.
  const onRefresh = useStableCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchMatchData(),
      fetchScorecard({ silent: true }),
      groundId ? fetchGroundDetail() : Promise.resolve()
    ]).finally(() => {
      setRefreshing(false);
    });
  });

  /** Retry from the error view: a full (non-silent) load. */
  const retryScorecard = useStableCallback(() => fetchScorecard());

  // CricHeroes link for this match (copied from the hero and the Share card).
  const matchLink = useMemo(
    () => buildCricHeroesMatchUrl(matchId, matchData?.tournament_name || tournamentName, teamNames),
    [matchId, matchData?.tournament_name, tournamentName, teamNames],
  );
  const copyMatchLink = useStableCallback(() => copyLinkToClipboard(matchLink));

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
    updating,
    groundLoading,
    refreshing,
    error,
    mainTabIndex,
    mainTabKey,
    scorecardTabIndex,
    mainTabRoutes,
    teamIds,
    scorecardRoutes,
    matchStatus,
    autoRefreshing,
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
    retryScorecard,
    fetchGroundDetail,
    fetchAvailableGrounds,
    searchGoogleMapsPlaces,
    copyToWhatsApp,
    copyToWhatsAppWithSelectedPlace,
    matchLink,
    copyMatchLink,
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
