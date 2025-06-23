import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import {
  Card,
  Text,
  Button,
  Spinner,
  Layout,
  Divider,
  Icon,
} from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService';
import type { Match } from '../types/Match';
import { HomeScreenNavigationProp } from '../types/navigation';
import { formatMatchTime, getMatchStatusColor } from '../utils/matchUtils';

const Tab = createMaterialTopTabNavigator();

interface TabComponentProps {
  navigation: HomeScreenNavigationProp['navigation'];
}

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenNavigationProp['route'];
}

interface MatchListProps {
  status: 'upcoming' | 'live' | 'past';
  matches: Match[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  loadingMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onEndReached?: () => void;
  onMatchPress?: (match: Match) => void;
  hasNextPage: boolean;
  navigation: HomeScreenNavigationProp['navigation'];
}

const MatchList: React.FC<MatchListProps> = ({
  status,
  matches = [],
  loading = false,
  error = null,
  refreshing = false,
  loadingMore = false,
  onRefresh,
  onLoadMore,
  onEndReached,
  onMatchPress,
  hasNextPage = false,
  navigation,
}) => {
  const handleMatchPress = useCallback((item: Match) => {
    if (onMatchPress) {
      onMatchPress(item);
    } else {
      // Default behavior - navigate to match detail for live/past matches
      if (item.status === 'live' || item.status === 'past') {
        // Use item.id or item.match_id with fallback to ensure we have a valid ID
        const matchId = item.id || item.match_id;
        if (matchId) {
          navigation.navigate('MatchDetail', {
            matchId: matchId.toString(),
            tournamentName: item.tournament_name || 'Match',
            teamNames: {
              team1: item.team1_name || item.team_a || 'Team 1',
              team2: item.team2_name || item.team_b || 'Team 2',
            },
          });
        }
      }
    }
  }, [onMatchPress, navigation]);

  const renderMatch = ({ item }: { item: Match }) => {
    const team1Name = item.team1_name || item.team_a || 'Team 1';
    const team2Name = item.team2_name || item.team_b || 'Team 2';

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'live':
          return 'radio-button-on-outline';
        case 'upcoming':
          return 'time-outline';
        case 'past':
          return 'checkmark-circle-outline';
        default:
          return 'help-circle-outline';
      }
    };

    const getStatusGradient = (status: string): [string, string] => {
      switch (status) {
        case 'live':
          return ['#FF6B6B', '#FF8E53'];
        case 'upcoming':
          return ['#4ECDC4', '#44A08D'];
        case 'past':
          return ['#A8EDEA', '#FED6E3'];
        default:
          return ['#D3D3D3', '#A8A8A8'];
      }
    };

