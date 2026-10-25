import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

import MatchCalendar from '../components/MatchCalendar';
import type { Match, ScheduledMatch } from '../types/Match';
import type { CalendarScreenNavigationProp } from '../types/navigation';
import { convertScheduledMatchToMatch } from '../utils/matchUtils';
import { buildMarkedDates, buildMatchDetailParams, getMatchStart, getTeamNames } from '../utils/matchDisplay';
import { fromDateKey } from '../utils/dates';
import { haptic } from '../utils/haptics';
import { rememberMatch } from '../utils/matchRegistry';
import { useTabBarSpace } from '../navigation/useTabBarSpace';
import { FAB } from '../ui/FAB';
import { MeshBackground } from '../ui/MeshBackground';
import { CompactHeaderBar, ScreenHeader, useCollapsingHeader } from '../ui/ScreenHeader';
import { useConfetti } from '../ui/Confetti';
import { AddMatchSheet } from './calendar/AddMatchSheet';

const sortByStartTime = (list: ScheduledMatch[]) =>
  [...list].sort((a, b) => {
    if (!a.matchStartTime || !b.matchStartTime) return 0;
    return new Date(a.matchStartTime).getTime() - new Date(b.matchStartTime).getTime();
  });

const CalendarScreen: React.FC<CalendarScreenNavigationProp> = ({ navigation, route }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDate, setSheetDate] = useState<Date | null>(null);
  // The FAB adds to the day picked in the calendar (if it's today or later).
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const tabBarSpace = useTabBarSpace();
  const confetti = useConfetti();
  const { scrollY, onScroll } = useCollapsingHeader();
  const lastStored = useRef<string | null | undefined>(undefined);

  const loadScheduledMatches = useCallback(async () => {
    try {
      const matchesData = await AsyncStorage.getItem('scheduledMatches');
      // Focus reloads that find the same list keep the current Match objects (no re-render).
      if (matchesData === lastStored.current) return;
      lastStored.current = matchesData;
      if (matchesData) {
        const sortedMatches = sortByStartTime(JSON.parse(matchesData));
        setMatches(sortedMatches.map(convertScheduledMatchToMatch));
      } else {
        setMatches([]);
      }
    } catch (error) {
      console.error('Error loading scheduled matches:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load scheduled matches. Please try again.',
        position: 'bottom',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadScheduledMatches();
    }, [loadScheduledMatches]),
  );

  // Home's "Add a match" lands here with a day to pre-select.
  const openAddFor = route.params?.openAddFor;
  useEffect(() => {
    if (!openAddFor) return;
    setSheetDate(fromDateKey(openAddFor));
    setSheetVisible(true);
    navigation.setParams({ openAddFor: undefined });
  }, [openAddFor, navigation]);

  const removeFromSchedule = useCallback(async (matchId: string) => {
    try {
      const stored = await AsyncStorage.getItem('scheduledMatches');
      if (stored) {
        const parsedMatches: ScheduledMatch[] = JSON.parse(stored).filter((m: ScheduledMatch) => m.matchId !== matchId);
        const next = JSON.stringify(parsedMatches);
        await AsyncStorage.setItem('scheduledMatches', next);
        lastStored.current = next;
        setMatches(sortByStartTime(parsedMatches).map(convertScheduledMatchToMatch));
        Toast.show({
          type: 'success',
          text1: 'Removed',
          text2: 'Match removed from schedule.',
          position: 'bottom',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Error removing match from schedule:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove match from schedule. Please try again.',
        position: 'bottom',
        visibilityTime: 2000,
      });
    }
  }, []);

  const handleRemoveMatch = useCallback(
    (match: Match) => {
      const matchId = (match.id || match.match_id)?.toString();
      if (!matchId) return;
      const { team1, team2 } = getTeamNames(match);
      haptic('warning');
      Alert.alert('Remove Match', `Are you sure you want to remove "${team1} vs ${team2}" from your schedule?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromSchedule(matchId) },
      ]);
    },
    [removeFromSchedule],
  );

  const handleMatchPress = useCallback(
    (match: Match) => {
      const params = buildMatchDetailParams(match, { city: match.city_name, defaultTab: 'info' });
      if (!params) return;
      rememberMatch(match);
      navigation.navigate('MatchDetail', params);
    },
    [navigation],
  );

  const openSheet = useCallback((day: Date | null) => {
    setSheetDate(day);
    setSheetVisible(true);
  }, []);

  const handleAdded = useCallback(
    (list: ScheduledMatch[], added: ScheduledMatch) => {
      lastStored.current = JSON.stringify(list);
      setMatches(sortByStartTime(list).map(convertScheduledMatchToMatch));
      setSheetVisible(false);
      // Celebrate once the sheet has slid away so the confetti is on top.
      setTimeout(() => {
        confetti.fire();
        Toast.show({
          type: 'success',
          text1: 'Match added!',
          text2: `"${added.teamNames.team1} vs ${added.teamNames.team2}" is on your calendar`,
          position: 'bottom',
          visibilityTime: 3000,
        });
      }, 280);
    },
    [confetti],
  );

  const markedDates = useMemo(() => buildMarkedDates(matches), [matches]);
  const upcomingCount = useMemo(() => {
    const t = Date.now();
    return matches.filter(m => (getMatchStart(m)?.getTime() ?? 0) > t).length;
  }, [matches]);

  const subtitle = loading
    ? 'Loading your match diary…'
    : upcomingCount > 0
      ? `${upcomingCount} ${upcomingCount === 1 ? 'match' : 'matches'} coming up`
      : 'Your match diary';

  return (
    <MeshBackground>
      <View style={styles.flex}>
        <MatchCalendar
          matches={matches}
          loading={loading}
          onMatchPress={handleMatchPress}
          onRefresh={() => {
            setRefreshing(true);
            lastStored.current = undefined;
            loadScheduledMatches();
          }}
          refreshing={refreshing}
          onRemoveMatch={handleRemoveMatch}
          onDateSelect={key => setSelectedDay(fromDateKey(key))}
          header={<ScreenHeader title="Calendar" icon="calendar" subtitle={subtitle} scrollY={scrollY} />}
          bottomSpace={tabBarSpace + 70}
          onScroll={onScroll}
        />
        <CompactHeaderBar title="Calendar" scrollY={scrollY} />
        <FAB
          accessibilityLabel="Add match"
          onPress={() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            openSheet(selectedDay && selectedDay.getTime() >= today.getTime() ? selectedDay : null);
          }}
          bottomOffset={tabBarSpace - 4}
          attention={!loading && matches.length === 0}
        />
      </View>
      <AddMatchSheet
        visible={sheetVisible}
        initialDate={sheetDate}
        markedDates={markedDates}
        onClose={() => setSheetVisible(false)}
        onAdded={handleAdded}
      />
    </MeshBackground>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default CalendarScreen;
