import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { colors, enterUp, glass, radii, type IconTone } from '../theme';
import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { IconTile } from './IconTile';
import type { IconName } from './icons';

// Translucent fills over the mesh; `white` uses GlassView's default frost.
const TONE_FILL = {
  white: undefined,
  butter: glass.fillStrong,
  mint: 'rgba(209,250,229,0.62)',
  peach: 'rgba(254,243,199,0.62)',
} as const;

export interface SectionCardProps {
  title?: string;
  icon?: IconName;
  /** Header tile tone (default emerald). */
  iconTone?: IconTone;
  subtitle?: string;
  right?: React.ReactNode;
  tone?: keyof typeof TONE_FILL;
  children?: React.ReactNode;
  animateIndex?: number;
  style?: StyleProp<ViewStyle>;
}

/** Frosted glass card with an icon-tile title, used for grouped details. */
export function SectionCard({
  title,
  icon,
  iconTone = 'emerald',
  subtitle,
  right,
  tone = 'white',
  children,
  animateIndex,
  style,
}: SectionCardProps) {
  const reduced = useReducedMotion();
  const iconName = icon;

  // Frost (never blur): the card fades in, and BlurView glitches under an animating opacity.
  return (
    <Animated.View
      entering={animateIndex !== undefined && !reduced ? enterUp(animateIndex) : undefined}
      style={style}
    >
      <GlassView mode="frost" radius={radii.lg} shadow="glass" fill={TONE_FILL[tone]} style={styles.card}>
        {title ? (
          <View style={styles.header}>
            {iconName ? <IconTile icon={iconName} tone={iconTone} size="sm" style={styles.tile} /> : null}
            <View style={styles.titles}>
              <AppText variant="h3">{title}</AppText>
              {subtitle ? (
                <AppText variant="caption" color={colors.textMuted}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tile: { marginRight: 10 },
  titles: { flex: 1 },
});

export default SectionCard;
