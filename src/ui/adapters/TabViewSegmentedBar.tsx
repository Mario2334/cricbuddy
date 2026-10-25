import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { NavigationState, Route, SceneRendererProps } from 'react-native-tab-view';
import type { IconName } from '../icons';
import { SegmentedTabs } from '../SegmentedTabs';

type Props<T extends Route> = SceneRendererProps & {
  navigationState: NavigationState<T>;
  icons?: Record<string, IconName>;
  scrollable?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** react-native-tab-view tab bar rendered as the playful segmented control. */
export function TabViewSegmentedBar<T extends Route>({ navigationState, jumpTo, icons, scrollable, size, style }: Props<T>) {
  const segments = navigationState.routes.map(route => ({
    key: route.key,
    label: route.title ?? route.key,
    icon: icons?.[route.key],
  }));

  return (
    <View style={[styles.wrap, style]}>
      <SegmentedTabs
        segments={segments}
        index={navigationState.index}
        onChange={i => jumpTo(navigationState.routes[i].key)}
        scrollable={scrollable}
        size={size}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10 },
});

export default TabViewSegmentedBar;
