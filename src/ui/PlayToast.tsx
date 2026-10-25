import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { colors, curve, enter, glass, shadows, type IconTone } from '../theme';
import { haptic, type HapticKind } from '../utils/haptics';
import { AppText } from './AppText';
import { IconTile } from './IconTile';
import type { IconName } from './icons';

type Kind = 'success' | 'error' | 'info';

const KINDS: Record<Kind, { icon: IconName; tone: IconTone; haptic: HapticKind }> = {
  success: { icon: 'celebrate', tone: 'emerald', haptic: 'success' },
  error: { icon: 'oops', tone: 'rose', haptic: 'error' },
  info: { icon: 'info', tone: 'teal', haptic: 'light' },
};

const RADIUS = 20;

// Frost, never BlurView: the toast container animates opacity, which breaks iOS blur.
function PlayToastView({ kind, text1, text2 }: { kind: Kind; text1?: string; text2?: string }) {
  const k = KINDS[kind];
  useEffect(() => {
    haptic(k.haptic);
  }, [k.haptic]);

  return (
    <View style={[styles.toast, curve]} accessibilityLiveRegion="polite">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, curve]} />
      <Animated.View entering={enter.pop(80)}>
        <IconTile icon={k.icon} tone={k.tone} size="md" />
      </Animated.View>
      <View style={styles.texts}>
        {text1 ? (
          <AppText variant="title" numberOfLines={2}>
            {text1}
          </AppText>
        ) : null}
        {text2 ? (
          <AppText variant="small" color={colors.textSoft} numberOfLines={3}>
            {text2}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const make = (kind: Kind) => ({ text1, text2 }: ToastConfigParams<unknown>) => (
  <PlayToastView kind={kind} text1={text1} text2={text2} />
);

export const toastConfig: ToastConfig = {
  success: make('success'),
  error: make('error'),
  info: make('info'),
};

const styles = StyleSheet.create({
  toast: {
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glass.fillSolid,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    ...shadows.float,
  },
  rim: { borderRadius: RADIUS, borderWidth: 1, borderColor: glass.rim },
  texts: { flex: 1 },
});

export default toastConfig;
