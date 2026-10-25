import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { CricketBallSvg } from './CricketBall';

interface PullBallProps {
  scrollY: SharedValue<number>;
  refreshing: boolean;
}

/**
 * iOS pull-to-refresh indicator: a cricket ball that grows and spins with the
 * pull distance, then keeps spinning while refreshing. Place it at the top of
 * a list header (it sits in the overscroll gap) and give the RefreshControl a
 * transparent tint on iOS.
 */
export function PullBall({ scrollY, refreshing }: PullBallProps) {
  const spin = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      spin.value = withRepeat(withTiming(spin.value + 360, { duration: 650, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
    }
  }, [refreshing, spin]);

  const style = useAnimatedStyle(() => {
    const pull = -scrollY.value;
    return {
      opacity: refreshing ? 1 : interpolate(pull, [12, 50], [0, 1], 'clamp'),
      transform: [
        { scale: refreshing ? 1 : interpolate(pull, [0, 90], [0.3, 1], 'clamp') },
        { rotate: `${pull * 4 + spin.value}deg` },
      ],
    };
  });

  if (Platform.OS !== 'ios') return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={style}>
        <CricketBallSvg size={30} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -52, left: 0, right: 0, alignItems: 'center' },
});

export default PullBall;
