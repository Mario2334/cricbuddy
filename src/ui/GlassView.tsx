import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { curve, glass, radii, shadows } from '../theme';

export type GlassMode = 'auto' | 'blur' | 'frost' | 'solid';

const GlassModeContext = createContext<GlassMode | null>(null);

/** Force a glass mode for a subtree (e.g. `frost` inside lists, where blur is costly). */
export function GlassModeProvider({ value, children }: { value: GlassMode; children: React.ReactNode }) {
  return <GlassModeContext.Provider value={value}>{children}</GlassModeContext.Provider>;
}

/** iOS "Reduce Transparency" accessibility setting. */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then(v => mounted && setReduce(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', v => setReduce(!!v));
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

export interface GlassViewProps extends ViewProps {
  mode?: GlassMode;
  intensity?: number;
  tint?: BlurTint;
  /** Override the translucent fill. */
  fill?: string;
  radius?: number;
  rim?: boolean;
  shadow?: 'none' | 'soft' | 'card' | 'glass' | 'float';
  /** `dark` for glass sitting on dark gradients. */
  tone?: 'light' | 'dark';
}

/**
 * Frosted surface: real blur on iOS where safe, translucent "frost" elsewhere
 * (Android, list rows, Reduce Transparency → solid). A 1px rim catches light.
 * Never animate the opacity of a GlassView's parent while it blurs.
 */
export function GlassView({
  mode = 'auto',
  intensity = 40,
  tint = 'systemUltraThinMaterialLight',
  fill,
  radius = radii.lg,
  rim = true,
  shadow = 'glass',
  tone = 'light',
  style,
  children,
  ...rest
}: GlassViewProps) {
  const reduce = useReduceTransparency();
  const forced = useContext(GlassModeContext);
  const requested = forced ?? mode;
  const resolved: Exclude<GlassMode, 'auto'> = reduce
    ? 'solid'
    : Platform.OS !== 'ios' && requested !== 'solid'
      ? 'frost'
      : requested === 'auto'
        ? 'blur'
        : requested;

  const dark = tone === 'dark';
  const background =
    fill ??
    (resolved === 'solid'
      ? dark
        ? 'rgba(6,78,59,0.92)'
        : glass.fillSolid
      : dark
        ? glass.fillDark
        : resolved === 'blur'
          ? glass.fillBlur
          : glass.fillStrong);

  return (
    <View style={[{ borderRadius: radius }, curve, shadows[shadow], styles.hairline, dark && styles.hairlineDark, style]} {...rest}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }, curve]}>
        {resolved === 'blur' ? (
          <BlurView intensity={intensity} tint={dark ? 'systemUltraThinMaterialDark' : tint} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]} />
      </View>
      {rim ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, borderWidth: 1, borderColor: dark ? glass.rimDark : glass.rim },
            curve,
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  hairline: { borderWidth: StyleSheet.hairlineWidth, borderColor: glass.hairline },
  hairlineDark: { borderColor: 'rgba(255,255,255,0.12)' },
});

export default GlassView;
