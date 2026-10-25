import React from 'react';
import { Pressable, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
  shadows,
  springs,
  statusColors,
  type IconTone,
} from '../theme';
import { haptic, type HapticKind } from '../utils/haptics';
import { AppText } from './AppText';
import { SpinningBall } from './CricketBall';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'sunny' | 'coral' | 'ghost' | 'whatsapp' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticKind | false;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

type Gradient = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface VariantSpec {
  text: string;
  gradient?: Gradient;
  /** Solid / translucent face when there is no gradient. */
  fill?: string;
  border?: string;
  glow?: IconTone;
  /** Frosted surface: rim + hairline + soft shadow. */
  frost?: boolean;
}

/** Rose-50: the lightest rose step, only used for the danger button face. */
const DANGER_FACE = '#FFF1F2';

const VARIANTS: Record<ButtonVariant, VariantSpec> = {
  primary: { gradient: gradients.primary, text: colors.onPrimary, glow: 'emerald' },
  secondary: { fill: glass.fillStrong, text: colors.text, frost: true },
  sunny: { gradient: gradients.accent, text: colors.onAccent, glow: 'lime' },
  coral: { gradient: gradients.rose, text: palette.white, glow: 'rose' },
  danger: { fill: DANGER_FACE, text: palette.rose600, border: statusColors.live.border },
  ghost: { fill: 'transparent', text: colors.primaryStrong },
  whatsapp: { gradient: gradients.whatsapp, text: palette.white, glow: 'teal' },
};

const SIZES: Record<ButtonSize, { height: number; padX: number; font: 'smallStrong' | 'title'; icon: number }> = {
  sm: { height: 36, padX: 14, font: 'smallStrong', icon: 16 },
  md: { height: 48, padX: 18, font: 'title', icon: 18 },
  lg: { height: 56, padX: 22, font: 'title', icon: 20 },
};

const GLOSS = ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)'] as const;

/** Glossy gradient pill with a coloured glow; dips slightly and dims its glow on press. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic: hapticKind = 'light',
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(1);
  const inactive = disabled || loading;
  const iconName = icon;
  const onGradient = !!v.gradient;

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => {
        if (!reduced) scale.value = withTiming(0.97, { duration: 90, easing: easings.out });
        glow.value = withTiming(0.4, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = reduced ? 1 : withSpring(1, springs.release);
        glow.value = withTiming(1, { duration: 220, easing: easings.out });
      }}
      onPress={() => {
        if (hapticKind) haptic(hapticKind);
        onPress();
      }}
      style={[fullWidth && styles.fullWidth, { opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View style={[styles.wrap, curve, v.frost && shadows.soft, pressStyle]}>
        {v.glow && !disabled ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.pill, curve, glows[v.glow], glowStyle]}
          />
        ) : null}
        <View
          style={[
            styles.face,
            curve,
            { height: s.height, paddingHorizontal: s.padX },
            v.fill ? { backgroundColor: v.fill } : null,
            v.border ? { borderWidth: 1, borderColor: v.border } : null,
            v.frost ? styles.hairline : null,
          ]}
        >
          {v.gradient ? (
            <>
              <LinearGradient
                colors={v.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient colors={GLOSS} style={[styles.gloss, { height: s.height / 2 }]} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pill, styles.gradientRim, curve]} />
            </>
          ) : null}
          {v.frost ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pill, styles.rim, curve]} /> : null}
          {loading ? (
            <SpinningBall size={s.icon + 4} />
          ) : (
            <>
              {iconName ? (
                <Icon
                  name={iconName}
                  size={s.icon}
                  color={v.text}
                  weight={onGradient ? 'bold' : 'duotone'}
                  style={styles.icon}
                />
              ) : null}
              <AppText variant={s.font} color={v.text} numberOfLines={1}>
                {label}
              </AppText>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  wrap: { borderRadius: radii.pill },
  pill: { borderRadius: radii.pill },
  face: {
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0 },
  gradientRim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  rim: { borderWidth: 1, borderColor: glass.rim },
  hairline: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  icon: { marginRight: 8 },
});

export default Button;
