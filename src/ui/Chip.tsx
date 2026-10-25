import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  colors,
  curve,
  easings,
  glass,
  glows,
  gradients,
  palette,
  radii,
  springs,
  tones,
  type IconTone,
} from '../theme';
import { haptic, type HapticKind } from '../utils/haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface ChipProps {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  tone?: 'green' | 'yellow' | 'coral' | 'neutral';
  /** Built-in tap haptic; pass false when the caller already fires one. */
  haptic?: HapticKind | false;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface ToneSpec {
  gradient?: readonly [ColorValue, ColorValue, ...ColorValue[]];
  solid?: string;
  text: string;
  /** Ink used on the unselected frost pill. */
  ink: string;
  glow: IconTone;
}

const TONES: Record<NonNullable<ChipProps['tone']>, ToneSpec> = {
  green: { gradient: gradients.primary, text: colors.onPrimary, ink: tones.emerald.softInk, glow: 'emerald' },
  yellow: { gradient: gradients.accent, text: colors.onAccent, ink: tones.lime.softInk, glow: 'lime' },
  coral: { gradient: gradients.rose, text: palette.white, ink: tones.rose.softInk, glow: 'rose' },
  neutral: { solid: palette.ink, text: palette.white, ink: colors.textSoft, glow: 'slate' },
};

/** Frosted filter / info pill that turns into a glowing gradient pill when selected. */
export function Chip({
  label,
  icon,
  selected = false,
  onPress,
  onRemove,
  size = 'md',
  tone = 'green',
  haptic: hapticKind = 'selection',
  style,
  testID,
}: ChipProps) {
  const t = TONES[tone];
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: 110, easing: easings.out }),
      withSpring(1, springs.release),
    );
  }, [selected, scale, reduced]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fg = selected ? t.text : t.ink;
  const small = size === 'sm';
  const iconName = icon;

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        testID={testID}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityState={{ selected }}
        disabled={!onPress}
        onPress={() => {
          if (hapticKind) haptic(hapticKind);
          onPress?.();
        }}
        style={[
          styles.chip,
          curve,
          selected ? glows[t.glow] : null,
          { paddingVertical: small ? 5 : 8, paddingHorizontal: small ? 11 : 15 },
        ]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, curve]}>
          {selected ? (
            t.gradient ? (
              <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: t.solid }]} />
            )
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.frost]} />
          )}
        </View>
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.rim, curve, { borderColor: selected ? 'rgba(255,255,255,0.32)' : colors.border }]}
        />
        {iconName ? (
          <Icon
            name={iconName}
            size={small ? 12 : 15}
            color={fg}
            weight={selected ? 'bold' : 'duotone'}
            style={styles.lead}
          />
        ) : null}
        <AppText variant={small ? 'caption' : 'smallStrong'} color={fg} numberOfLines={1}>
          {label}
        </AppText>
        {onRemove ? (
          <Pressable
            hitSlop={10}
            onPress={() => {
              if (hapticKind) haptic('light');
              onRemove();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
            style={styles.remove}
          >
            <Icon name="closeCircle" size={small ? 14 : 16} color={fg} weight="fill" />
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  rim: { borderRadius: radii.pill, borderWidth: 1 },
  clip: { borderRadius: radii.pill, overflow: 'hidden' },
  frost: { backgroundColor: glass.fill },
  lead: { marginRight: 5 },
  remove: { marginLeft: 6 },
});

export default Chip;
