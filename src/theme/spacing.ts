export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

/** Squircle-ish corner for a square tile of `size`. */
export const squircle = (size: number): number => Math.round(size * 0.3);

/** Continuous (Apple squircle) corners on iOS; Android ignores it. */
export const curve = { borderCurve: 'continuous' } as const;
