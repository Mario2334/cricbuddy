import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { Match } from '../types/Match';
import { colors, curve, easings, enter, fonts, glass, glows, gradients, palette, radii, springs, type IconTone } from '../theme';
import { formatDayMonthYear, formatDayName, formatFullDate, greeting, startedAgoLabel, type GreetingKey } from '../utils/dates';
import { getMatchStart, getTeamNames } from '../utils/matchDisplay';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { BouncingBall } from './CricketBall';
import { Button } from './Button';
import { CountdownTiles } from './CountdownTiles';
import { GlassView } from './GlassView';
import { GradientText } from './GradientText';
import { Icon } from './Icon';
import { IconTile } from './IconTile';
import { PulseDot } from './PulseDot';
import { Skeleton } from './Skeleton';
import { StatusDateChip } from './StatusDateChip';
import { useConfetti } from './Confetti';

export interface TodayHeroProps {
  now: Date;
  firstName: string;
  liveMatch?: Match | null;
  nextMatch?: Match | null;
  loading?: boolean;
  /** Pause the per-second countdown (e.g. when the screen is not focused). */
  tickEnabled?: boolean;
  onPressMatch?: (m: Match) => void;
  onPressAdd?: () => void;
  /** List scroll offset, drives the parallax shrink. */
  scrollY?: SharedValue<number>;
}

const GREETING_TONE: Record<GreetingKey, IconTone> = {
  morning: 'amber',
  afternoon: 'amber',
  evening: 'violet',
  night: 'violet',
};

function usePressScale() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(0.98, springs.press);
    },
    onPressOut: () => {
      scale.value = withSpring(1, springs.release);
    },
  };
}

