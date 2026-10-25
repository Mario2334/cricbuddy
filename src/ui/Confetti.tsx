import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { palette, tones } from '../theme';
import { haptic } from '../utils/haptics';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface FireOptions {
  origin?: { x: number; y: number };
  count?: number;
  colors?: string[];
}

interface Burst {
  id: number;
  origin: { x: number; y: number };
  count: number;
  colors: string[];
}

interface ConfettiApi {
  fire: (opts?: FireOptions) => void;
}

const ConfettiContext = createContext<ConfettiApi>({ fire: () => haptic('success') });

// Emerald, teal, lime, amber, rose, sky.
const DEFAULT_COLORS = [palette.green500, palette.teal400, palette.yellow400, palette.amber400, palette.coral400, palette.sky500];
/** A few glyph pieces ride along with the paper. */
const GLYPHS: { name: IconName; color: string }[] = [
  { name: 'bat', color: tones.emerald.to },
  { name: 'sparkle', color: tones.amber.from },
  { name: 'highlight', color: tones.teal.from },
];
const DURATION_MS = 1700;
const GRAVITY = 1500; // px/s^2

interface PieceSpec {
  vx: number;
  vy: number;
  spin: number;
  color: string;
  size: number;
  shape: 0 | 1 | 2;
  glyph: { name: IconName; color: string } | null;
}

function Piece({ spec, progress }: { spec: PieceSpec; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const t = p * (DURATION_MS / 1000);
    return {
      opacity: p < 0.72 ? 1 : Math.max(0, (1 - p) / 0.28),
      transform: [
        { translateX: spec.vx * t * (1 - 0.3 * t) },
        { translateY: spec.vy * t + 0.5 * GRAVITY * t * t },
        { rotate: `${spec.spin * p}deg` },
        { scaleX: spec.glyph ? 1 : Math.cos(p * 12 + spec.spin) },
      ],
    };
  });

  if (spec.glyph) {
    return (
      <Animated.View style={[styles.piece, style]}>
        <Icon name={spec.glyph.name} size={22} color={spec.glyph.color} weight="fill" />
      </Animated.View>
    );
  }
  const dims =
    spec.shape === 0
      ? { width: spec.size, height: spec.size * 0.6, borderRadius: 2 }
      : spec.shape === 1
        ? { width: spec.size * 0.8, height: spec.size * 0.8, borderRadius: spec.size }
        : { width: spec.size * 0.4, height: spec.size * 1.4, borderRadius: 2 };
  return <Animated.View style={[styles.piece, dims, { backgroundColor: spec.color }, style]} />;
}

function BurstView({ burst }: { burst: Burst }) {
  const progress = useSharedValue(0);
  const pieces = useMemo<PieceSpec[]>(
    () =>
      Array.from({ length: burst.count }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
        const speed = 520 + Math.random() * 520;
        return {
          vx: Math.cos(angle) * speed * 0.8,
          vy: Math.sin(angle) * speed,
          spin: (Math.random() - 0.5) * 1080,
          color: burst.colors[i % burst.colors.length],
          size: 8 + Math.random() * 7,
          shape: (i % 3) as 0 | 1 | 2,
          glyph: i < GLYPHS.length ? GLYPHS[i] : null,
        };
      }),
    [burst],
  );

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.linear });
  }, [progress]);

  return (
    <View style={[styles.origin, { left: burst.origin.x, top: burst.origin.y }]}>
      {pieces.map((spec, i) => (
        <Piece key={i} spec={spec} progress={progress} />
      ))}
    </View>
  );
}

/** App-wide confetti overlay; call `useConfetti().fire()` to celebrate. */
export function ConfettiProvider({ children }: { children: React.ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const seq = useRef(0);

  const fire = useCallback(
    (opts: FireOptions = {}) => {
      haptic('success');
      if (reduced) return;
      const id = ++seq.current;
      setBursts(prev => [
        ...prev.slice(-1),
        {
          id,
          origin: opts.origin ?? { x: width / 2, y: height * 0.42 },
          count: opts.count ?? 38,
          colors: opts.colors ?? DEFAULT_COLORS,
        },
      ]);
      setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), DURATION_MS + 150);
    },
    [width, height, reduced],
  );

  const api = useMemo(() => ({ fire }), [fire]);

  return (
    <ConfettiContext.Provider value={api}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {bursts.map(b => (
          <BurstView key={b.id} burst={b} />
        ))}
      </View>
    </ConfettiContext.Provider>
  );
}

export function useConfetti(): ConfettiApi {
  return useContext(ConfettiContext);
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0 },
  piece: { position: 'absolute' },
});

export default ConfettiProvider;
