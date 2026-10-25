import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, durations, mesh } from '../theme';

const MeshClockContext = createContext<SharedValue<number> | null>(null);

/** One slow, shared drift clock for every mesh background in the app. */
export function MeshClockProvider({ children }: { children: React.ReactNode }) {
  const clock = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    clock.value = withRepeat(withTiming(1, { duration: durations.drift, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(clock);
  }, [reduced, clock]);
  return <MeshClockContext.Provider value={clock}>{children}</MeshClockContext.Provider>;
}

let gradientSeq = 0;

interface BlobSpec {
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
}

const BLOB_LAYOUT: BlobSpec[] = [
  { x: -0.4, y: -0.12, size: 1.15, dx: 30, dy: 24 },
  { x: 0.42, y: 0.08, size: 1.0, dx: -34, dy: 20 },
  { x: -0.15, y: 0.55, size: 1.25, dx: 24, dy: -30 },
  { x: 0.5, y: 0.72, size: 0.9, dx: -20, dy: -24 },
];

function Blob({
  spec,
  color,
  opacity,
  width,
  height,
  clock,
  animate,
}: {
  spec: BlobSpec;
  color: string;
  opacity: number;
  width: number;
  height: number;
  clock: SharedValue<number>;
  animate: boolean;
}) {
  const id = useRef(`mesh${++gradientSeq}`).current;
  const size = width * spec.size;
  const style = useAnimatedStyle(() => {
    if (!animate) return {};
    const c = clock.value;
    return {
      transform: [{ translateX: (c - 0.5) * 2 * spec.dx }, { translateY: (c - 0.5) * 2 * spec.dy }, { scale: 1 + c * 0.06 }],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: spec.x * width, top: spec.y * height, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export interface MeshBackgroundProps {
  children?: React.ReactNode;
  variant?: 'default' | 'calm' | 'vivid' | 'plain';
  /** Stop drifting (e.g. while the screen is not focused). */
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Soft emerald / teal / lime / sky mesh that drifts very slowly behind glass. */
export function MeshBackground({ children, variant = 'default', paused = false, style }: MeshBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const fallbackClock = useSharedValue(0);
  const clock = useContext(MeshClockContext) ?? fallbackClock;
  const scale = variant === 'calm' ? 0.6 : variant === 'vivid' ? 1.15 : 1;
  const blobs = useMemo(() => mesh.blobs.map(b => ({ ...b, opacity: Math.min(1, b.opacity * scale) })), [scale]);

  return (
    <View style={[styles.root, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={mesh.base} style={StyleSheet.absoluteFill} />
        {variant !== 'plain'
          ? BLOB_LAYOUT.map((spec, i) => (
              <Blob
                key={i}
                spec={spec}
                color={blobs[i].color}
                opacity={blobs[i].opacity}
                width={width}
                height={height}
                clock={clock}
                animate={!paused && !reduced}
              />
            ))
          : null}
        <LinearGradient colors={mesh.sheen} style={styles.sheen} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
});

export default MeshBackground;
