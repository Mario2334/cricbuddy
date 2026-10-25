import React, { useMemo } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { gradients, type TextVariant } from '../theme';
import { AppText } from './AppText';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Colour at position t (0..1) along a multi-stop hex gradient. */
export function gradientAt(stops: readonly string[], t: number): string {
  if (stops.length === 1) return stops[0];
  const clamped = Math.min(1, Math.max(0, t));
  const seg = Math.min(stops.length - 2, Math.floor(clamped * (stops.length - 1)));
  const local = clamped * (stops.length - 1) - seg;
  const a = hexToRgb(stops[seg]);
  const b = hexToRgb(stops[seg + 1]);
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * local));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

interface GradientTextProps {
  children: string;
  variant?: TextVariant;
  /** 6-digit hex stops. */
  colors?: readonly string[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
}

/**
 * Gradient-coloured text that keeps the real font: each glyph is tinted along
 * the gradient (no SVG text, so iOS font aliasing can't fall back to system).
 */
export function GradientText({
  children,
  variant = 'hero',
  colors = gradients.brandText,
  style,
  numberOfLines = 1,
  accessibilityRole,
}: GradientTextProps) {
  const chars = useMemo(() => Array.from(children), [children]);
  const visible = chars.filter(c => c.trim()).length;
  let k = -1;
  return (
    <AppText
      variant={variant}
      style={style}
      numberOfLines={numberOfLines}
      accessibilityLabel={children}
      accessibilityRole={accessibilityRole}
      color={colors[0]}
    >
      {chars.map((c, i) => {
        if (c.trim()) k += 1;
        return (
          <AppText key={i} variant={variant} style={style} color={gradientAt(colors, visible > 1 ? k / (visible - 1) : 0)}>
            {c}
          </AppText>
        );
      })}
    </AppText>
  );
}

export default GradientText;