    return (
      <Card 
        style={styles.matchCard}
        onPress={() => handleMatchPress(item)}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F8F9FA']}
          style={styles.cardGradient}
        >
          <View style={styles.matchHeader}>
            <View style={styles.tournamentInfo}>
              <View style={styles.tournamentTitleRow}>
                <Ionicons name="trophy-outline" size={16} color="#3366FF" style={styles.tournamentIcon} />
                <Text category='h6' numberOfLines={1} style={styles.tournamentTitle}>
                  {item.tournament_name || 'Practice Match'}
                </Text>
              </View>
              <Text category='c1' appearance='hint' numberOfLines={1} style={styles.roundText}>
                {item.round_name || 'Match'}
              </Text>
            </View>
            <LinearGradient
              colors={getStatusGradient(item.status)}
              style={styles.statusBadge}
            >
              <View style={styles.statusContent}>
                <Ionicons 
                  name={getStatusIcon(item.status)} 
                  size={12} 
                  color="white" 
                  style={styles.statusIcon}
                />
                <Text category='c2' style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </LinearGradient>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.teamsContainer}>
            <View style={styles.teamRow}>
              <View style={styles.teamInfo}>
                <View style={styles.teamNameRow}>
                  <Ionicons name="people-outline" size={16} color="#666" style={styles.teamIcon} />
                  <Text category='s1' numberOfLines={1} style={styles.teamName}>{team1Name}</Text>
                </View>
              </View>
              <View style={styles.vsContainer}>
                <LinearGradient
                  colors={['#3366FF', '#5A7FFF']}
                  style={styles.vsGradient}
                >
                  <Text category='s2' style={styles.vsText}>VS</Text>
                </LinearGradient>
              </View>
              <View style={styles.teamInfo}>
                <View style={styles.teamNameRow}>
                  <Ionicons name="people-outline" size={16} color="#666" style={styles.teamIcon} />
                  <Text category='s1' numberOfLines={1} style={styles.teamName}>{team2Name}</Text>
                </View>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.matchFooter}>
            <View style={styles.matchDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="baseball-outline" size={14} color="#666" />
                <Text category='c1' appearance='hint' style={styles.detailText}>{item.match_format || 'T20'}</Text>
              </View>
              {item.ground_name && (
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={14} color="#666" />
                  <Text category='c1' appearance='hint' numberOfLines={1} style={styles.detailText}>{item.ground_name}</Text>
                </View>
              )}
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text category='c1' appearance='hint' style={styles.detailText}>
                  {formatMatchTime(item.start_time || item.match_start_time)}
                </Text>
              </View>
            </View>

            {item.status === 'past' && item.match_result && (
              <LinearGradient
                colors={['#E8F5E8', '#F0F8F0']}
                style={styles.resultContainer}
              >
                <View style={styles.resultContent}>
                  <Ionicons name="trophy" size={16} color="#4CAF50" style={styles.resultIcon} />
                  <Text category='c1' numberOfLines={2} style={styles.matchResultText}>
                    {item.match_result}
                  </Text>
                </View>
              </LinearGradient>
            )}
          </View>
        </LinearGradient>
      </Card>
    );
  };

  if (loading) {
    return (
      <Layout style={styles.loadingContainer} level='1'>
        <Spinner size='large' />
        <Text category='s1' style={styles.loadingText}>Loading matches...</Text>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout style={styles.errorContainer} level='1'>
        <Text category='h6' status='danger' style={styles.errorText}>{error}</Text>
        <Button 
          style={styles.retryButton} 
          onPress={onRefresh}
          appearance='outline'
          status='primary'
        >
          Try Again
        </Button>
      </Layout>
    );
  }

  return (
    <FlatList
      data={matches}
      keyExtractor={(item, index) => (item.id || item.match_id || index).toString()}
      renderItem={renderMatch}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      onEndReached={hasNextPage && !loadingMore ? onEndReached || onLoadMore : undefined}
      onEndReachedThreshold={0.1}
      ListFooterComponent={
        loadingMore ? (
          <Layout style={styles.loadingMoreContainer} level='1'>
            <Spinner size="small" />
          </Layout>
        ) : null
      }
      ListEmptyComponent={
        <Layout style={styles.emptyContainer} level='1'>
          <Text category='h6' appearance='hint' style={styles.emptyText}>
            {status === 'upcoming' ? 'No upcoming matches' : 
              status === 'live' ? 'No live matches' : 
              'No past matches found'}
          </Text>
        </Layout>
      }
    />
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation: _navigation }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3366FF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: { 
          fontSize: 14, 
          fontWeight: '700',
          letterSpacing: 0.5,
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
        tabBarIndicatorStyle: {
          backgroundColor: '#3366FF',
          height: 4,
          borderRadius: 2,
          marginBottom: 4,
        },
        tabBarPressColor: 'rgba(51, 102, 255, 0.1)',
      }}
    >
      <Tab.Screen name="Upcoming" component={UpcomingTab} />
      <Tab.Screen name="Live" component={LiveTab} />
      <Tab.Screen name="Past" component={CompletedTab} />
    </Tab.Navigator>
  );
};

// Tab Components
interface UpcomingTabProps {
  navigation: HomeScreenNavigationProp['navigation'];
}

const UpcomingTab: React.FC<UpcomingTabProps> = ({ navigation }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const loadMatches = useCallback(async (pageUrl: string | null = null, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      // Clear cache on manual refresh to get fresh data
      apiService.clearUpcomingLiveCache();
    } else if (pageUrl) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let response;
      let upcomingMatches: Match[] = [];
      let nextPageUrl: string | null = null;

      if (pageUrl) {
        // If we have a full URL, use fetchMatchesFromUrl
        const result = await apiService.fetchMatchesFromUrl(pageUrl);
        upcomingMatches = result.matches.filter((match: Match) => match.status === 'upcoming');
        nextPageUrl = result.page?.next || null;
      } else {
        // Use the new unified cached method for upcoming matches
        const result = await apiService.getUpcomingMatches(1, 60);
        if (result.success && result.data) {
          upcomingMatches = result.data.matches || [];
          nextPageUrl = result.data.page?.next || null;
        } else {
          throw new Error(result.error || 'Failed to load upcoming matches');
        }
      }

      if (isRefresh || !pageUrl) {
        setMatches(upcomingMatches);
      } else {
        setMatches(prev => [...prev, ...upcomingMatches]);
      }

      // Set next page URL if available
      setNextPageUrl(nextPageUrl);
      setError(null);
      setHasInitiallyLoaded(true);
    } catch (err) {
      console.error('Error loading upcoming matches:', err);
      setError('Failed to load upcoming matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!hasInitiallyLoaded) {
      loadMatches();
    }
  }, [hasInitiallyLoaded, loadMatches]);

  const handleRefresh = useCallback(() => {
    loadMatches(null, true);
  }, [loadMatches]);

  const handleLoadMore = useCallback(() => {
    if (nextPageUrl && !loadingMore) {
      loadMatches(nextPageUrl);
    }
  }, [nextPageUrl, loadingMore, loadMatches]);

  return (
    <MatchList
      status="upcoming"
      matches={matches}
      loading={loading}
      error={error}
      refreshing={refreshing}
      loadingMore={loadingMore}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      hasNextPage={!!nextPageUrl}
      navigation={navigation}
    />
  );
};

