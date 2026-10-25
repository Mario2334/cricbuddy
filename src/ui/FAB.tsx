import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { curve, easings, enter, glows, gradients, palette, springs, tones } from '../theme';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface FABProps {
  onPress: () => void;
  icon?: IconName;
  label?: string;
  bottomOffset: number;
  /** Idle glow "breathe" every few seconds to invite a tap. */
  attention?: boolean;
  accessibilityLabel?: string;
}

const SIZE = 58;
const RADIUS = 20;
const GLOSS = ['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)'] as const;
const BREATHE = { duration: 1100, easing: Easing.inOut(Easing.sin) };

/** Vivid gradient action button: pops in, breathes a soft glow when idle, turns its icon on press. */
export function FAB({ onPress, icon = 'add', label, bottomOffset, attention = false, accessibilityLabel }: FABProps) {
  const reduced = useReducedMotion();
  const breathe = useSharedValue(0);
  const scale = useSharedValue(1);
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!attention || reduced) {
      cancelAnimation(breathe);
      breathe.value = 0;
      return;
    }
    // ~3s cycle: swell, settle, rest.
    breathe.value = withRepeat(
      withSequence(withTiming(1, BREATHE), withTiming(0, BREATHE), withDelay(800, withTiming(0, { duration: 0 }))),
      -1,
      false,
    );
    return () => cancelAnimation(breathe);
  }, [attention, reduced, breathe]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const breatheStyle = useAnimatedStyle(() => ({ opacity: breathe.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.View entering={reduced ? undefined : enter.pop(350)} style={[styles.wrap, { bottom: bottomOffset }]}>
      <Animated.View style={pressStyle}>
        {attention && !reduced ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.halo, curve, breatheStyle]} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || label || 'Add'}
          onPressIn={() => {
            if (reduced) return;
            scale.value = withSpring(0.92, springs.press);
            turn.value = withTiming(45, { duration: 200, easing: easings.out });
          }}
          onPressOut={() => {
            if (reduced) return;
            scale.value = withSpring(1, springs.release);
            turn.value = withTiming(0, { duration: 320, easing: easings.out });
          }}
          onPress={() => {
            haptic('medium');
            onPress();
          }}
          style={[styles.fab, curve, glows.emerald, label ? styles.extended : null]}
        >
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, curve]}>
            <LinearGradient
              colors={gradients.primaryVivid}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient colors={GLOSS} style={styles.gloss} />
          </View>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, curve]} />
          <Animated.View style={iconStyle}>
            <Icon name={icon} size={26} color={palette.white} weight="bold" />
          </Animated.View>
          {label ? (
            <AppText variant="title" color={palette.white} style={styles.label}>
              {label}
            </AppText>
          ) : null}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 18 },
  fab: {
    height: SIZE,
    minWidth: SIZE,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  clip: { borderRadius: RADIUS, overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: SIZE * 0.5 },
  rim: { borderRadius: RADIUS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  halo: {
    borderRadius: RADIUS,
    boxShadow: `0px 0px 28px 6px ${tones.emerald.glow}`,
  },
  extended: { paddingHorizontal: 20 },
  label: { marginLeft: 8 },
});

export default FAB;
