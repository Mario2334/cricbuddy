import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { IconWeight } from 'phosphor-react-native';
import { curve, glass, glows, squircle, tones, type IconTone } from '../theme';
import { Icon } from './Icon';
import type { IconName } from './icons';

const SIZES = {
  xs: { box: 24, glyph: 14 },
  sm: { box: 32, glyph: 18 },
  md: { box: 40, glyph: 22 },
  lg: { box: 52, glyph: 28 },
  xl: { box: 88, glyph: 46 },
} as const;

export type IconTileSize = keyof typeof SIZES;

export interface IconTileProps {
  icon: IconName;
  tone?: IconTone;
  size?: IconTileSize | number;
  /** solid = gradient + gloss + glow; soft = tinted; glass = frosted. */
  variant?: 'solid' | 'soft' | 'glass';
  glow?: boolean;
  weight?: IconWeight;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Glossy squircle holding a duotone icon. */
export function IconTile({
  icon,
  tone = 'emerald',
  size = 'md',
  variant = 'solid',
  glow,
  weight = 'duotone',
  style,
  accessibilityLabel,
}: IconTileProps) {
  const dims = typeof size === 'number' ? { box: size, glyph: Math.round(size * 0.54) } : SIZES[size];
  const radius = squircle(dims.box);
  const t = tones[tone];
  const solid = variant === 'solid';
  const showGlow = glow ?? solid;
  const glyphColor = solid ? t.glyph : t.softInk;

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: dims.box, height: dims.box, borderRadius: radius }, curve, showGlow && glows[tone], style]}
    >
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }, curve]}>
        {solid ? (
          <>
            <LinearGradient colors={[t.from, t.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              style={[styles.gloss, { height: dims.box * 0.55 }]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: variant === 'soft' ? t.soft : glass.fillStrong }]} />
        )}
      </View>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: solid ? 'rgba(255,255,255,0.35)' : variant === 'glass' ? glass.rim : 'rgba(255,255,255,0.6)',
          },
          curve,
        ]}
      />
      <View style={styles.center}>
        <Icon name={icon} size={dims.glyph} color={glyphColor} weight={weight} duotoneOpacity={solid ? 0.38 : 0.3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default IconTile;
