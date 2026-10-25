import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, enter, glass, type IconTone } from '../theme';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { GlassView } from './GlassView';
import { Icon } from './Icon';
import { IconTile } from './IconTile';
import type { IconName } from './icons';

/** Scroll offset + handler to drive a collapsing ScreenHeader / CompactHeaderBar. */
export function useCollapsingHeader() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => {
      scrollY.value = e.contentOffset.y;
    },
  });
  return { scrollY, onScroll };
}

export function BackButton({ onPress, tone = 'light' }: { onPress: () => void; tone?: 'light' | 'dark' }) {
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <GlassView mode="frost" radius={20} tone={tone} shadow={tone === 'dark' ? 'none' : 'soft'} style={styles.back}>
        <Icon name="back" size={20} weight="bold" color={tone === 'dark' ? colors.textOnDark : colors.text} />
      </GlassView>
    </Pressable>
  );
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: IconTone;
  right?: React.ReactNode;
  onBack?: () => void;
  /** Skip the top safe-area inset (when already applied by a parent). */
  noInset?: boolean;
  /** When set, the large title fades and shrinks as the content scrolls. */
  scrollY?: SharedValue<number>;
  collapseDistance?: number;
}

/** Large title with a glossy icon tile; collapses on scroll when given `scrollY`. */
export function ScreenHeader({
  title,
  subtitle,
  icon,
  iconTone = 'emerald',
  right,
  onBack,
  noInset,
  scrollY,
  collapseDistance = 56,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const tileIcon = icon;

  const collapseStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, collapseDistance], [1, 0], 'clamp'),
      transform: [
        { translateY: interpolate(y, [0, collapseDistance], [0, -8], 'clamp') },
        { scale: interpolate(y, [-80, 0, collapseDistance], [1.04, 1, 0.94], 'clamp') },
      ],
    };
  });

  return (
    <View style={[styles.wrap, { paddingTop: (noInset ? 0 : insets.top) + 10 }]}>
      <Animated.View style={[styles.row, collapseStyle]}>
        {onBack ? <BackButton onPress={onBack} /> : null}
        <View style={[styles.titles, onBack && styles.titlesWithBack]}>
          <View style={styles.titleRow}>
            {tileIcon ? (
              <Animated.View entering={reduced ? undefined : enter.pop(120)} style={styles.tile}>
                <IconTile icon={tileIcon} tone={iconTone} size="md" />
              </Animated.View>
            ) : null}
            <Animated.View entering={reduced ? undefined : enter.fade()} style={styles.titleText}>
              <AppText variant="h1" accessibilityRole="header" numberOfLines={1}>
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="smallStrong" color={colors.textMuted} numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </Animated.View>
          </View>
        </View>
        {right}
      </Animated.View>
    </View>
  );
}

interface CompactHeaderBarProps {
  title: string;
  scrollY: SharedValue<number>;
  right?: React.ReactNode;
  /** Scroll range over which the bar fades in. */
  threshold?: [number, number];
}

/**
 * Slim frosted bar that fades in over the top once the large title scrolls away.
 * The blur keeps a fixed intensity and only mounts past the threshold: animating
 * BlurView intensity per scroll frame re-created the effect on every frame.
 */
export function CompactHeaderBar({ title, scrollY, right, threshold = [40, 80] }: CompactHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const [a, b] = threshold;
  const [blurOn, setBlurOn] = useState(false);

  useAnimatedReaction(
    () => Platform.OS === 'ios' && scrollY.value > a + (b - a) / 2,
    (on, prev) => {
      if (on !== prev) runOnJS(setBlurOn)(on);
    },
    [a, b],
  );

  const fillStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [a, b], [0, 1], 'clamp') }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [a + 10, b], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [a, b], [6, 0], 'clamp') }],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.compact, { height: insets.top + 48 }]}>
      {blurOn ? <BlurView tint="systemUltraThinMaterialLight" intensity={60} style={StyleSheet.absoluteFill} /> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.compactFill, fillStyle]} />
      <View pointerEvents="box-none" style={[styles.compactRow, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.compactTitle, titleStyle]}>
          <AppText variant="title" numberOfLines={1} center>
            {title}
          </AppText>
        </Animated.View>
        {right ? <View style={styles.compactRight}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.94 }] },
  titles: { flex: 1 },
  titlesWithBack: { marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  tile: { marginRight: 12 },
  titleText: { flex: 1 },
  compact: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  compactFill: {
    backgroundColor: Platform.OS === 'ios' ? glass.fillBlur : glass.fillSolid,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.hairline,
  },
  compactRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  compactTitle: { flex: 1 },
  compactRight: { position: 'absolute', right: 16, bottom: 6 },
});

export default ScreenHeader;
