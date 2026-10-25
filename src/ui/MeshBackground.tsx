import React, { memo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, mesh } from '../theme';

let gradientSeq = 0;

interface BlobSpec {
  x: number;
  y: number;
  size: number;
}

const BLOB_LAYOUT: BlobSpec[] = [
  { x: -0.4, y: -0.12, size: 1.15 },
  { x: 0.42, y: 0.08, size: 1.0 },
  { x: -0.15, y: 0.55, size: 1.25 },
  { x: 0.5, y: 0.72, size: 0.9 },
];

type Variant = 'default' | 'calm' | 'vivid' | 'plain';

/**
 * The four soft blobs, drawn once into a single SVG. Static on purpose: moving
 * content behind a BlurView makes iOS re-blur every frame, so a drifting mesh
 * kept the tab bar, sheets and headers rendering nonstop.
 */
const MeshBlobs = memo(function MeshBlobs({ width, height, variant }: { width: number; height: number; variant: Variant }) {
  const base = useRef(`mesh${++gradientSeq}`).current;
  const scale = variant === 'calm' ? 0.6 : variant === 'vivid' ? 1.15 : 1;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        {BLOB_LAYOUT.map((_, i) => (
          <RadialGradient key={i} id={`${base}-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={mesh.blobs[i].color} stopOpacity={Math.min(1, mesh.blobs[i].opacity * scale)} />
            <Stop offset="1" stopColor={mesh.blobs[i].color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {BLOB_LAYOUT.map((spec, i) => {
        const r = (width * spec.size) / 2;
        return <Circle key={i} cx={spec.x * width + r} cy={spec.y * height + r} r={r} fill={`url(#${base}-${i})`} />;
      })}
    </Svg>
  );
});

export interface MeshBackgroundProps {
  children?: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

/** Soft emerald / teal / lime / sky mesh behind the glass. */
export function MeshBackground({ children, variant = 'default', style }: MeshBackgroundProps) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={[styles.root, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={mesh.base} style={StyleSheet.absoluteFill} />
        {variant !== 'plain' ? <MeshBlobs width={width} height={height} variant={variant} /> : null}
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
