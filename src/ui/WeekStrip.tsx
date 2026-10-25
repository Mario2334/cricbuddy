import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  ZoomOut,
} from 'react-native-reanimated';
import { colors, curve, enter, fonts, glass, glows, gradients, palette, radii, springs, statusColors } from '../theme';
import { dayRange, formatMonthYear, isSameLocalDay, toDateKey, type MatchStatus } from '../utils/dates';
import type { MarkedDay } from '../utils/matchDisplay';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { Chip } from './Chip';

const VISIBLE = 7;
const SIDE = Math.floor(VISIBLE / 2);

export interface WeekStripProps {
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
  now: Date;
  markedDates?: Record<string, MarkedDay>;
  daysBefore?: number;
  daysAfter?: number;
  /** Tapping the selected day clears the selection. */
  allowDeselect?: boolean;
  showHeader?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface DayPillProps {
  date: Date;
  width: number;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  statuses: MatchStatus[];
  onPress: (d: Date) => void;
}

const DayPill = memo(function DayPill({ date, width, isToday, isSelected, isPast, statuses, onPress }: DayPillProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(isSelected ? 1.06 : 1);
  const breathe = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.06 : 1, springs.release);
  }, [isSelected, scale]);

  useEffect(() => {
    if (isToday && !isSelected && !reduced) {
      breathe.value = withRepeat(withTiming(1, { duration: 1600 }), -1, true);
    } else {
      cancelAnimation(breathe);
      breathe.value = 0;
    }
  }, [isToday, isSelected, reduced, breathe]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.55 + breathe.value * 0.45 }));

  const weekday = date.toString().slice(0, 3).toUpperCase();
  const fg = isSelected ? palette.white : colors.text;
  const dots = statuses.slice(0, 3);

  return (
    <Pressable
      onPress={() => onPress(date)}
      style={{ width, alignItems: 'center' }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${date.toDateString()}${isToday ? ', today' : ''}${statuses.length ? `, ${statuses.length} matches` : ''}`}
    >
      <Animated.View
        style={[
          styles.pill,
          { width: width - 6 },
          isSelected && glows.emerald,
          isPast && !isSelected && styles.pillPast,
          pillStyle,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.pillClip]}>
          {isSelected ? (
            <LinearGradient colors={gradients.primaryVivid} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.pillGlass]} />
          )}
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pillRim]} />
        {isToday && !isSelected ? <Animated.View pointerEvents="none" style={[styles.todayRing, ringStyle]} /> : null}
        <AppText
          style={{ fontFamily: fonts.bodyBlack, fontSize: 10, lineHeight: 13, letterSpacing: 0.4 }}
          color={isSelected ? 'rgba(255,255,255,0.9)' : isToday ? colors.primaryStrong : colors.textMuted}
        >
          {isToday ? 'TODAY' : weekday}
        </AppText>
        <AppText style={{ fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.5 }} color={fg}>
          {date.getDate()}
        </AppText>
        <View style={styles.dots}>
          {dots.map((s, i) => (
            <Animated.View
              key={`${s}-${i}`}
              entering={reduced ? undefined : FadeIn.delay(i * 60)}
              style={[styles.dot, { backgroundColor: isSelected ? palette.white : statusColors[s].dot }]}
            />
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
});

/**
 * Swipeable strip of days that opens centred on today. Snaps a day at a time
 * with a picker-wheel haptic tick; dots mark days with matches.
 */
export function WeekStrip({
  selectedDate,
  onSelectDate,
  now,
  markedDates,
  daysBefore = 28,
  daysAfter = 84,
  allowDeselect = true,
  showHeader = true,
  style,
  testID,
}: WeekStripProps) {
  const [width, setWidth] = useState(0);
  const dayWidth = width / VISIBLE;
  const todayKey = toDateKey(now);
  // Recomputed when the date rolls over at midnight.
  // Keyed on the day (not `now`) so the strip only rebuilds when the date rolls over.
  const days = useMemo(() => dayRange(now, daysBefore, daysAfter), [todayKey, daysBefore, daysAfter]);
  const todayIndex = daysBefore;
  const [centerIndex, setCenterIndex] = useState(todayIndex);
  const listRef = useRef<FlatList<Date>>(null);
  const lastTick = useRef(todayIndex - SIDE);
  const dragging = useRef(false);

  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      const target = Math.max(0, Math.min(days.length - VISIBLE, index - SIDE));
      listRef.current?.scrollToOffset({ offset: target * dayWidth, animated });
    },
    [days.length, dayWidth],
  );

  // Bring an externally chosen date into view.
  useEffect(() => {
    if (!selectedKey || !dayWidth) return;
    const idx = days.findIndex(d => toDateKey(d) === selectedKey);
    if (idx >= 0 && Math.abs(idx - centerIndex) > SIDE) scrollToIndex(idx);
  }, [selectedKey, dayWidth]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!dayWidth) return;
      const first = Math.round(e.nativeEvent.contentOffset.x / dayWidth);
      if (first !== lastTick.current) {
        lastTick.current = first;
        if (dragging.current) haptic('selection');
        setCenterIndex(first + SIDE);
      }
    },
    [dayWidth],
  );

  const handlePress = useCallback(
    (d: Date) => {
      haptic('selection');
      if (allowDeselect && selectedDate && isSameLocalDay(d, selectedDate)) onSelectDate(null);
      else onSelectDate(d);
    },
    [allowDeselect, selectedDate, onSelectDate],
  );

  const goToday = useCallback(() => {
    scrollToIndex(todayIndex);
    onSelectDate(allowDeselect ? null : days[todayIndex]);
  }, [scrollToIndex, todayIndex, onSelectDate, allowDeselect, days]);

  const centerDate = days[Math.max(0, Math.min(days.length - 1, centerIndex))];
  const awayFromToday =
    Math.abs(centerIndex - todayIndex) > SIDE - 1 || (!!selectedDate && !isSameLocalDay(selectedDate, now));

  const renderItem = useCallback(
    ({ item, index }: { item: Date; index: number }) => {
      const key = toDateKey(item);
      return (
        <DayPill
          date={item}
          width={dayWidth}
          isToday={index === todayIndex}
          isSelected={key === selectedKey}
          isPast={index < todayIndex}
          statuses={markedDates?.[key]?.statuses ?? []}
          onPress={handlePress}
        />
      );
    },
    [dayWidth, todayIndex, selectedKey, markedDates, handlePress],
  );

  return (
    <View style={style} testID={testID}>
      {showHeader ? (
        <View style={styles.header}>
          <AppText variant="h3">{formatMonthYear(centerDate)}</AppText>
          {awayFromToday ? (
            <Animated.View entering={enter.pop()} exiting={ZoomOut.duration(150)}>
              <Chip label="Today" icon="calendar" size="sm" tone="green" selected onPress={goToday} />
            </Animated.View>
          ) : null}
        </View>
      ) : null}
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.listWrap}>
        {dayWidth > 0 ? (
          <FlatList
            key={`${todayKey}-${Math.round(dayWidth)}`}
            ref={listRef}
            data={days}
            horizontal
            keyExtractor={d => toDateKey(d)}
            renderItem={renderItem}
            extraData={selectedKey}
            showsHorizontalScrollIndicator={false}
            snapToInterval={dayWidth}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({ length: dayWidth, offset: dayWidth * index, index })}
            initialScrollIndex={Math.max(0, todayIndex - SIDE)}
            initialNumToRender={VISIBLE + 4}
            windowSize={5}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              dragging.current = true;
            }}
            onMomentumScrollEnd={() => {
              dragging.current = false;
            }}
            contentContainerStyle={styles.listContent}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 30,
  },
  listWrap: { minHeight: 76 },
  listContent: { paddingVertical: 6 },
  pill: {
    height: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...curve,
  },
  pillClip: { borderRadius: radii.md, overflow: 'hidden', ...curve },
  pillGlass: { backgroundColor: glass.fillStrong, borderWidth: 1, borderColor: glass.hairline, borderRadius: radii.md },
  pillRim: { borderRadius: radii.md, borderWidth: 1, borderColor: glass.rim, ...curve },
  pillPast: { opacity: 0.55 },
  todayRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: palette.green500,
    ...curve,
  },
  dots: { flexDirection: 'row', height: 6, marginTop: 2, gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

export default WeekStrip;
