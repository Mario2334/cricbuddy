import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface PulseDotProps {
  color: string;
  size?: number;
  pulsing?: boolean;
}

/** A softly glowing dot with an expanding ring, used for LIVE indicators. */
export function PulseDot({ color, size = 8, pulsing = true }: PulseDotProps) {
  const reduced = useReducedMotion();
  const ring = useSharedValue(0);

  useEffect(() => {
    if (pulsing && !reduced) {
      ring.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      cancelAnimation(ring);
      ring.value = 0;
    }
    return () => cancelAnimation(ring);
  }, [pulsing, reduced, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 1.8 }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      {pulsing && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, ringStyle]}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color, boxShadow: `0px 0px 6px ${color}` }} />
    </View>
  );
}

export default PulseDot;