function LiveBlock({ match, now, onPress }: { match: Match; now: Date; onPress?: (m: Match) => void }) {
  const { team1, team2 } = getTeamNames(match);
  const start = getMatchStart(match);
  const press = usePressScale();
  return (
    <Animated.View style={[press.style, glows.rose, styles.blockRadius]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          haptic('light');
          onPress?.(match);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Live now: ${team1} versus ${team2}. Open scorecard`}
      >
        <LinearGradient colors={gradients.rose} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.block, styles.blockRadius]}>
          <LinearGradient colors={gradients.glassSheen} style={styles.sheen} />
          <View style={styles.liveTop}>
            <PulseDot color={palette.white} size={9} />
            <AppText variant="overline" color={palette.white} style={styles.liveLabel}>
              Live now
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.85)">
              {start ? startedAgoLabel(start, now) : 'in play'}
            </AppText>
          </View>
          <AppText variant="h2" color={palette.white} numberOfLines={1}>
            {team1} <AppText variant="h3" color="rgba(255,255,255,0.75)">vs</AppText> {team2}
          </AppText>
          <View style={styles.liveCta}>
            <AppText variant="smallStrong" color={palette.white}>
              Open scorecard
            </AppText>
            <Icon name="arrowRight" size={14} weight="bold" color={palette.white} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function NextBlock({
  match,
  now,
  tickEnabled,
  onPress,
}: {
  match: Match;
  now: Date;
  tickEnabled: boolean;
  onPress?: (m: Match) => void;
}) {
  const { team1, team2 } = getTeamNames(match);
  const start = getMatchStart(match);
  const confetti = useConfetti();
  const [gameTime, setGameTime] = useState(false);
  const press = usePressScale();
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const onZero = useCallback(() => {
    shake.value = withSequence(
      withTiming(-6, { duration: 60, easing: easings.inOut }),
      withTiming(6, { duration: 80, easing: easings.inOut }),
      withTiming(-3, { duration: 80, easing: easings.inOut }),
      withTiming(0, { duration: 120, easing: easings.out }),
    );
    setGameTime(true);
    confetti.fire();
  }, [confetti, shake]);

  return (
    <Animated.View style={[press.style, shakeStyle]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          haptic('light');
          onPress?.(match);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Next match: ${team1} versus ${team2}`}
      >
        <GlassView mode="frost" radius={radii.lg} shadow="soft" style={styles.block}>
          <View style={styles.nextTop}>
            <View style={styles.inline}>
              {gameTime ? <Icon name="bat" size={14} weight="fill" color={colors.primaryStrong} /> : null}
              <AppText variant="overline" color={colors.primaryStrong}>
                {gameTime ? "It's game time!" : 'Next match in'}
              </AppText>
            </View>
            <StatusDateChip status="upcoming" start={start} now={now} size="sm" />
          </View>
          {gameTime || !start ? (
            <Animated.View entering={enter.pop()} style={[styles.inline, styles.gameTime]}>
              <Icon name={start ? 'fire' : 'ai'} size={22} weight="fill" color={start ? palette.amber500 : colors.textMuted} />
              <AppText variant="h2" color={colors.primaryStrong}>
                {start ? "Go get 'em!" : 'Date to be decided'}
              </AppText>
            </Animated.View>
          ) : (
            <View style={styles.countdown}>
              <CountdownTiles target={start} enabled={tickEnabled} onZero={onZero} />
            </View>
          )}
          <AppText variant="title" numberOfLines={1}>
            {team1} <AppText variant="title" color={palette.lime600}>vs</AppText> {team2}
          </AppText>
          {match.ground_name ? (
            <View style={[styles.inline, styles.ground]}>
              <Icon name="pin" size={13} weight="fill" color={colors.textMuted} />
              <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flexShrink}>
                {match.ground_name}
              </AppText>
            </View>
          ) : null}
        </GlassView>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The Home hero: greeting, today's full date, a bouncing ball, and either the
 * live match, a ticking countdown to the next one, or a nudge to add one.
 */
export function TodayHero({
  now,
  firstName,
  liveMatch,
  nextMatch,
  loading,
  tickEnabled = true,
  onPressMatch,
  onPressAdd,
  scrollY,
}: TodayHeroProps) {
  const reduced = useReducedMotion();
  const g = greeting(now);

  // Frost (not blur) here: this view's opacity animates with scroll and on entry.
  const heroStyle = useAnimatedStyle(() => {
    if (!scrollY || reduced) return {};
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, 280], [1, 0.4], 'clamp'),
      transform: [
        { translateY: interpolate(y, [-120, 0], [-40, 0], 'clamp') },
        { scale: interpolate(y, [-120, 0, 260], [1.03, 1, 0.94], 'clamp') },
      ],
    };
  });

  const tileStyle = useAnimatedStyle(() => {
    if (!scrollY || reduced) return {};
    return { transform: [{ rotate: `${interpolate(scrollY.value, [-100, 0, 240], [-20, 0, 60], 'clamp')}deg` }] };
  });

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(480).easing(easings.out)} style={heroStyle}>
      <GlassView mode="frost" radius={radii.xl} shadow="glass" fill={glass.fill} style={styles.hero}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.heroClip]}>
          <View style={[styles.orb, styles.orbA]} />
          <View style={[styles.orb, styles.orbB]} />
          <LinearGradient colors={gradients.glassSheen} style={styles.heroSheen} />
        </View>
        <View
          style={styles.topRow}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${g.text}, ${firstName}. Today is ${formatFullDate(now)}`}
        >
          <View style={styles.texts}>
            <View style={styles.greetRow}>
              <Animated.View style={tileStyle}>
                <IconTile icon={g.key} tone={GREETING_TONE[g.key]} size="sm" />
              </Animated.View>
              <AppText variant="title" color={colors.textSoft} numberOfLines={1} style={styles.greet}>
                {g.text}, {firstName}
              </AppText>
            </View>
            <AppText variant="overline" color={colors.primaryStrong} style={styles.todayIs}>
              Today is
            </AppText>
            <GradientText variant="hero" style={styles.dayName} accessibilityRole="text">
              {formatDayName(now)}
            </GradientText>
            <AppText variant="h3" color={colors.textSoft}>
              {formatDayMonthYear(now)}
            </AppText>
          </View>
          <BouncingBall size={44} height={22} />
        </View>

        <View style={styles.bottom}>
          {loading && !liveMatch && !nextMatch ? (
            <Skeleton height={124} radius={radii.lg} />
          ) : liveMatch ? (
            <LiveBlock match={liveMatch} now={now} onPress={onPressMatch} />
          ) : nextMatch ? (
            <NextBlock match={nextMatch} now={now} tickEnabled={tickEnabled} onPress={onPressMatch} />
          ) : (
            <GlassView mode="frost" radius={radii.lg} shadow="soft" style={[styles.block, styles.emptyBlock]}>
              <IconTile icon="restDay" tone="amber" size="md" />
              <View style={styles.texts}>
                <AppText variant="title">No matches lined up</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  Add one and we'll count down to it.
                </AppText>
              </View>
              {onPressAdd ? <Button label="Add" icon="add" size="sm" variant="primary" onPress={onPressAdd} /> : null}
            </GlassView>
          )}
        </View>
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 18 },
  heroClip: { borderRadius: radii.xl, overflow: 'hidden', ...curve },
  orb: { position: 'absolute', borderRadius: 999 },
  orbA: { width: 220, height: 220, top: -90, right: -70, backgroundColor: palette.emerald300, opacity: 0.35 },
  orbB: { width: 160, height: 160, bottom: -60, left: -50, backgroundColor: palette.yellow300, opacity: 0.3 },
  heroSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  topRow: { flexDirection: 'row', alignItems: 'flex-end' },
  texts: { flex: 1 },
  greetRow: { flexDirection: 'row', alignItems: 'center' },
  greet: { flexShrink: 1, marginLeft: 10 },
  todayIs: { marginTop: 12 },
  dayName: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  bottom: { marginTop: 16 },
  block: { padding: 14 },
  blockRadius: { borderRadius: radii.lg, ...curve, overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flexShrink: { flexShrink: 1 },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  countdown: { marginBottom: 12 },
  gameTime: { marginBottom: 10 },
  ground: { marginTop: 4 },
  liveTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  liveLabel: { marginLeft: 8, marginRight: 8 },
  liveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: glass.fillDark,
    borderWidth: 1,
    borderColor: glass.rimDark,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

export default TodayHero;
