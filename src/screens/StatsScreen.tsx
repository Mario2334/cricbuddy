import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import apiService from '../services/apiService';

interface StatItem {
  value: string | number;
  title: string;
}
interface StatsData {
  batting?: StatItem[];
  bowling?: StatItem[];
  fielding?: StatItem[];
  captain?: StatItem[];
}


const { width } = Dimensions.get('window');
const Tab = createMaterialTopTabNavigator();

const StatsScreen = () => {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async (isRefresh = false) => {
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
  };


  const onRefresh = () => {
    setRefreshing(true);
    loadStats(true).finally(() => {
      setRefreshing(false);
    });
  };

  const renderStatCard = (stat: StatItem, index: number) => (
    <View key={index} style={styles.statCard}>
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statTitle}>{stat.title}</Text>
    </View>
  );

  const renderStatsGrid = (stats: StatItem[]) => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => renderStatCard(stat, index))}
      </View>
    </ScrollView>
  );

  // Individual tab components
  const BattingTab = () => (
    statsData?.batting ? renderStatsGrid(statsData.batting) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No batting stats available</Text>
      </View>
    )
  );

  const BowlingTab = () => (
    statsData?.bowling ? renderStatsGrid(statsData.bowling) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No bowling stats available</Text>
      </View>
    )
  );

  const FieldingTab = () => (
    statsData?.fielding ? renderStatsGrid(statsData.fielding) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No fielding stats available</Text>
      </View>
    )
  );

  const CaptainTab = () => (
    statsData?.captain ? renderStatsGrid(statsData.captain) : (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No captain stats available</Text>
      </View>
    )
  );


  if (loading && !statsData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  if (!statsData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No statistics available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarIndicatorStyle: {
            backgroundColor: '#007AFF',
            height: 3,
          },
          tabBarStyle: {
            backgroundColor: '#fff',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E5EA',
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
            textTransform: 'none',
          },
          tabBarScrollEnabled: false,
        }}
      >
        <Tab.Screen
          name="Batting"
          component={BattingTab}
          options={{ title: 'Batting' }}
        />
        <Tab.Screen
          name="Bowling"
          component={BowlingTab}
          options={{ title: 'Bowling' }}
        />
        <Tab.Screen
          name="Fielding"
          component={FieldingTab}
          options={{ title: 'Fielding' }}
        />
        <Tab.Screen
          name="Captain"
          component={CaptainTab}
          options={{ title: 'Captain' }}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 48) / 3, // 3 cards per row with padding
    minHeight: 80,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default StatsScreen;
