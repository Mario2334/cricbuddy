import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import {
  Card,
  Text,
  Spinner,
  Layout,
} from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
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
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats(true);
  };

  const getStatIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('runs') || lowerTitle.includes('score')) return 'trending-up';
    if (lowerTitle.includes('wickets') || lowerTitle.includes('wicket')) return 'flash';
    if (lowerTitle.includes('catches') || lowerTitle.includes('catch')) return 'hand-left';
    if (lowerTitle.includes('matches') || lowerTitle.includes('match')) return 'calendar';
    if (lowerTitle.includes('average') || lowerTitle.includes('avg')) return 'analytics';
    if (lowerTitle.includes('strike') || lowerTitle.includes('rate')) return 'speedometer';
    if (lowerTitle.includes('economy') || lowerTitle.includes('eco')) return 'timer';
    if (lowerTitle.includes('overs') || lowerTitle.includes('over')) return 'time';
    if (lowerTitle.includes('balls') || lowerTitle.includes('ball')) return 'baseball';
    if (lowerTitle.includes('fours') || lowerTitle.includes('4s')) return 'square';
    if (lowerTitle.includes('sixes') || lowerTitle.includes('6s')) return 'diamond';
    return 'stats-chart';
  };

  const getStatGradient = (index: number): [string, string] => {
    const gradients: [string, string][] = [
      ['#667eea', '#764ba2'],
      ['#f093fb', '#f5576c'],
      ['#4facfe', '#00f2fe'],
      ['#43e97b', '#38f9d7'],
      ['#fa709a', '#fee140'],
      ['#a8edea', '#fed6e3'],
      ['#ffecd2', '#fcb69f'],
      ['#ff9a9e', '#fecfef'],
      ['#a18cd1', '#fbc2eb'],
      ['#fad0c4', '#ffd1ff'],
    ];
    return gradients[index % gradients.length];
  };

  const renderStatCard = (stat: StatItem, index: number) => (
    <Card key={index} style={styles.statCard}>
      <LinearGradient
        colors={getStatGradient(index)}
        style={styles.statCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.statCardContent}>
          <View style={styles.statIconContainer}>
            <Ionicons 
              name={getStatIcon(stat.title)} 
              size={24} 
              color="white" 
              style={styles.statIcon}
            />
          </View>
          <Text category='h3' style={styles.statValue}>{stat.value}</Text>
          <Text category='s1' style={styles.statTitle}>{stat.title}</Text>
        </View>
      </LinearGradient>
    </Card>
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
      <Layout style={styles.statsGrid} level='1'>
        {stats.map((stat, index) => renderStatCard(stat, index))}
      </Layout>
    </ScrollView>
  );

  // Individual tab components
  const BattingTab = () => (
    statsData?.batting ? renderStatsGrid(statsData.batting) : (
      <Layout style={styles.emptyContainer} level='1'>
        <Text category='h6' appearance='hint' style={styles.emptyText}>No batting stats available</Text>
      </Layout>
    )
  );

  const BowlingTab = () => (
    statsData?.bowling ? renderStatsGrid(statsData.bowling) : (
      <Layout style={styles.emptyContainer} level='1'>
        <Text category='h6' appearance='hint' style={styles.emptyText}>No bowling stats available</Text>
      </Layout>
    )
  );

  const FieldingTab = () => (
    statsData?.fielding ? renderStatsGrid(statsData.fielding) : (
      <Layout style={styles.emptyContainer} level='1'>
        <Text category='h6' appearance='hint' style={styles.emptyText}>No fielding stats available</Text>
      </Layout>
    )
  );

  const CaptainTab = () => (
    statsData?.captain ? renderStatsGrid(statsData.captain) : (
      <Layout style={styles.emptyContainer} level='1'>
        <Text category='h6' appearance='hint' style={styles.emptyText}>No captain stats available</Text>
      </Layout>
    )
  );

  if (loading && !statsData) {
    return (
      <Layout style={styles.loadingContainer} level='1'>
        <Spinner size="large" />
        <Text category='s1' style={styles.loadingText}>Loading statistics...</Text>
      </Layout>
    );
  }

  if (!statsData) {
    return (
      <Layout style={styles.errorContainer} level='1'>
        <Text category='h6' appearance='hint' style={styles.errorText}>No statistics available</Text>
      </Layout>
    );
  }

  return (
    <Layout style={styles.container} level='1'>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#3366FF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarIndicatorStyle: {
            backgroundColor: '#3366FF',
            height: 4,
            borderRadius: 2,
            marginBottom: 4,
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 4,
            },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            borderTopWidth: 0,
            paddingTop: 8,
            paddingBottom: 8,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '700',
            textTransform: 'none',
            letterSpacing: 0.5,
          },
          tabBarScrollEnabled: false,
          tabBarPressColor: 'rgba(51, 102, 255, 0.1)',
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
    </Layout>
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
    width: (width - 48) / 2, // 2 cards per row for better visual impact
    minHeight: 140,
    marginBottom: 16,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  statCardGradient: {
    flex: 1,
    borderRadius: 20,
    padding: 0,
  },
  statCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statValue: {
    marginBottom: 8,
    textAlign: 'center',
    color: 'white',
    fontWeight: '800',
    fontSize: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statTitle: {
    textAlign: 'center',
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default StatsScreen;
