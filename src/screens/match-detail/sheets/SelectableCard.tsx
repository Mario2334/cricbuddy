import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, curve, easings, enter, glass, glows, gradients, palette, radii, shadows, space, springs } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { Icon } from '../../../ui/Icon';
import { haptic } from '../../../utils/haptics';

export interface SelectableCardProps {
  title: string;
  lines?: Array<string | null | undefined>;
  selected: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
  testID?: string;
}

const CHECK = 28;

/** Frosted selectable row for the bottom sheets; picked = emerald rim, glow and a gradient check. */
export function SelectableCard({ title, lines = [], selected, onPress, leading, testID }: SelectableCardProps) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    if (!selected || reduced) return;
    pulse.value = withSequence(withTiming(1.02, { duration: 110, easing: easings.out }), withSpring(1, springs.release));
  }, [selected, reduced, pulse]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value * press.value }] }));
  const visibleLines = lines.filter((l): l is string => !!l);

  return (
    <Animated.View style={[styles.shell, curve, selected ? glows.emerald : shadows.glass, style]}>
      <Pressable
        testID={testID}
        onPressIn={() => {
          if (!reduced) press.value = withSpring(0.98, springs.press);
        }}
        onPressOut={() => {
          press.value = reduced ? 1 : withSpring(1, springs.release);
        }}
        onPress={() => {
          haptic('selection');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[styles.card, curve, selected ? styles.cardSelected : styles.cardIdle]}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.rim, curve, selected ? styles.rimSelected : styles.rimIdle]}
        />
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.texts}>
          <AppText variant="title" numberOfLines={2}>
            {title}
          </AppText>
          {visibleLines.map((line, i) => (
            <AppText key={i} variant="small" color={colors.textMuted} numberOfLines={2}>
              {line}
            </AppText>
          ))}
        </View>
        {selected ? (
          <Animated.View entering={reduced ? undefined : enter.pop()} style={[styles.check, glows.emerald]}>
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.checkFace]}
            />
            <Icon name="check" size={16} weight="bold" color={palette.white} />
          </Animated.View>
        ) : (
          <View style={styles.checkEmpty} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: radii.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  cardIdle: {
    backgroundColor: glass.fillStrong,
    borderColor: glass.hairline,
  },
  cardSelected: {
    backgroundColor: 'rgba(236,253,245,0.92)',
    borderColor: 'transparent',
  },
  rim: { borderRadius: radii.md },
  rimIdle: { borderWidth: 1, borderColor: glass.rim },
  rimSelected: { borderWidth: 1.5, borderColor: palette.green500 },
  leading: { alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkFace: { borderRadius: CHECK / 2 },
  checkEmpty: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: glass.fill,
  },
});

export default SelectableCard;
