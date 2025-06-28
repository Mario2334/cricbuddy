import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import MatchCalendar from '../components/MatchCalendar';
import type { Match } from '../types/Match';

interface ScheduledMatch {
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

const CalendarScreen: React.FC = () => {
  const [scheduledMatches, setScheduledMatches] = useState<ScheduledMatch[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigation = useNavigation();

  // Convert ScheduledMatch to Match format for MatchCalendar component
  const convertScheduledMatchToMatch = (scheduledMatch: ScheduledMatch): Match => {
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
      status: 'upcoming',
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
});

export default CalendarScreen;
