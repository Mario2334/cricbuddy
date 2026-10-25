import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, glass, palette, radii, shadows } from '../../theme';
import { combineDateAndTime, formatFullDate, formatTime, relativeDayLabel, shiftMinutes } from '../../utils/dates';
import type { MarkedDay } from '../../utils/matchDisplay';
import { haptic } from '../../utils/haptics';
import { AppText } from '../../ui/AppText';
import { Chip } from '../../ui/Chip';
import { GradientText } from '../../ui/GradientText';
import { Icon } from '../../ui/Icon';
import { IconTile } from '../../ui/IconTile';
import { WeekStrip } from '../../ui/WeekStrip';

const PRESETS: ReadonlyArray<[number, number]> = [
  [6, 0],
  [7, 0],
  [7, 30],
  [8, 0],
  [14, 0],
  [16, 0],
  [18, 30],
  [20, 0],
];

interface MatchDateTimePickerProps {
  value: Date;
  onChange: (d: Date) => void;
  now: Date;
  markedDates?: Record<string, MarkedDay>;
}

/** Friendly local date + time picker: a day strip, common start times, and a ±15 min nudge. */
export function MatchDateTimePicker({ value, onChange, now, markedDates }: MatchDateTimePickerProps) {
  const times = useMemo(() => {
    const list = [...PRESETS];
    const current: [number, number] = [value.getHours(), value.getMinutes()];
    if (!list.some(([h, m]) => h === current[0] && m === current[1])) list.push(current);
    return list.sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
  }, [value]);

  const nudge = (delta: number) => {
    haptic('selection');
    onChange(shiftMinutes(value, delta));
  };

  return (
    <View>
      <AppText variant="overline" color={colors.textMuted} style={styles.label}>
        Pick the day
      </AppText>
      <WeekStrip
        selectedDate={value}
        onSelectDate={d => d && onChange(combineDateAndTime(d, value.getHours(), value.getMinutes()))}
        now={now}
        markedDates={markedDates}
        allowDeselect={false}
        daysBefore={7}
        daysAfter={120}
      />

      <AppText variant="overline" color={colors.textMuted} style={[styles.label, styles.gap]}>
        Start time
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.times}>
        {times.map(([h, m]) => {
          const t = combineDateAndTime(value, h, m);
          return (
            <Chip
              key={`${h}:${m}`}
              label={formatTime(t)}
              selected={value.getHours() === h && value.getMinutes() === m}
              onPress={() => onChange(t)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.stepper}>
        <Pressable onPress={() => nudge(-15)} style={styles.step} accessibilityLabel="15 minutes earlier">
          <Icon name="minus" size={18} weight="bold" color={colors.text} />
          <AppText variant="caption">15m</AppText>
        </Pressable>
        <Animated.View key={value.getTime()} entering={FadeIn.duration(160)} style={styles.timeWrap}>
          <GradientText variant="h1" style={styles.time}>
            {formatTime(value)}
          </GradientText>
        </Animated.View>
        <Pressable onPress={() => nudge(15)} style={styles.step} accessibilityLabel="15 minutes later">
          <Icon name="add" size={18} weight="bold" color={colors.text} />
          <AppText variant="caption">15m</AppText>
        </Pressable>
      </View>

      <View style={styles.summary} accessible accessibilityLabel={`${formatFullDate(value)} at ${formatTime(value)}`}>
        <IconTile icon="calendarCheck" tone="emerald" size="md" />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{formatFullDate(value)}</AppText>
          <AppText variant="caption" color={palette.green700}>
            {formatTime(value)} · {relativeDayLabel(value, now)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { marginBottom: 6 },
  gap: { marginTop: 14 },
  times: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 14 },
  step: {
    width: 64,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.rim,
    ...shadows.soft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  timeWrap: { minWidth: 120, alignItems: 'center' },
  time: { fontSize: 30, lineHeight: 36 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    backgroundColor: 'rgba(209,250,229,0.55)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
  },
});

export default MatchDateTimePicker;
