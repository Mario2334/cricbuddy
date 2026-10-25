import React, { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Match } from '../types/Match';
import { colors, glass, radii } from '../theme';
import { toDateKey } from '../utils/dates';
import { buildMarkedDates } from '../utils/matchDisplay';
import { useNow } from '../hooks/useNow';
import { WeekStrip } from '../ui/WeekStrip';
import { MatchCardSkeleton } from '../ui/Skeleton';
import { GlassView } from '../ui/GlassView';
import { MonthGrid } from './calendar/MonthGrid';
import { AgendaList } from './calendar/AgendaList';

interface MatchCalendarProps {
  matches: Match[];
  loading: boolean;
  onMatchPress: (match: Match) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onRemoveMatch?: (match: Match) => void;
  /** Offer "add a match on this day" for empty future days. */
  onAddForDate?: (date: Date) => void;
  onDateSelect?: (dateKey: string) => void;
  showWeekStrip?: boolean;
  monthSwipeEnabled?: boolean;
  /** Rendered at the top of the scroll content (e.g. a ScreenHeader). */
  header?: React.ReactNode;
  bottomSpace?: number;
  /** Reanimated scroll handler (e.g. from useCollapsingHeader). */
  onScroll?: React.ComponentProps<typeof Animated.ScrollView>['onScroll'];
}

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Week strip + month grid + agenda for the selected day, all in sync. */
const MatchCalendar: React.FC<MatchCalendarProps> = ({
  matches,
  loading,
  onMatchPress,
  onRefresh,
  refreshing = false,
  onRemoveMatch,
  onAddForDate,
  onDateSelect,
  showWeekStrip = true,
  monthSwipeEnabled = true,
  header,
  bottomSpace = 32,
  onScroll,
}) => {
  // Pauses by itself while the screen isn't on show.
  const now = useNow(60_000);
  const todayKey = toDateKey(now);
  const [selected, setSelected] = useState<Date>(() => startOfLocalDay(new Date()));
  const [month, setMonth] = useState<Date>(() => firstOfMonth(new Date()));
  const marked = useMemo(() => buildMarkedDates(matches), [matches]);

  const select = useCallback(
    (d: Date) => {
      const day = startOfLocalDay(d);
      setSelected(day);
      setMonth(prev =>
        prev.getMonth() === day.getMonth() && prev.getFullYear() === day.getFullYear() ? prev : firstOfMonth(day),
      );
      onDateSelect?.(toDateKey(day));
    },
    [onDateSelect],
  );

  const changeMonth = useCallback((delta: 1 | -1) => {
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }, []);

  const goToday = useCallback(() => select(new Date()), [select]);

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primaryStrong]} />
        ) : undefined
      }
    >
      {header}
      {showWeekStrip ? (
        <View style={[styles.pad, styles.section]}>
          <GlassView mode="frost" radius={radii.lg} fill={glass.fill} style={styles.weekCard}>
            <WeekStrip
              selectedDate={selected}
              onSelectDate={d => d && select(d)}
              now={now}
              markedDates={marked}
              allowDeselect={false}
              showHeader={false}
            />
          </GlassView>
        </View>
      ) : null}
      <View style={[styles.pad, styles.section]}>
        <MonthGrid
          month={month}
          selectedKey={toDateKey(selected)}
          todayKey={todayKey}
          marked={marked}
          onSelect={select}
          onChangeMonth={changeMonth}
          onToday={goToday}
          swipeEnabled={monthSwipeEnabled}
        />
      </View>
      <View style={[styles.pad, styles.agenda]}>
        {loading && matches.length === 0 ? (
          <>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </>
        ) : (
          <AgendaList
            selectedDate={selected}
            now={now}
            matches={matches}
            onMatchPress={onMatchPress}
            onRemoveMatch={onRemoveMatch}
            onAddForDate={onAddForDate}
          />
        )}
      </View>
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16 },
  section: { marginTop: 4, marginBottom: 12 },
  agenda: { marginTop: 8 },
  weekCard: { paddingHorizontal: 10, paddingVertical: 4 },
});

export default memo(MatchCalendar);
