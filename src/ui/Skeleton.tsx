import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, curve, durations, glass, gradients, radii, shadows } from '../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  /**
   * `glass` (default) is a frosted white bar for placeholders sitting on the mesh;
   * `ink` is a faint slate bar for placeholders inside white glass cards.
   */
  tone?: 'glass' | 'ink';
  style?: StyleProp<ViewStyle>;
}

/** Frosted placeholder with a sliding white shimmer. */
export function Skeleton({ width = '100%', height, radius = radii.sm, tone = 'glass', style }: SkeletonProps) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduced || !w) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: durations.shimmer, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(x);
  }, [reduced, w, x]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: -w + x.value * w * 2 }] }));

  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      style={[styles.base, tone === 'ink' && styles.ink, curve, { width, height, borderRadius: radius }, style]}
    >
      {w > 0 && !reduced ? (
        <Animated.View style={[StyleSheet.absoluteFill, shimmer]}>
          <LinearGradient
            colors={gradients.shimmer}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function SkeletonCard({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <View style={[styles.card, curve, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, curve]} />
      {children}
    </View>
  );
}

export function MatchCardSkeleton() {
  return (
    <SkeletonCard>
      <View style={styles.row}>
        <Skeleton tone="ink" width={52} height={60} radius={16} />
        <View style={styles.col}>
          <Skeleton tone="ink" width="55%" height={12} />
          <Skeleton tone="ink" width="90%" height={20} style={styles.gap} />
          <Skeleton tone="ink" width="70%" height={20} style={styles.gap} />
          <Skeleton tone="ink" width={150} height={22} radius={radii.pill} style={styles.gap} />
        </View>
      </View>
    </SkeletonCard>
  );
}

export function PostCardSkeleton() {
  return (
    <SkeletonCard>
      <View style={styles.row}>
        <Skeleton tone="ink" width={44} height={44} radius={22} />
        <View style={styles.col}>
          <Skeleton tone="ink" width="45%" height={14} />
          <Skeleton tone="ink" width="30%" height={10} style={styles.gap} />
        </View>
        <Skeleton tone="ink" width={44} height={54} radius={14} />
      </View>
      <Skeleton tone="ink" width="80%" height={22} style={styles.gapLg} />
      <View style={[styles.row, styles.gap]}>
        <Skeleton tone="ink" width={70} height={24} radius={radii.pill} />
        <Skeleton tone="ink" width={70} height={24} radius={radii.pill} />
        <Skeleton tone="ink" width={70} height={24} radius={radii.pill} />
      </View>
    </SkeletonCard>
  );
}

export function StatTileSkeleton() {
  return (
    <SkeletonCard style={styles.tile}>
      <Skeleton tone="ink" width={36} height={36} radius={11} />
      <Skeleton tone="ink" width="60%" height={28} style={styles.gapLg} />
      <Skeleton tone="ink" width="80%" height={12} style={styles.gap} />
    </SkeletonCard>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'rgba(255,255,255,0.55)', overflow: 'hidden' },
  ink: { backgroundColor: colors.border },
  card: {
    backgroundColor: glass.fillStrong,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    padding: 14,
    marginBottom: 14,
    ...shadows.glass,
  },
  rim: { borderRadius: radii.lg, borderWidth: 1, borderColor: glass.rim },
  tile: { flex: 1, marginHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  col: { flex: 1 },
  gap: { marginTop: 8 },
  gapLg: { marginTop: 14 },
});

export default Skeleton;
