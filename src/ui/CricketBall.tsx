import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '../utils/haptics';

let gradientSeq = 0;

/** Static SVG cricket ball: red leather, cream stitched seam, glossy highlight. */
export function CricketBallSvg({ size = 48 }: { size?: number }) {
  const id = useRef(`ballGrad${++gradientSeq}`).current;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#F87171" />
          <Stop offset="0.55" stopColor="#DC2626" />
          <Stop offset="1" stopColor="#7F1D1D" />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={48} fill={`url(#${id})`} />
      <Path d="M33 5 C 50 30, 50 70, 33 95" stroke="#FEF3C7" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Path d="M41 3 C 58 30, 58 70, 41 97" stroke="#FEF3C7" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Path
        d="M29 8 C 45 31, 45 69, 29 92"
        stroke="#FDE68A"
        strokeWidth={2}
        strokeDasharray="3 4"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M45 3 C 62 31, 62 69, 45 97"
        stroke="#FDE68A"
        strokeWidth={2}
        strokeDasharray="3 4"
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx={30} cy={27} rx={11} ry={6} fill="rgba(255,255,255,0.35)" transform="rotate(-25 30 27)" />
    </Svg>
  );
}

interface BouncingBallProps {
  size?: number;
  /** Peak height of the idle bounce, in px. */
  height?: number;
}

/**
 * Idle-bouncing ball with squash & stretch and a ground shadow. Tap it for a
 * big bounce and a spin.
 */
export function BouncingBall({ size = 44, height = 26 }: BouncingBallProps) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const kick = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-height, { duration: 430, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 430, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    spin.value = withRepeat(withTiming(360, { duration: 2600, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(y);
      cancelAnimation(spin);
    };
  }, [reduced, height, y, spin]);

  const ballStyle = useAnimatedStyle(() => {
    const lift = -(y.value + kick.value) / height; // 0 on the ground, 1+ in the air
    const scaleY = interpolate(lift, [0, 0.12, 1], [0.8, 1, 1.05], 'clamp');
    const scaleX = interpolate(lift, [0, 0.12, 1], [1.18, 1, 0.97], 'clamp');
    return {
      transform: [{ translateY: y.value + kick.value }, { scaleX }, { scaleY }],
    };
  });

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  const shadowStyle = useAnimatedStyle(() => {
    const lift = -(y.value + kick.value) / height;
    return {
      opacity: interpolate(lift, [0, 1, 3], [0.32, 0.14, 0.05], 'clamp'),
      transform: [{ scaleX: interpolate(lift, [0, 1, 3], [1, 0.6, 0.35], 'clamp') }],
    };
  });

  const onTap = () => {
    haptic('medium');
    kick.value = withSequence(
      withTiming(-height * 2.4, { duration: 360, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 360, easing: Easing.in(Easing.quad) }),
      withSpring(0, { damping: 6, stiffness: 300 }),
    );
    spin.value = withTiming(spin.value + 720, { duration: 900, easing: Easing.out(Easing.cubic) }, () => {
      spin.value = withRepeat(withTiming(spin.value + 360, { duration: 2600, easing: Easing.linear }), -1, false);
    });
  };

  return (
    <Pressable onPress={onTap} hitSlop={12} accessibilityRole="button" accessibilityLabel="Bounce the ball">
      <View style={{ width: size * 1.4, height: size + height * 0.6, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Animated.View style={[{ transformOrigin: 'bottom' }, ballStyle]}>
          <Animated.View style={spinStyle}>
            <CricketBallSvg size={size} />
          </Animated.View>
        </Animated.View>
        <Animated.View
          style={[styles.shadow, { width: size * 0.9, height: size * 0.18, borderRadius: size }, shadowStyle]}
        />
      </View>
    </Pressable>
  );
}

/** A spinning ball, used as a playful loading spinner. */
export function SpinningBall({ size = 28 }: { size?: number }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    bob.value = withRepeat(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(bob);
    };
  }, [reduced, spin, bob]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -bob.value * size * 0.25 }, { rotate: `${spin.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <CricketBallSvg size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: '#78350F',
    marginTop: 2,
  },
});

export default BouncingBall;
