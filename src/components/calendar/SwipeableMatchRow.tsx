import React, { useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { curve, glows, gradients, palette, radii } from '../../theme';
import { haptic } from '../../utils/haptics';
import { AppText } from '../../ui/AppText';
import { Icon } from '../../ui/Icon';

function RemoveAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.8, 1], 'clamp'),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1], 'clamp') }],
  }));
  return (
    <Animated.View style={[styles.actionWrap, style]}>
      <Pressable onPress={onPress} style={[styles.action, glows.rose]} accessibilityRole="button" accessibilityLabel="Remove from schedule">
        <LinearGradient colors={gradients.rose} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.fill]} />
        <Icon name="trash" size={22} weight="duotone" color={palette.white} duotoneColor={palette.white} />
        <AppText variant="caption" color={palette.white}>
          Remove
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

interface SwipeableMatchRowProps {
  children: React.ReactNode;
  onRemove: () => void;
}

/** Swipe left to reveal a coral "Remove" action that grows as it's revealed. */
export function SwipeableMatchRow({ children, onRemove }: SwipeableMatchRowProps) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.8}
      rightThreshold={56}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic('warning')}
      renderRightActions={progress => (
        <RemoveAction
          progress={progress}
          onPress={() => {
            ref.current?.close();
            onRemove();
          }}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionWrap: { justifyContent: 'center', paddingLeft: 10, paddingBottom: 14 },
  action: {
    width: 82,
    flex: 1,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...curve,
  },
  fill: { borderRadius: radii.lg, ...curve },
});

export default SwipeableMatchRow;
