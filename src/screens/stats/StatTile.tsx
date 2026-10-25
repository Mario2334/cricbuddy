import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, curve, easings, enterUp, fonts, glass, glows, radii, shadows, springs, tones } from '../../theme';
import { AppText } from '../../ui/AppText';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { Icon } from '../../ui/Icon';
import { IconTile } from '../../ui/IconTile';
import { haptic } from '../../utils/haptics';
import { isHighlightStat, statIcon, type StatItem, type StatKind } from './statMeta';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const COUNT_STAGGER_MS = 60;
const COUNT_DURATION_MS = 900;
const WIGGLE = { easing: easings.inOut };

export interface StatTileProps {
  stat: StatItem;
  index: number;
  kind: StatKind;
  /** Flips to true whenever the screen (re)gains focus to replay the count-up. */
  play: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Frosted glass tile: glossy icon tile, counting number, caption. Tap to replay. */
export function StatTile({ stat, index, kind, play, style }: StatTileProps) {
  const reduced = useReducedMotion();
  const { icon, tone } = statIcon(stat.title, kind);
  const ink = tones[tone].softInk;
  const highlight = isHighlightStat(stat.title);
  const countDelay = index * COUNT_STAGGER_MS;

  // Remounting the number replays its count-up from zero.
  const [replay, setReplay] = useState(0);

  const scale = useSharedValue(1);
  const wiggle = useSharedValue(0);
  const star = useSharedValue(reduced && highlight ? 1 : 0);

  useEffect(() => {
    if (!highlight) return;
    if (reduced) {
      star.value = 1;
      return;
    }
    if (!play) return;
    // Lands right after the number finishes counting.
    const at = countDelay + COUNT_DURATION_MS - 150;
    wiggle.value = withDelay(
      at,
      withSequence(
        withTiming(-4, { ...WIGGLE, duration: 110 }),
        withTiming(3, { ...WIGGLE, duration: 140 }),
        withTiming(-1.5, { ...WIGGLE, duration: 130 }),
        withSpring(0, springs.release),
      ),
    );
    star.value = 0;
    star.value = withDelay(at, withTiming(1, { duration: 360, easing: easings.out }));
  }, [highlight, reduced, play, countDelay, wiggle, star]);

  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${wiggle.value}deg` }],
  }));
  const starStyle = useAnimatedStyle(() => ({
    opacity: star.value,
    transform: [{ scale: 0.4 + star.value * 0.6 }, { rotate: `${(1 - star.value) * -60}deg` }],
  }));

  return (
    <Animated.View entering={reduced ? undefined : enterUp(index)} style={style}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${stat.title}: ${stat.value}`}
        accessibilityHint="Replays the count"
        onPressIn={() => {
          scale.value = withSpring(0.95, springs.press);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, springs.release);
        }}
        onPress={() => {
          haptic('light');
          setReplay(r => r + 1);
        }}
        style={tileStyle}
      >
        <View style={[styles.tile, highlight && styles.highlight]}>
          <View pointerEvents="none" style={styles.rim} />
          <View style={styles.topRow}>
            <IconTile icon={icon} tone={tone} size="md" />
            {highlight ? (
              <Animated.View style={[styles.star, starStyle]} pointerEvents="none">
                <Icon
                  name="highlight"
                  size={22}
                  color={tones.lime.softInk}
                  duotoneColor={tones.lime.to}
                  duotoneOpacity={0.85}
                />
              </Animated.View>
            ) : null}
          </View>
          <AnimatedNumber
            key={replay}
            value={stat.value}
            play={play}
            delay={replay ? 0 : countDelay}
            duration={COUNT_DURATION_MS}
            color={ink}
            style={styles.value}
          />
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2} style={styles.title}>
            {stat.title}
          </AppText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Frost (never blur): the tile fades in with the grid stagger.
  tile: {
    minHeight: 132,
    padding: 14,
    borderRadius: radii.lg,
    ...curve,
    backgroundColor: glass.fillStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    ...shadows.glass,
  },
  highlight: glows.lime,
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    ...curve,
    borderWidth: 1,
    borderColor: glass.rim,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  star: { marginTop: -2, marginRight: -2 },
  value: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.6,
    marginTop: 12,
  },
  title: { marginTop: 2 },
});

export default StatTile;
