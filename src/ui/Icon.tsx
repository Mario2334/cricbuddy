import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconWeight } from 'phosphor-react-native';
import { colors } from '../theme';
import { icons, type IconName } from './icons';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
  duotoneColor?: string;
  duotoneOpacity?: number;
  mirrored?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** Phosphor icon by semantic name. Duotone by default; decorative unless labelled. */
export function Icon({
  name,
  size = 20,
  color = colors.text,
  weight = 'duotone',
  duotoneColor,
  duotoneOpacity = 0.28,
  mirrored,
  style,
  accessibilityLabel,
  testID,
}: IconProps) {
  const Glyph = icons[name];
  // Never pass `title`: Phosphor renders a <title> element, which crashes on native.
  return (
    <Glyph
      size={size}
      color={color}
      weight={weight}
      duotoneColor={duotoneColor ?? color}
      duotoneOpacity={duotoneOpacity}
      mirrored={mirrored}
      style={style}
      testID={testID}
      {...(accessibilityLabel
        ? { accessible: true, accessibilityLabel, accessibilityRole: 'image' as const }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}
    />
  );
}

export default Icon;
