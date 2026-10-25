import { DefaultTheme, type Theme } from '@react-navigation/native';
import { colors, fonts, palette } from '../theme';

export const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.green700,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: 'transparent',
    notification: palette.rose600,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: 'normal' },
    medium: { fontFamily: fonts.bodyBold, fontWeight: 'normal' },
    bold: { fontFamily: fonts.bodyExtraBold, fontWeight: 'normal' },
    heavy: { fontFamily: fonts.bodyBlack, fontWeight: 'normal' },
  },
};
