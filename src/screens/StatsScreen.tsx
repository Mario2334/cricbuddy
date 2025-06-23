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
import type { Ground } from '../types/Ground';

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
  const [groundData, setGroundData] = useState<Ground | null>(null);
  const [loading, setLoading] = useState(false);
  const [groundLoading, setGroundLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
    loadGroundDetail();
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
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadGroundDetail = async (isRefresh = false) => {
    if (!isRefresh) {
      setGroundLoading(true);
    }

    try {
      // Using the ground ID from the previous issue (NeelGiri Cricket Ground)
      const response = await apiService.getGroundDetail(710936);

      if (response.success) {
        setGroundData(response.data);
      } else {
        if (!isRefresh) {
          Alert.alert('Error', 'Failed to load ground details. Please try again.');
        }
      }
    } catch (error) {
      if (!isRefresh) {
        Alert.alert('Error', 'Network error. Please check your connection.');
      }
    } finally {
      setGroundLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      loadStats(true),
      loadGroundDetail(true)
    ]).finally(() => {
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

  const GroundTab = () => {
    if (groundLoading && !groundData) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading ground details...</Text>
        </View>
      );
    }

    if (!groundData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No ground details available</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.groundContainer}>
          <View style={styles.groundHeader}>
            <Text style={styles.groundName}>{groundData.name}</Text>
            <Text style={styles.groundCity}>{groundData.city_name}</Text>
          </View>

          <View style={styles.groundDetailsGrid}>
            <View style={styles.groundDetailCard}>
              <Text style={styles.groundDetailValue}>{groundData.total_views}</Text>
              <Text style={styles.groundDetailTitle}>Total Views</Text>
            </View>
            <View style={styles.groundDetailCard}>
              <Text style={styles.groundDetailValue}>{groundData.rating || 'N/A'}</Text>
              <Text style={styles.groundDetailTitle}>Rating</Text>
            </View>
            <View style={styles.groundDetailCard}>
              <Text style={styles.groundDetailValue}>{groundData.is_available_for_booking ? 'Yes' : 'No'}</Text>
              <Text style={styles.groundDetailTitle}>Bookable</Text>
            </View>
          </View>

          {groundData.address && (
            <View style={styles.groundInfoSection}>
              <Text style={styles.groundInfoTitle}>Address</Text>
              <Text style={styles.groundInfoText}>{groundData.address}</Text>
            </View>
          )}

          {groundData.primary_mobile && (
            <View style={styles.groundInfoSection}>
              <Text style={styles.groundInfoTitle}>Contact</Text>
              <Text style={styles.groundInfoText}>{groundData.primary_mobile}</Text>
            </View>
          )}

          {(groundData.day_price || groundData.night_price) && (
            <View style={styles.groundInfoSection}>
              <Text style={styles.groundInfoTitle}>Pricing</Text>
              {groundData.day_price && (
                <Text style={styles.groundInfoText}>Day: {groundData.day_price}</Text>
              )}
              {groundData.night_price && (
                <Text style={styles.groundInfoText}>Night: {groundData.night_price}</Text>
              )}
            </View>
          )}

          {groundData.slot_booking_ball_type && (
            <View style={styles.groundInfoSection}>
              <Text style={styles.groundInfoTitle}>Ball Types</Text>
              <Text style={styles.groundInfoText}>{groundData.slot_booking_ball_type}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

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
        <Tab.Screen
          name="Ground"
          component={GroundTab}
          options={{ title: 'Ground' }}
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
  groundContainer: {
    flex: 1,
  },
  groundHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  groundName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  groundCity: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  groundDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  groundDetailCard: {
    width: (width - 64) / 3, // 3 cards per row with more padding
    minHeight: 80,
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
  groundDetailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  groundDetailTitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 14,
  },
  groundInfoSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groundInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  groundInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default StatsScreen;
