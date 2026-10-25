import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';
import { haptic } from '../utils/haptics';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import type { IconName } from './icons';

const SIZES = {
  sm: { box: 28, icon: 14, hitSlop: 12 },
  md: { box: 40, icon: 20, hitSlop: 10 },
} as const;

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Accessibility label: the button has no visible text. */
  label: string;
  color?: string;
  size?: keyof typeof SIZES;
  /** `dark` for glass sitting on dark gradients. */
  tone?: 'light' | 'dark';
  /** Press haptic; turn off when the action's own toast plays one. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Frosted glass circle holding a single icon. Small ones skip the shadow (they sit in list rows). */
export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 'md',
  tone = 'light',
  haptic: withHaptic = true,
  style,
}: IconButtonProps) {
  const s = SIZES[size];
  return (
    <Pressable
      onPress={() => {
        if (withHaptic) haptic('light');
        onPress();
      }}
      hitSlop={s.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      <GlassView
        mode="frost"
        radius={s.box / 2}
        tone={tone}
        shadow={tone === 'dark' || size === 'sm' ? 'none' : 'soft'}
        style={[styles.box, { width: s.box, height: s.box }]}
      >
        <Icon name={icon} size={s.icon} weight="bold" color={color ?? (tone === 'dark' ? colors.textOnDark : colors.text)} />
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.92 }] },
});

export default IconButton;
