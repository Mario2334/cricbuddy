import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, easings, fonts, glass, glows, gradients, palette, shadows, springs } from '../theme';
import { haptic } from '../utils/haptics';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { useReduceTransparency } from '../ui/GlassView';
import { TAB_BAR_HEIGHT, tabBarBottom } from './useTabBarSpace';

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home',
  LookingForFeed: 'find',
  Stats: 'stats',
  MyTeam: 'team',
  Calendar: 'calendar',
};

const PAD = 6;

interface TabItemProps {
  label: string;
  routeName: string;
  focused: boolean;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ label, routeName, focused, width, onPress, onLongPress }: TabItemProps) {
  const reduced = useReducedMotion();
  const active = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    active.value = withTiming(focused ? 1 : 0, { duration: 220, easing: easings.standard });
    if (focused && !reduced) {
      pop.value = withSequence(withTiming(0.9, { duration: 90 }), withSpring(1, springs.release));
    }
  }, [focused, reduced, active, pop]);

  // Outline and filled glyphs are stacked and cross-faded.
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: active.value }));
  const iconWrap = useAnimatedStyle(() => ({
    transform: [{ translateY: -active.value * 7 }, { scale: pop.value * (1 + active.value * 0.04) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ translateY: (1 - active.value) * 6 }],
  }));

  const icon = TAB_ICONS[routeName] ?? 'dot';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={[styles.item, { width }]}
    >
      <Animated.View style={[styles.iconBox, iconWrap]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, outlineStyle]}>
          <Icon name={icon} size={24} weight="regular" color={palette.slate500} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, filledStyle]}>
          <Icon name={icon} size={24} weight="fill" color={palette.white} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.labelWrap, labelStyle]}>
        <AppText style={styles.label} color={palette.white} numberOfLines={1}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Floating frosted tab bar: a glowing gradient pill glides between tabs, icons
 * cross-fade from outline to filled, and the bar slides away on detail screens.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduceTransparency = useReduceTransparency();
  const [width, setWidth] = useState(0);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const tabW = width > 0 ? (width - PAD * 2) / state.routes.length : 0;

  const indicatorX = useSharedValue(0);
  const hide = useSharedValue(0);
  const placed = React.useRef(false);

  useEffect(() => {
    if (!tabW) return;
    if (!placed.current) {
      placed.current = true;
      indicatorX.value = state.index * tabW;
    } else {
      indicatorX.value = withSpring(state.index * tabW, springs.snappy);
    }
  }, [state.index, tabW, indicatorX]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hideSub.remove();
    };
  }, []);

  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  // RootTabs only ever sets a plain `{ display: 'none' }` here.
  const tabBarStyle = StyleSheet.flatten(focusedOptions?.tabBarStyle as StyleProp<ViewStyle>);
  const hidden = tabBarStyle?.display === 'none' || keyboardUp;

  useEffect(() => {
    hide.value = withTiming(hidden ? 1 : 0, { duration: 260, easing: easings.standard });
  }, [hidden, hide]);

  const bottom = tabBarBottom(insets.bottom);
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hide.value * (TAB_BAR_HEIGHT + bottom + 30) }],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }] }));

  const blur = Platform.OS === 'ios' && !reduceTransparency;

  return (
    <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.wrap, { bottom }, barStyle]}>
      <View style={[styles.shadow]}>
        <View style={styles.bar} onLayout={e => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
          {blur ? <BlurView intensity={50} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} /> : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? glass.fillBlur : glass.fillSolid }]} />
          {tabW > 0 ? (
            <Animated.View style={[styles.indicator, { width: tabW }, indicatorStyle]}>
              <View style={[styles.indicatorPill, glows.emerald]}>
                <View style={[StyleSheet.absoluteFill, styles.indicatorClip]}>
                  <LinearGradient
                    colors={gradients.primaryVivid}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient colors={gradients.glassSheen} style={styles.gloss} />
                </View>
              </View>
            </Animated.View>
          ) : null}
          {state.routes.map((route, index) => {
            const options = descriptors[route.key]?.options;
            const label = typeof options?.title === 'string' ? options.title : route.name;
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                label={label}
                routeName={route.name}
                focused={focused}
                width={tabW}
                onPress={() => {
                  haptic('selection');
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              />
            );
          })}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim]} />
        </View>
      </View>
    </Animated.View>
  );
}

const RADIUS = TAB_BAR_HEIGHT / 2;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  shadow: { borderRadius: RADIUS, ...shadows.float },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.hairline,
  },
  rim: { borderRadius: RADIUS, borderWidth: 1, borderColor: glass.rim },
  indicator: { position: 'absolute', left: PAD, top: 0, bottom: 0 },
  indicatorPill: { position: 'absolute', left: 4, right: 4, top: 7, bottom: 7, borderRadius: 24 },
  indicatorClip: { borderRadius: 24, overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  item: { height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 26, height: 26 },
  center: { alignItems: 'center', justifyContent: 'center' },
  labelWrap: { position: 'absolute', bottom: 10 },
  label: { fontFamily: fonts.bodyExtraBold, fontSize: 10, lineHeight: 13, letterSpacing: 0.2, color: colors.onPrimary },
});

export default FloatingTabBar;
