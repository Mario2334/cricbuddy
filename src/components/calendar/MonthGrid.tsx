import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInLeft,
  FadeInRight,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomOut,
} from 'react-native-reanimated';
import { colors, curve, easings, enter, fonts, glass, glows, gradients, palette, radii, springs, statusColors } from '../../theme';
import { formatMonthYear, monthGrid, toDateKey, weekdayLabels } from '../../utils/dates';
import type { MarkedDay } from '../../utils/matchDisplay';
import { haptic } from '../../utils/haptics';
import { AppText } from '../../ui/AppText';
import { Chip } from '../../ui/Chip';
import { GlassView } from '../../ui/GlassView';
import { Icon } from '../../ui/Icon';

const CELL_H = 48;
const CIRCLE = 38;

interface MonthGridProps {
  month: Date;
  selectedKey: string;
  todayKey: string;
  marked: Record<string, MarkedDay>;
  onSelect: (d: Date) => void;
  onChangeMonth: (delta: 1 | -1) => void;
  onToday: () => void;
  swipeEnabled?: boolean;
}

/**
 * Monday-first month grid. Swipe or tap the chevrons to change month; the
 * selected-day circle springs from cell to cell.
 */
export function MonthGrid({ month, selectedKey, todayKey, marked, onSelect, onChangeMonth, onToday, swipeEnabled = true }: MonthGridProps) {
  const reduced = useReducedMotion();
  const cells = useMemo(() => monthGrid(month), [month]);
  const labels = useMemo(() => weekdayLabels(), []);
  const monthKey = toDateKey(month).slice(0, 7);
  const [gridW, setGridW] = useState(0);
  const direction = useRef<1 | -1>(1);
  const cellW = gridW / 7;

  const selIndex = cells.findIndex(c => c.key === selectedKey);
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  const visible = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!cellW) return;
    if (selIndex < 0) {
      visible.value = withTiming(0, { duration: 120 });
      return;
    }
    const x = (selIndex % 7) * cellW + (cellW - CIRCLE) / 2;
    const y = Math.floor(selIndex / 7) * CELL_H + 2;
    if (!placed.current || reduced) {
      placed.current = true;
      cx.value = x;
      cy.value = y;
    } else {
      cx.value = withSpring(x, springs.snappy);
      cy.value = withSpring(y, springs.snappy);
    }
    visible.value = withSpring(1, springs.release);
  }, [selIndex, cellW, monthKey, reduced, cx, cy, visible]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateX: cx.value }, { translateY: cy.value }, { scale: 0.6 + visible.value * 0.4 }],
  }));

  const change = (delta: 1 | -1) => {
    direction.current = delta;
    haptic('selection');
    onChangeMonth(delta);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeEnabled)
        .activeOffsetX([-24, 24])
        .failOffsetY([-14, 14])
        .onEnd(e => {
          if (e.translationX < -50) runOnJS(change)(1);
          else if (e.translationX > 50) runOnJS(change)(-1);
        }),
    [swipeEnabled, onChangeMonth],
  );

  const isCurrentMonth = monthKey === todayKey.slice(0, 7);
  const showToday = !isCurrentMonth || selectedKey !== todayKey;

  return (
    <GlassView mode="frost" radius={radii.lg} fill={glass.fill} style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={() => change(-1)} hitSlop={8} style={styles.nav} accessibilityLabel="Previous month">
          <Icon name="back" size={18} weight="bold" color={colors.text} />
        </Pressable>
        <Animated.View key={monthKey} entering={reduced ? undefined : enter.pop()} style={styles.titleWrap}>
          <AppText variant="h2" center numberOfLines={1}>
            {formatMonthYear(month)}
          </AppText>
        </Animated.View>
        <Pressable onPress={() => change(1)} hitSlop={8} style={styles.nav} accessibilityLabel="Next month">
          <Icon name="forward" size={18} weight="bold" color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.todayRow}>
        {showToday ? (
          <Animated.View entering={enter.pop()} exiting={ZoomOut.duration(140)}>
            <Chip label="Jump to today" icon="calendar" size="sm" tone="green" selected onPress={onToday} />
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.weekdays}>
        {labels.map((l, i) => (
          <AppText key={`${l}-${i}`} style={styles.weekday} color={i >= 5 ? palette.coral500 : colors.textMuted}>
            {l}
          </AppText>
        ))}
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.gridClip} onLayout={e => setGridW(e.nativeEvent.layout.width)}>
          <Animated.View
            key={monthKey}
            entering={reduced ? undefined : (direction.current > 0 ? FadeInRight : FadeInLeft).duration(320).easing(easings.out)}
          >
            {cellW > 0 ? (
              <Animated.View pointerEvents="none" style={[styles.circle, glows.emerald, circleStyle]}>
                <View style={[StyleSheet.absoluteFill, styles.circleClip]}>
                  <LinearGradient colors={gradients.primaryVivid} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                </View>
              </Animated.View>
            ) : null}
            <View style={styles.grid}>
              {cells.map(cell => {
                const isSel = cell.key === selectedKey;
                const isToday = cell.key === todayKey;
                const mark = marked[cell.key];
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      haptic('selection');
                      onSelect(cell.date);
                    }}
                    style={[styles.cell, { width: cellW || undefined }, !cell.inMonth && styles.outMonth]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={`${cell.date.toDateString()}${isToday ? ', today' : ''}${mark ? `, ${mark.count} matches` : ''}`}
                  >
                    <View style={[styles.dayCircle, isToday && !isSel && styles.todayRing]}>
                      <AppText style={styles.dayNum} color={isSel ? palette.white : colors.text}>
                        {cell.date.getDate()}
                      </AppText>
                    </View>
                    <View style={styles.dots}>
                      {mark
                        ? mark.statuses.slice(0, 3).map((s, i) => (
                            <View key={i} style={[styles.dot, { backgroundColor: statusColors[s].dot }]} />
                          ))
                        : null}
                      {mark && mark.count > 3 ? (
                        <AppText style={styles.more} color={colors.textMuted}>
                          +{mark.count - 3}
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center' },
  titleWrap: { flex: 1 },
  nav: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.rim,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 8px rgba(15,23,42,0.08)',
  },
  todayRow: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  weekdays: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBlack, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  gridClip: { overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
  },
  circleClip: { borderRadius: CIRCLE / 2, overflow: 'hidden', ...curve },
  cell: { height: CELL_H, alignItems: 'center' },
  outMonth: { opacity: 0.35 },
  dayCircle: {
    marginTop: 2,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: { borderWidth: 2, borderColor: palette.green500, backgroundColor: palette.green50 },
  dayNum: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 6, marginTop: -4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  more: { fontFamily: fonts.bodyBlack, fontSize: 8, lineHeight: 9 },
});

export default MonthGrid;
