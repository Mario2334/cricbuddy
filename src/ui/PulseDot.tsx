import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAmbientLoop } from '../hooks/useScreenActivity';

interface PulseDotProps {
  color: string;
  size?: number;
  pulsing?: boolean;
}

/** A softly glowing dot with an expanding ring, used for LIVE indicators. Pulses only while on screen. */
export function PulseDot({ color, size = 8, pulsing = true }: PulseDotProps) {
  const ring = useSharedValue(0);

  useAmbientLoop(
    () => {
      ring.value = 0;
      ring.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    },
    () => {
      cancelAnimation(ring);
      ring.value = 0;
    },
    pulsing,
  );

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
