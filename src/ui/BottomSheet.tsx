import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, curve, easings, glass, palette, radii, shadows, springs, type IconTone } from '../theme';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { useReduceTransparency } from './GlassView';
import { Icon } from './Icon';
import { IconTile } from './IconTile';
import type { IconName } from './icons';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  icon?: IconName;
  /** Header tile tone (default emerald). */
  iconTone?: IconTone;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightPct?: number;
  keyboardAware?: boolean;
  dismissOnBackdrop?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const RADIUS = radii.xxl;

/**
 * Modal glass sheet that glides up on a near-critically damped spring. Drag the
 * handle/header down (or flick) to dismiss; the exit finishes before unmount.
 * The sheet only animates translateY, so real blur is safe here on iOS.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  icon,
  iconTone = 'emerald',
  subtitle,
  children,
  footer,
  maxHeightPct = 0.88,
  keyboardAware = false,
  dismissOnBackdrop = true,
  bodyStyle,
  testID,
}: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceTransparency = useReduceTransparency();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const iconName = icon;
  const blur = Platform.OS === 'ios' && !reduceTransparency;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.value = 0;
      progress.value = withSpring(1, springs.sheet);
    } else {
      progress.value = withTiming(0, { duration: 220, easing: easings.standard }, finished => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, progress, dragY]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(e => {
          dragY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15;
        })
        .onEnd(e => {
          if (e.translationY > 110 || e.velocityY > 900) {
            runOnJS(haptic)('light');
            runOnJS(onClose)();
          } else {
            dragY.value = withSpring(0, springs.snappy);
          }
        }),
    [onClose, dragY],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * interpolate(dragY.value, [0, 400], [1, 0.3], 'clamp'),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height * 0.9 + dragY.value }],
  }));

  const handleStyle = useAnimatedStyle(() => ({
    width: 40 + interpolate(Math.abs(dragY.value), [0, 140], [0, 20], 'clamp'),
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissOnBackdrop ? onClose : undefined}
            accessibilityLabel="Close sheet"
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={keyboardAware}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            testID={testID}
            style={[styles.sheet, curve, { maxHeight: height * maxHeightPct, paddingBottom: insets.bottom + 12 }, sheetStyle]}
          >
            {/* Glass body: blur + light fill on iOS, near-solid frost elsewhere. */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, curve]}>
              {blur ? (
                <BlurView intensity={60} tint="systemThinMaterialLight" style={StyleSheet.absoluteFill} />
              ) : null}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? glass.fillBlur : glass.fillSolid }]} />
            </View>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, curve]} />
            <GestureDetector gesture={pan}>
              <View style={styles.grabArea}>
                <Animated.View style={[styles.handle, handleStyle]} />
                {title ? (
                  <View style={styles.header}>
                    {iconName ? <IconTile icon={iconName} tone={iconTone} size="md" style={styles.tile} /> : null}
                    <View style={styles.titles}>
                      <AppText variant="h2" numberOfLines={1}>
                        {title}
                      </AppText>
                      {subtitle ? (
                        <AppText variant="small" color={colors.textMuted} numberOfLines={2}>
                          {subtitle}
                        </AppText>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={onClose}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
                    >
                      <Icon name="close" size={16} color={colors.textSoft} weight="bold" />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            <View style={[styles.body, bodyStyle]}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: colors.overlay },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    boxShadow: '0px -10px 40px -12px rgba(15,23,42,0.22)',
  },
  clip: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
  },
  rim: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: glass.rim,
  },
  grabArea: { paddingTop: 10, paddingHorizontal: 20 },
  handle: {
    alignSelf: 'center',
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.stone300,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  tile: { marginRight: 12 },
  titles: { flex: 1 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.rim,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...shadows.soft,
  },
  closePressed: { transform: [{ scale: 0.92 }] },
  body: { flexShrink: 1, paddingHorizontal: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 12 },
});

export default BottomSheet;
