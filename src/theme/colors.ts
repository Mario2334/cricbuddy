// "Vibrant Glass": emerald → teal → lime over a soft mint mesh, frosted
// surfaces and slate inks. Legacy colour-named keys (green700, yellow400,
// cream, butter…) keep their names so existing styles pick up the new look;
// they stay 6-digit hex because `withAlpha()` appends an alpha byte.

export const palette = {
  /** @deprecated use colors.primaryStrong / tones.emerald */
  green700: '#047857',
  /** @deprecated */
  green600: '#059669',
  /** @deprecated */
  green500: '#10B981',
  /** @deprecated */
  green100: '#D1FAE5',
  /** @deprecated */
  green50: '#ECFDF5',

  /** @deprecated lime accent */
  yellow500: '#65A30D',
  /** @deprecated */
  yellow400: '#A3E635',
  /** @deprecated */
  yellow300: '#BEF264',
  /** @deprecated */
  yellow200: '#D9F99D',
  /** @deprecated */
  yellow100: '#ECFCCB',

  coral500: '#F43F5E',
  coral400: '#FB7185',
  coral100: '#FFE4E6',
  rose600: '#E11D48',
  rose700: '#BE123C',

  /** @deprecated mesh base */
  cream: '#F2FAF6',
  creamDeep: '#E3F4EC',
  /** @deprecated glass tint */
  butter: '#F4F8F7',
  /** @deprecated glass border */
  butterLine: '#E2E8F0',
  white: '#FFFFFF',

  ink: '#0F172A',
  inkSoft: '#334155',
  inkMuted: '#475569',
  stone300: '#CBD5E1',
  stone200: '#E2E8F0',
  stone100: '#F1F5F9',

  emerald300: '#6EE7B7',
  emerald400: '#34D399',
  emerald800: '#065F46',
  teal300: '#5EEAD4',
  teal400: '#2DD4BF',
  teal500: '#14B8A6',
  teal600: '#0D9488',
  teal700: '#0F766E',
  lime600: '#65A30D',
  lime700: '#4D7C0F',
  slate400: '#94A3B8',
  slate500: '#64748B',

  sky500: '#0EA5E9',
  sky100: '#E0F2FE',
  sky300: '#7DD3FC',
  sky600: '#0284C7',
  lilac500: '#8B5CF6',
  lilac100: '#EDE9FE',
  peach500: '#F97316',
  peach100: '#FFEDD5',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  whatsapp: '#25D366',
  whatsappDark: '#128C7E',
} as const;

export type MatchStatusKey = 'upcoming' | 'live' | 'past' | 'unknown';

export interface StatusColors {
  fg: string;
  bg: string;
  dot: string;
  border: string;
  label: string;
}

export const statusColors: Record<MatchStatusKey, StatusColors> = {
  live: { fg: '#BE123C', bg: '#FFE4E6', dot: '#F43F5E', border: '#FECDD3', label: 'LIVE' },
  upcoming: { fg: '#047857', bg: '#D1FAE5', dot: '#10B981', border: '#A7F3D0', label: 'Upcoming' },
  past: { fg: '#475569', bg: '#F1F5F9', dot: '#94A3B8', border: '#E2E8F0', label: 'Done' },
  unknown: { fg: '#0369A1', bg: '#E0F2FE', dot: '#0EA5E9', border: '#BAE6FD', label: 'Match' },
};

export const colors = {
  // Solid fallback under the mesh (nav theme, stack cards).
  bg: '#EEF8F3',
  surface: palette.white,
  surfaceAlt: '#F4F8F7',
  border: 'rgba(15,23,42,0.08)',
  borderStrong: 'rgba(15,23,42,0.16)',

  text: palette.ink,
  textSoft: palette.inkSoft,
  textMuted: palette.inkMuted,
  /** Placeholders and disabled text only. */
  textFaint: palette.slate500,
  textOnDark: palette.white,

  primary: '#059669',
  primaryStrong: '#047857',
  primarySoft: '#D1FAE5',
  onPrimary: palette.white,

  accent: '#A3E635',
  accentSoft: '#ECFCCB',
  onAccent: '#1A2E05',

  coral: palette.coral400,
  danger: palette.rose600,
  dangerSoft: palette.coral100,

  overlay: 'rgba(15,23,42,0.40)',
  status: statusColors,

  // Rotating soft backgrounds with matching inks (avatars, row bubbles).
  pastels: ['#D1FAE5', '#CCFBF1', '#E0F2FE', '#EDE9FE', '#FEF3C7', '#FFE4E6'],
  pastelInks: ['#047857', '#0F766E', '#0369A1', '#6D28D9', '#B45309', '#BE123C'],
} as const;

