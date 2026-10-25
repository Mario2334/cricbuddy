import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabView, type SceneRendererProps, type NavigationState } from 'react-native-tab-view';
import { colors, space } from '../../../theme';
import { EmptyState } from '../../../ui/EmptyState';
import { TabViewSegmentedBar } from '../../../ui/adapters/TabViewSegmentedBar';
import type { ScorecardData, ScorecardRoute } from '../types';
import { InningsView } from './InningsView';

export interface ScorecardTabProps {
  scorecard: ScorecardData | null;
  routes: ScorecardRoute[];
  index: number;
  onIndexChange: (index: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function ScorecardTab({ scorecard, routes, index, onIndexChange, refreshing, onRefresh }: ScorecardTabProps) {
  const layout = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
  );

  if (!scorecard?.pageProps) {
    return (
      <ScrollView contentContainerStyle={styles.empty} refreshControl={refreshControl}>
        <EmptyState icon="ai" title="No scorecard data available" message="Pull down to try again." />
      </ScrollView>
    );
  }

  const scorecardData = scorecard.pageProps.scorecard || [];

  if (scorecardData.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.empty} refreshControl={refreshControl}>
        <EmptyState
          icon="timer"
          title="Not started yet"
          message="Match scorecard will be available once the match starts"
        />
      </ScrollView>
    );
  }

  // Routes are derived from the scorecard in an effect, so they can lag one render.
  if (routes.length === 0) return null;

  // Scenes read the live innings from the current routes on every render (no SceneMap).
  const renderScene = ({ route }: SceneRendererProps & { route: ScorecardRoute }) => (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={true}
    >
      <InningsView innings={route.innings} title={route.title} />
    </ScrollView>
  );

  const renderTabBar = (props: SceneRendererProps & { navigationState: NavigationState<ScorecardRoute> }) => (
    <TabViewSegmentedBar {...props} scrollable size="sm" />
  );

  return (
    <View style={styles.flex}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={onIndexChange}
        initialLayout={{ width: layout.width }}
        renderTabBar={renderTabBar}
        style={styles.flex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs },
});

export default ScorecardTab;
