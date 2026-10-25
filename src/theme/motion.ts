import { Easing, FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

// Smooth springs, all near critical damping (ratio ζ = d / (2√(k·m)) ≥ 0.75).
export const springs = {
  /** Firm press-in. ζ≈0.82 */
  press: { damping: 26, stiffness: 420, mass: 0.6 },
  /** Release / arrival with a whisper of overshoot. ζ≈0.79 */
  release: { damping: 22, stiffness: 240, mass: 0.8 },
  /** @deprecated alias of `release` (kept so older call sites smooth out). */
  bouncy: { damping: 22, stiffness: 240, mass: 0.8 },
  /** Indicators that follow a target. ζ≈0.84 */
  snappy: { damping: 26, stiffness: 300, mass: 0.8 },
  /** Big surfaces. ζ≈1.0 */
  gentle: { damping: 24, stiffness: 140, mass: 1 },
  /** Bottom sheets. ζ≈0.90 */
  sheet: { damping: 28, stiffness: 240, mass: 1 },
} as const;

export const easings = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

export const durations = {
  fast: 160,
  base: 240,
  slow: 380,
  emphasis: 520,
  shimmer: 1600,
  drift: 20000,
} as const;

export const STAGGER_MS = 50;
export const MAX_STAGGERED_ITEMS = 8;

// Staggered list entrance, capped so long lists never wait on the tail.
export const enterUp = (index: number) =>
  FadeInDown.delay(Math.min(index, MAX_STAGGERED_ITEMS) * STAGGER_MS)
    .duration(420)
    .easing(easings.out);

export const enter = {
  fade: (delay = 0) => FadeIn.delay(delay).duration(durations.base),
  pop: (delay = 0) => ZoomIn.delay(delay).duration(260).easing(easings.out),
};
