import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs';
import apiService from '../services/apiService';
import { radii } from '../theme';
import type { IconName } from '../ui/icons';
import { MeshBackground } from '../ui/MeshBackground';
import { ScreenHeader } from '../ui/ScreenHeader';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { MaterialTopSegmentedBar } from '../ui/adapters/MaterialTopSegmentedBar';
import { haptic } from '../utils/haptics';
import { StatsGrid, StatsGridSkeleton } from './stats/StatsGrid';
import type { StatsData } from './stats/statMeta';

const Tab = createMaterialTopTabNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Batting: 'bat',
  Bowling: 'target',
  Fielding: 'gloves',
  Captain: 'crown',
};

const renderTabBar = (props: MaterialTopTabBarProps) => <MaterialTopSegmentedBar {...props} icons={TAB_ICONS} />;
const renderLazyPlaceholder = () => <StatsGridSkeleton />;

const StatsScreen = () => {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  // Start in the loading state so the empty state never flashes before the first fetch.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }

    try {
      const response = await apiService.getPlayerStats();

      if (response.success) {
        setStatsData(response.data.data.statistics);
      } else {
        Alert.alert('Error', 'Failed to load statistics. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(() => {
    haptic('light');
    setRefreshing(true);
    loadStats(true).finally(() => {
      setRefreshing(false);
    });
  }, [loadStats]);

  let body: React.ReactNode;
  if (loading && !statsData) {
    body = (
      <View style={styles.loading}>
        <Skeleton height={52} radius={radii.pill} style={styles.tabsSkeleton} />
        <StatsGridSkeleton />
      </View>
    );
  } else if (!statsData) {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="chart"
          title="No stats yet"
          message="We couldn't find your career numbers just now."
          actionLabel="Try again"
          onAction={() => loadStats()}
        />
      </View>
    );
  } else {
    body = (
      <Tab.Navigator
        tabBar={renderTabBar}
        style={styles.navigator}
        screenOptions={{
          lazy: true,
          lazyPlaceholder: renderLazyPlaceholder,
          sceneStyle: styles.scene,
        }}
      >
        <Tab.Screen name="Batting" options={{ title: 'Batting' }}>
          {() => <StatsGrid stats={statsData.batting} kind="batting" refreshing={refreshing} onRefresh={onRefresh} />}
        </Tab.Screen>
        <Tab.Screen name="Bowling" options={{ title: 'Bowling' }}>
          {() => <StatsGrid stats={statsData.bowling} kind="bowling" refreshing={refreshing} onRefresh={onRefresh} />}
        </Tab.Screen>
        <Tab.Screen name="Fielding" options={{ title: 'Fielding' }}>
          {() => <StatsGrid stats={statsData.fielding} kind="fielding" refreshing={refreshing} onRefresh={onRefresh} />}
        </Tab.Screen>
        <Tab.Screen name="Captain" options={{ title: 'Captain' }}>
          {() => <StatsGrid stats={statsData.captain} kind="captain" refreshing={refreshing} onRefresh={onRefresh} />}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

  return (
    <MeshBackground>
      <ScreenHeader title="My Stats" icon="chart" subtitle="Your CricHeroes career" />
      {body}
    </MeshBackground>
  );
};

const styles = StyleSheet.create({
  navigator: { backgroundColor: 'transparent' },
  // Transparent so the mesh background shows through every tab's scene.
  scene: { backgroundColor: 'transparent' },
  loading: { flex: 1 },
  tabsSkeleton: { marginHorizontal: 16, marginBottom: 16 },
  center: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
});

export default StatsScreen;