/** Frosted surfaces. `fill` sits straight on the mesh; `fillBlur` goes over a BlurView. */
export const glass = {
  fill: 'rgba(255,255,255,0.62)',
  fillStrong: 'rgba(255,255,255,0.82)',
  fillBlur: 'rgba(255,255,255,0.45)',
  fillSolid: 'rgba(255,255,255,0.96)',
  fillDark: 'rgba(255,255,255,0.16)',
  rim: 'rgba(255,255,255,0.85)',
  rimDark: 'rgba(255,255,255,0.30)',
  hairline: 'rgba(15,23,42,0.06)',
  divider: 'rgba(15,23,42,0.06)',
} as const;

export const mesh = {
  base: ['#E8FAF2', '#F1FCF7', '#F5FDE8'] as const,
  blobs: [
    { color: '#6EE7B7', opacity: 0.55 },
    { color: '#5EEAD4', opacity: 0.45 },
    { color: '#BEF264', opacity: 0.4 },
    { color: '#7DD3FC', opacity: 0.28 },
  ],
  sheen: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'] as const,
};

export type IconTone = 'emerald' | 'teal' | 'sky' | 'violet' | 'amber' | 'rose' | 'lime' | 'slate';

export interface ToneColors {
  from: string;
  to: string;
  glyph: string;
  soft: string;
  softInk: string;
  glow: string;
}

export const tones: Record<IconTone, ToneColors> = {
  emerald: { from: '#34D399', to: '#059669', glyph: '#FFFFFF', soft: '#D1FAE5', softInk: '#047857', glow: 'rgba(5,150,105,0.45)' },
  teal: { from: '#2DD4BF', to: '#0D9488', glyph: '#FFFFFF', soft: '#CCFBF1', softInk: '#0F766E', glow: 'rgba(13,148,136,0.45)' },
  sky: { from: '#38BDF8', to: '#0284C7', glyph: '#FFFFFF', soft: '#E0F2FE', softInk: '#0369A1', glow: 'rgba(2,132,199,0.40)' },
  violet: { from: '#A78BFA', to: '#7C3AED', glyph: '#FFFFFF', soft: '#EDE9FE', softInk: '#6D28D9', glow: 'rgba(124,58,237,0.40)' },
  amber: { from: '#FBBF24', to: '#D97706', glyph: '#FFFFFF', soft: '#FEF3C7', softInk: '#B45309', glow: 'rgba(217,119,6,0.40)' },
  rose: { from: '#FB7185', to: '#E11D48', glyph: '#FFFFFF', soft: '#FFE4E6', softInk: '#BE123C', glow: 'rgba(225,29,72,0.40)' },
  lime: { from: '#D9F99D', to: '#84CC16', glyph: '#1A2E05', soft: '#ECFCCB', softInk: '#4D7C0F', glow: 'rgba(101,163,13,0.40)' },
  slate: { from: '#94A3B8', to: '#475569', glyph: '#FFFFFF', soft: '#F1F5F9', softInk: '#334155', glow: 'rgba(71,85,105,0.30)' },
};

export const toneOrder: IconTone[] = ['emerald', 'teal', 'sky', 'violet', 'amber', 'rose', 'lime'];

export const gradients = {
  /** @deprecated use `accent` */
  sunny: ['#D9F99D', '#A3E635'] as const,
  hero: ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.50)'] as const,
  heroWarm: ['#ECFDF5', '#F0FDFA'] as const,
  /** Deep emerald → teal, for dark heroes with white text. */
  pitch: ['#065F46', '#047857', '#0D9488'] as const,
  live: ['#F43F5E', '#BE123C'] as const,
  mint: ['#D1FAE5', '#ECFDF5'] as const,
  shimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'] as const,
  /** Buttons and selected pills carrying text (white text ≥ 5:1 across the ramp). */
  primary: ['#047857', '#0F766E'] as const,
  /** Indicators, tiles, FAB (no small text on it). */
  primaryVivid: ['#34D399', '#10B981', '#0D9488'] as const,
  accent: ['#BEF264', '#84CC16'] as const,
  brandText: ['#047857', '#0D9488', '#65A30D'] as const,
  whatsapp: ['#25D366', '#128C7E'] as const,
  rose: ['#FB7185', '#E11D48'] as const,
  glassSheen: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'] as const,
};
