import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { colors, curve, easings, fonts, glass, palette, shadows } from '../theme';
import { countdownParts } from '../utils/dates';
import { useNow } from '../hooks/useNow';
import { AppText } from './AppText';

interface CountdownTilesProps {
  target: Date;
  enabled?: boolean;
  /** Fired once when the countdown crosses zero while on screen. */
  onZero?: () => void;
}

function Tile({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  const text = String(value).padStart(2, '0');
  return (
    <View style={styles.tileWrap}>
      <View style={[styles.tile, curve]}>
        <Animated.View
          key={text}
          entering={reduced ? undefined : FadeInDown.duration(240).easing(easings.out)}
          exiting={reduced ? undefined : FadeOutUp.duration(160)}
          style={styles.digit}
        >
          <AppText style={styles.digitText} color={colors.text} adjustsFontSizeToFit numberOfLines={1}>
            {text}
          </AppText>
        </Animated.View>
      </View>
      <AppText style={styles.label} color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

/** D/H/M/S glass tiles; only this component re-renders every second. */
export function CountdownTiles({ target, enabled = true, onZero }: CountdownTilesProps) {
  const now = useNow(1000, { enabled, align: true });
  const parts = countdownParts(target, now);
  const wasRunning = useRef(!parts.isPast);

  useEffect(() => {
    if (parts.isPast && wasRunning.current) {
      wasRunning.current = false;
      onZero?.();
    }
  }, [parts.isPast, onZero]);

  const tiles = [
    ...(parts.days > 0 ? [{ v: parts.days, l: parts.days === 1 ? 'DAY' : 'DAYS' }] : []),
    { v: parts.hours, l: 'HRS' },
    { v: parts.minutes, l: 'MIN' },
    { v: parts.seconds, l: 'SEC' },
  ];

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${parts.days} days ${parts.hours} hours ${parts.minutes} minutes to go`}
    >
      {tiles.map((t, i) => (
        <React.Fragment key={t.l}>
          {i > 0 ? (
            <AppText style={styles.colon} color={palette.green500}>
              :
            </AppText>
          ) : null}
          <Tile value={t.v} label={t.l} />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  tileWrap: { alignItems: 'center' },
  tile: {
    width: 52,
    height: 54,
    borderRadius: 16,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.rim,
    overflow: 'hidden',
    ...shadows.soft,
  },
  digit: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  digitText: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  label: { fontFamily: fonts.bodyBlack, fontSize: 9, lineHeight: 12, letterSpacing: 0.5, marginTop: 5 },
  colon: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 52, marginHorizontal: 3 },
});

export default CountdownTiles;