const LiveTab: React.FC<TabComponentProps> = ({ navigation }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const loadMatches = useCallback(async (pageUrl: string | null = null, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      // Clear cache on manual refresh to get fresh data
      apiService.clearUpcomingLiveCache();
    } else if (pageUrl) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let liveMatches: Match[] = [];
      let nextPageUrl: string | null = null;

      if (pageUrl) {
        // If we have a full URL, use fetchMatchesFromUrl
        const result = await apiService.fetchMatchesFromUrl(pageUrl);
        liveMatches = result.matches.filter((match: Match) => match.status === 'live');
        nextPageUrl = result.page?.next || null;
      } else {
        // Use the new unified cached method for live matches
        const result = await apiService.getLiveMatches(1, 60);
        if (result.success && result.data) {
          liveMatches = result.data.matches || [];
          nextPageUrl = result.data.page?.next || null;
        } else {
          throw new Error(result.error || 'Failed to load live matches');
        }
      }

      if (isRefresh || !pageUrl) {
        setMatches(liveMatches);
      } else {
        setMatches(prev => [...prev, ...liveMatches]);
      }

      setNextPageUrl(nextPageUrl);
      setError(null);
      setHasInitiallyLoaded(true);
    } catch (err) {
      console.error('Error loading live matches:', err);
      setError('Failed to load live matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!hasInitiallyLoaded) {
      loadMatches();
    }
  }, [hasInitiallyLoaded, loadMatches]);

  const handleRefresh = useCallback(() => {
    loadMatches(null, true);
  }, [loadMatches]);

  const handleLoadMore = useCallback(() => {
    if (nextPageUrl && !loadingMore) {
      loadMatches(nextPageUrl);
    }
  }, [nextPageUrl, loadingMore, loadMatches]);

  return (
    <MatchList
      status="live"
      matches={matches}
      loading={loading}
      error={error}
      refreshing={refreshing}
      loadingMore={loadingMore}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      hasNextPage={!!nextPageUrl}
      navigation={navigation}
    />
  );
};

const CompletedTab: React.FC<TabComponentProps> = ({ navigation }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const loadMatches = useCallback(async (pageUrl: string | null = null, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (pageUrl) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      // Extract page number from URL if provided, otherwise default to page 1
      const pageNo = pageUrl ? new URL(pageUrl).searchParams.get('pageno') || '1' : '1';
      const response = await apiService.getPlayerPastMatches(parseInt(pageNo), 12);

      // The API service returns { matches, page } with properly mapped data
      const { matches: pastMatches, page } = response;

      if (isRefresh || !pageUrl) {
        setMatches(pastMatches);
      } else {
        setMatches(prev => [...prev, ...pastMatches]);
      }

      // Set next page URL if available
      setNextPageUrl(page?.next || null);
      setError(null);
      setHasInitiallyLoaded(true);
    } catch (_err) {
      setError('Failed to load past matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!hasInitiallyLoaded) {
      loadMatches();
    }
  }, [hasInitiallyLoaded, loadMatches]);

  const handleRefresh = useCallback(() => {
    loadMatches(null, true);
  }, [loadMatches]);

  const handleLoadMore = useCallback(() => {
    if (nextPageUrl && !loadingMore) {
      loadMatches(nextPageUrl);
    }
  }, [nextPageUrl, loadingMore, loadMatches]);

  return (
    <MatchList
      status="past"
      matches={matches}
      loading={loading}
      error={error}
      refreshing={refreshing}
      loadingMore={loadingMore}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      hasNextPage={!!nextPageUrl}
      navigation={navigation}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#e74c3c',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  matchCard: {
    marginBottom: 16,
    borderRadius: 16,
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
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#E8E8E8',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tournamentInfo: {
    flex: 1,
    marginRight: 12,
  },
  tournamentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tournamentIcon: {
    marginRight: 6,
  },
  tournamentTitle: {
    flex: 1,
    fontWeight: '700',
    color: '#2C3E50',
  },
  roundText: {
    marginLeft: 22,
    fontSize: 12,
    color: '#7F8C8D',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  teamsContainer: {
    marginVertical: 12,
    paddingVertical: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamInfo: {
    flex: 1,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIcon: {
    marginRight: 8,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  vsContainer: {
    marginHorizontal: 16,
  },
  vsGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#3366FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 1,
  },
  matchFooter: {
    marginTop: 8,
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  resultContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIcon: {
    marginRight: 8,
  },
  matchResultText: {
    textAlign: 'center',
    color: '#2E7D32',
    fontWeight: '600',
    flex: 1,
  },
});

export default HomeScreen;
