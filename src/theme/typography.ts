import type { TextStyle } from 'react-native';

// Family names match the keys registered with useFonts (see fontAssets.ts).
// Never combine these with `fontWeight`: each weight is its own family.
// Display = Space Grotesk (headings, numbers); body = Inter.
export const fonts = {
  displayMedium: 'SpaceGrotesk_500Medium',
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_500Medium',
  bodyBold: 'Inter_600SemiBold',
  bodyExtraBold: 'Inter_700Bold',
  bodyBlack: 'Inter_800ExtraBold',
} as const;

export const text = {
  hero: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  h1: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  number: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  title: { fontFamily: fonts.bodyExtraBold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;
