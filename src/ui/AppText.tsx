import React from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { colors, text, type TextVariant } from '../theme';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

/** All app text goes through here so the custom fonts are always applied. */
export function AppText({
  variant = 'body',
  color = colors.text,
  center,
  style,
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[text[variant], { color, includeFontPadding: false }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}

export default AppText;
