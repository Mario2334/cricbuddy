import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, enter, fonts, glass, glows, gradients, palette, radii, shadows, springs, statusColors } from '../theme';
import { haptic } from '../utils/haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { PulseDot } from './PulseDot';

export interface Segment {
  key: string;
  label: string;
  icon?: IconName;
  badge?: number | 'dot';
  accessibilityLabel?: string;
}

export interface SegmentedTabsProps {
  segments: Segment[];
  index: number;
  onChange: (index: number) => void;
  size?: 'sm' | 'md';
  tone?: 'primary' | 'sunny';
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Glass segmented control. The gradient indicator's leading edge leads and the
 * trailing edge follows, so it stretches toward the target and settles.
 */
export function SegmentedTabs({ segments, index, onChange, size = 'md', tone = 'primary', scrollable, style }: SegmentedTabsProps) {
  const [layouts, setLayouts] = useState<Record<number, { x: number; w: number }>>({});
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    const l = layouts[index];
    if (!l) return;
    const targetL = l.x;
    const targetR = l.x + l.w;
    if (!placed.current) {
      placed.current = true;
      left.value = targetL;
      right.value = targetR;
      return;
    }
    const movingRight = targetL > left.value;
    left.value = withSpring(targetL, movingRight ? springs.gentle : springs.snappy);
    right.value = withSpring(targetR, movingRight ? springs.snappy : springs.gentle);
  }, [index, layouts, left, right]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: left.value,
    width: Math.max(0, right.value - left.value),
  }));

  const small = size === 'sm';
  const primary = tone === 'primary';
  const crowded = !scrollable && segments.length >= 4;
  const selectedText = primary ? palette.white : colors.text;

  const items = segments.map((seg, i) => {
    const selected = i === index;
    const icon = seg.icon;
    const hasBadge = seg.badge === 'dot' || (typeof seg.badge === 'number' && seg.badge > 0);
    // Inter is wide: in a crowded fixed-width control only the selected segment keeps
    // its icon, and a badge always wins over an icon.
    const showIcon = !!icon && (scrollable || (!hasBadge && (!crowded || selected)));
    return (
      <Pressable
        key={seg.key}
        onLayout={e => {
          const { x, width } = e.nativeEvent.layout;
          setLayouts(prev => (prev[i]?.x === x && prev[i]?.w === width ? prev : { ...prev, [i]: { x, w: width } }));
        }}
        onPress={() => {
          if (i !== index) {
            haptic('selection');
            onChange(i);
          }
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={seg.accessibilityLabel || seg.label}
        style={[
          styles.item,
          !scrollable && styles.itemFlex,
          { height: small ? 34 : 42, paddingHorizontal: small || crowded ? 8 : 12 },
        ]}
      >
        {showIcon ? (
          <Icon
            name={icon!}
            size={small ? 15 : 17}
            weight={selected ? 'fill' : 'duotone'}
            color={selected ? selectedText : colors.textMuted}
            style={styles.icon}
          />
        ) : null}
        <AppText
          style={[styles.label, { fontSize: small || crowded ? 13 : 14, lineHeight: small || crowded ? 17 : 19 }]}
          color={selected ? selectedText : colors.textSoft}
          numberOfLines={1}
        >
          {seg.label}
        </AppText>
        {seg.badge === 'dot' ? (
          <View style={styles.dotBadge}>
            <PulseDot color={statusColors.live.dot} size={7} />
          </View>
        ) : typeof seg.badge === 'number' && seg.badge > 0 ? (
          <Animated.View
            key={`badge-${seg.badge}`}
            entering={enter.pop()}
            style={[styles.badge, { backgroundColor: selected ? 'rgba(255,255,255,0.25)' : palette.green100 }]}
          >
            <AppText style={styles.badgeText} color={selected ? selectedText : palette.green700}>
              {seg.badge > 99 ? '99+' : seg.badge}
            </AppText>
          </Animated.View>
        ) : null}
      </Pressable>
    );
  });

  const indicator = (
    <Animated.View pointerEvents="none" style={[styles.indicator, primary ? glows.emerald : shadows.soft, indicatorStyle]}>
      <View style={[StyleSheet.absoluteFill, styles.indicatorClip]}>
        {primary ? (
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.white }]} />
        )}
        <LinearGradient colors={gradients.glassSheen} style={styles.indicatorGloss} />
      </View>
    </Animated.View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={[styles.track, styles.trackScroll]}>
        <View style={styles.inner}>
          {indicator}
          {items}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      <View style={styles.inner}>
        {indicator}
        {items}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: glass.fill,
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: glass.rim,
    ...shadows.soft,
  },
  trackScroll: { alignSelf: 'flex-start' },
  inner: { flexDirection: 'row', position: 'relative' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Grow from content width so long labels with badges ("Upcoming 60") get the room they need.
  itemFlex: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  icon: { marginRight: 6 },
  label: { fontFamily: fonts.bodyExtraBold, letterSpacing: -0.1, flexShrink: 1 },
  indicator: { position: 'absolute', top: 0, bottom: 0, borderRadius: radii.pill },
  indicatorClip: { borderRadius: radii.pill, overflow: 'hidden' },
  indicatorGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  badge: {
    marginLeft: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bodyBlack, fontSize: 11, lineHeight: 14 },
  dotBadge: { marginLeft: 6 },
});

export default SegmentedTabs;
