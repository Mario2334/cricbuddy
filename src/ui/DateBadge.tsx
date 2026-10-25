import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, curve, easings, fonts, glass, glows, gradients, palette, shadows } from '../theme';
import { badgeParts, isSameLocalDay, relativeDayLabel, toDate, type DateInput, type MatchStatus } from '../utils/dates';
import { AppText } from './AppText';

export type DateBadgeTone = 'auto' | 'today' | 'upcoming' | 'live' | 'past' | 'neutral' | 'onDark';
type ResolvedTone = Exclude<DateBadgeTone, 'auto'>;

const BANDS: Record<ResolvedTone, readonly [string, string]> = {
  today: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.10)'],
  upcoming: gradients.primary,
  live: gradients.live,
  past: ['#94A3B8', '#64748B'],
  neutral: ['#334155', '#0F172A'],
  onDark: gradients.accent,
};

const SIZES = {
  sm: { w: 44, h: 52, band: 15, day: 18, month: 9, week: 8, radius: 13 },
  md: { w: 52, h: 60, band: 17, day: 22, month: 10, week: 9, radius: 16 },
  lg: { w: 64, h: 72, band: 20, day: 28, month: 11, week: 10, radius: 19 },
} as const;

export interface DateBadgeProps {
  date: DateInput;
  now: Date;
  status?: MatchStatus;
  tone?: DateBadgeTone;
  size?: keyof typeof SIZES;
  /** @deprecated no longer tilts; kept for call-site compatibility. */
  tilt?: boolean;
  showRelative?: boolean;
  /** Delay for the entrance, to sync with list stagger. */
  delay?: number;
}

function resolveTone(tone: DateBadgeTone, date: Date | null, now: Date, status?: MatchStatus): ResolvedTone {
  if (tone !== 'auto') return tone;
  if (status === 'live') return 'live';
  if (!date) return 'neutral';
  if (isSameLocalDay(date, now)) return 'today';
  if (status === 'past' || date.getTime() < now.getTime()) return 'past';
  return 'upcoming';
}

/** Glass date tile: gradient weekday band, big day number, month. Today glows. */
export function DateBadge({ date, now, status, tone = 'auto', size = 'md', showRelative = false, delay = 0 }: DateBadgeProps) {
  const reduced = useReducedMotion();
  const d = toDate(date);
  const resolved = resolveTone(tone, d, now, status);
  const s = SIZES[size];
  const parts = d ? badgeParts(d) : { weekday: 'DATE', day: '?', month: 'TBD' };
  const today = resolved === 'today';
  const onDark = resolved === 'onDark';
  const filled = today;

  const appear = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    appear.value = withDelay(delay, withTiming(1, { duration: 300, easing: easings.out }));
  }, [reduced, delay, appear]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.92 + appear.value * 0.08 }],
  }));

  const dayColor = filled || onDark ? palette.white : resolved === 'past' ? colors.textMuted : colors.text;
  const monthColor = filled || onDark ? 'rgba(255,255,255,0.85)' : colors.textMuted;
  const weekColor = resolved === 'onDark' ? colors.onAccent : palette.white;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={d ? `${parts.weekday} ${parts.day} ${parts.month}` : 'Date to be decided'}>
      <Animated.View
        style={[
          { width: s.w, height: s.h, borderRadius: s.radius },
          curve,
          today ? glows.emerald : resolved === 'live' ? glows.rose : shadows.soft,
          style,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: s.radius }, curve]}>
          {filled ? (
            <LinearGradient colors={gradients.primaryVivid} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: onDark ? glass.fillDark : glass.fillStrong }]} />
          )}
          <LinearGradient colors={BANDS[resolved]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.band, { height: s.band }]}>
            <AppText
              style={{ fontFamily: fonts.bodyBlack, fontSize: s.week, lineHeight: s.week + 3, letterSpacing: 0.5 }}
              color={weekColor}
            >
              {parts.weekday}
            </AppText>
          </LinearGradient>
          <View style={styles.body}>
            <AppText
              style={{ fontFamily: fonts.displayBold, fontSize: s.day, lineHeight: s.day + 3, letterSpacing: -0.5 }}
              color={dayColor}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {parts.day}
            </AppText>
            <AppText
              style={{ fontFamily: fonts.bodyExtraBold, fontSize: s.month, lineHeight: s.month + 2, letterSpacing: 0.5 }}
              color={monthColor}
            >
              {parts.month}
            </AppText>
          </View>
        </View>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: s.radius, borderWidth: 1, borderColor: onDark ? glass.rimDark : 'rgba(255,255,255,0.75)' },
            curve,
          ]}
        />
      </Animated.View>
      {showRelative && d ? (
        <AppText variant="caption" color={today ? colors.primaryStrong : colors.textMuted} numberOfLines={1} style={styles.relative}>
          {relativeDayLabel(d, now)}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  clip: { overflow: 'hidden' },
  band: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 2 },
  relative: { marginTop: 5, maxWidth: 80, textAlign: 'center' },
});

export default DateBadge;
