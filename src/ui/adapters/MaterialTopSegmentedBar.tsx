import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import type { IconName } from '../icons';
import { SegmentedTabs } from '../SegmentedTabs';

type Props = MaterialTopTabBarProps & {
  icons?: Record<string, IconName>;
};

/** Material top tabs rendered as the playful segmented control. */
export function MaterialTopSegmentedBar({ state, descriptors, navigation, icons }: Props) {
  const segments = state.routes.map(route => {
    const title = descriptors[route.key]?.options.title;
    return { key: route.key, label: typeof title === 'string' ? title : route.name, icon: icons?.[route.name] };
  });

  return (
    <View style={styles.wrap}>
      <SegmentedTabs
        segments={segments}
        index={state.index}
        onChange={i => {
          const route = state.routes[i];
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (state.index !== i && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10 },
});

export default MaterialTopSegmentedBar;
