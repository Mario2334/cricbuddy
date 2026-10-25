import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { colors, curve, enter, fonts, glass, glows, gradients, palette, radii, space } from '../../../theme';
import { AnimatedNumber } from '../../../ui/AnimatedNumber';
import { AppText } from '../../../ui/AppText';
import { Icon } from '../../../ui/Icon';
import type { IconName } from '../../../ui/icons';

export interface ScoreBannerProps {
  runs: number | string;
  wickets: number | string;
  overs?: string | number | null;
  runRate?: string | number | null;
  extras?: number;
}

/** Dark-glass pill for stats sitting on the pitch gradient. */
function DarkChip({ icon, label, iconColor }: { icon: IconName; label: string; iconColor: string }) {
  return (
    <View style={[styles.chip, curve]}>
      <Icon name={icon} size={13} weight="fill" color={iconColor} />
      <AppText variant="caption" color={colors.textOnDark} numberOfLines={1} style={styles.chipText}>
        {label}
      </AppText>
    </View>
  );
}

/** Big display score on the pitch gradient with RR / Extras chips. Runs count up on mount, then roll on with live updates. */
export const ScoreBanner = memo(function ScoreBanner({ runs, wickets, overs, runRate, extras = 0 }: ScoreBannerProps) {
  const reduced = useReducedMotion();

  return (
    <Animated.View entering={reduced ? undefined : enter.pop()} style={[styles.shadow, curve]}>
      <View style={[styles.clip, curve]}>
        <LinearGradient colors={gradients.pitch} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
          <LinearGradient pointerEvents="none" colors={gradients.glassSheen} style={styles.sheen} />
          <View style={styles.scoreRow}>
            <AnimatedNumber value={runs} variant="hero" color={colors.textOnDark} style={styles.big} />
            <AppText style={styles.big} color={palette.yellow300}>
              /{wickets || 0}
            </AppText>
            {overs ? (
              <AppText variant="title" color={palette.emerald300} style={styles.overs}>
                ({overs} ov)
              </AppText>
            ) : null}
          </View>
          {runRate || extras > 0 ? (
            <View style={styles.chips}>
              {runRate ? <DarkChip icon="runRate" label={`RR ${runRate}`} iconColor={palette.yellow300} /> : null}
              {extras > 0 ? <DarkChip icon="addCircle" label={`Extras ${extras}`} iconColor={palette.emerald300} /> : null}
            </View>
          ) : null}
        </LinearGradient>
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, curve]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.lg,
    backgroundColor: palette.emerald800,
    ...glows.emerald,
  },
  clip: { borderRadius: radii.lg, overflow: 'hidden' },
  banner: {
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%', opacity: 0.35 },
  rim: { borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  big: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  overs: { marginLeft: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: glass.fillDark,
    borderWidth: 1,
    borderColor: glass.rimDark,
  },
  chipText: { marginLeft: 5 },
});

export default ScoreBanner;
