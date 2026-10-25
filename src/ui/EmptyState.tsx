import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, curve, enter, squircle, tones, type IconTone } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconTile } from './IconTile';
import type { IconName } from './icons';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tile tone (default emerald). `error` = rose tile, rose title and a retry action. */
  tone?: IconTone | 'neutral' | 'error';
  compact?: boolean;
}

const FLOAT = { duration: 1200, easing: Easing.inOut(Easing.sin) };

/** Floating icon tile with a soft glow, a witty line, and an optional action. */
export function EmptyState({ icon, title, message, actionLabel, onAction, tone = 'neutral', compact }: EmptyStateProps) {
  const reduced = useReducedMotion();
  // 0.5 = rest; 0..1 maps to translateY +6..-6.
  const float = useSharedValue(0.5);
  const isError = tone === 'error';
  const tileTone: IconTone = isError ? 'rose' : tone === 'neutral' ? 'emerald' : tone;
  const iconName: IconName = icon ?? (isError ? 'oops' : 'sparkle');
  const box = compact ? 52 : 88;

  useEffect(() => {
    if (reduced) return;
    float.value = withSequence(withTiming(1, { ...FLOAT, duration: 600 }), withRepeat(withTiming(0, FLOAT), -1, true));
    return () => cancelAnimation(float);
  }, [reduced, float]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (0.5 - float.value) * 12 }] }));
  // Glow swells as the tile rises.
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.45 + float.value * 0.55 }));

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Animated.View style={floatStyle}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            curve,
            { borderRadius: squircle(box), boxShadow: `0px 12px 36px 2px ${tones[tileTone].glow}` },
            haloStyle,
          ]}
        />
        <IconTile icon={iconName} tone={tileTone} size={compact ? 'lg' : 'xl'} />
      </Animated.View>
      <Animated.View entering={reduced ? undefined : enter.fade(120)} style={styles.texts}>
        <AppText variant="h3" center color={isError ? colors.danger : colors.text}>
          {title}
        </AppText>
        {message ? (
          <AppText variant="body" center color={colors.textMuted} style={styles.message}>
            {message}
          </AppText>
        ) : null}
      </Animated.View>
      {actionLabel && onAction ? (
        <Animated.View entering={reduced ? undefined : enter.pop(240)} style={styles.action}>
          <Button
            label={actionLabel}
            onPress={onAction}
            variant={isError ? 'coral' : 'primary'}
            size="md"
            icon={isError ? 'refresh' : undefined}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  compact: { paddingVertical: 20 },
  texts: { alignItems: 'center', marginTop: 18 },
  message: { marginTop: 4, maxWidth: 300 },
  action: { marginTop: 18 },
});

export default EmptyState;
