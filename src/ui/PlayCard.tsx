import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { curve, enterUp, glass, radii, shadows, springs, tones } from '../theme';
import { haptic, type HapticKind } from '../utils/haptics';
import { useAmbientLoop } from '../hooks/useScreenActivity';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PlayCardTone = 'default' | 'live' | 'upcoming' | 'past' | 'sunny';

export interface PlayCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: PlayCardTone;
  haptic?: HapticKind | false;
  pressScale?: number;
  /** Index in a list; enables the staggered entrance animation. */
  animateIndex?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** Rose-300 rim for live cards. */
const LIVE_RIM = '#FDA4AF';
/** Lime-100 at 85%: the accent tint for sunny cards. */
const SUNNY_FILL = 'rgba(236,252,203,0.85)';

/**
 * Frosted card that dips on press and settles back. Frost, not BlurView: cards
 * animate in and live in lists, and blur glitches under an animating ancestor.
 */
export function PlayCard({
  children,
  onPress,
  onLongPress,
  tone = 'default',
  haptic: hapticKind = 'light',
  pressScale = 0.98,
  animateIndex,
  style,
  contentStyle,
  accessibilityLabel,
  testID,
}: PlayCardProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const live = tone === 'live';

  // The live glow breathes only while the card's screen is on show.
  useAmbientLoop(
    () => {
      glow.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    },
    () => {
      cancelAnimation(glow);
      glow.value = 0;
    },
    live,
  );

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.65 }));

  const interactive = !!(onPress || onLongPress);

  return (
    <Animated.View
      entering={animateIndex !== undefined && !reduced ? enterUp(animateIndex) : undefined}
      style={style}
    >
      {live ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.liveGlow, curve, glowStyle]} />
      ) : null}
      <AnimatedPressable
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        disabled={!interactive}
        onPressIn={() => {
          if (!reduced) scale.value = withSpring(pressScale, springs.press);
        }}
        onPressOut={() => {
          if (!reduced) scale.value = withSpring(1, springs.release);
        }}
        onPress={() => {
          if (hapticKind) haptic(hapticKind);
          onPress?.();
        }}
        onLongPress={onLongPress}
        style={[styles.card, curve, tone === 'sunny' && styles.sunny, pressStyle]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, curve, live && styles.liveRim]} />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.fillStrong,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    ...shadows.row,
  },
  sunny: {
    backgroundColor: SUNNY_FILL,
  },
  rim: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: glass.rim,
  },
  liveRim: {
    borderWidth: 2,
    borderColor: LIVE_RIM,
  },
  content: {
    padding: 14,
  },
  liveGlow: {
    borderRadius: radii.lg,
    backgroundColor: tones.rose.soft,
    boxShadow: `0px 0px 22px 0px ${tones.rose.glow}`,
  },
});

export default PlayCard;
