import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../services/apiService';
import type { Match } from '../types/Match';
import { HomeScreenNavigationProp } from '../types/navigation';
import { formatMatchTime, getMatchStatusColor, getLocalScheduledMatches } from '../utils/matchUtils';

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
  ListHeaderComponent?: React.ReactElement | null;
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
  ListHeaderComponent = null,
}) => {
  const handleMatchPress = useCallback((item: Match) => {
    if (onMatchPress) {
      onMatchPress(item);
    } else {
      // Default behavior - navigate to match detail for all matches (upcoming, live, past)
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
          groundName: item.ground_name,
          groundId: item.ground_id,
          city: undefined, // Add city field to Match type if available
          matchStartTime: item.match_start_time || item.start_time,
          defaultTab: item.status === 'live' || item.status === 'past' ? 'scorecard' : 'info',
        });
      }
    }
  }, [onMatchPress, navigation]);

  const renderMatch = ({ item }: { item: Match }) => {
    const team1Name = item.team1_name || item.team_a || 'Team 1';
    const team2Name = item.team2_name || item.team_b || 'Team 2';

    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => handleMatchPress(item)}
      >
        <View style={styles.matchHeader}>
          <View style={styles.tournamentInfo}>
            <Text style={styles.tournamentName} numberOfLines={1}>
              {item.tournament_name || 'Practice Match'}
            </Text>
            <Text style={styles.roundName} numberOfLines={1}>
              {item.round_name || 'Match'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getMatchStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.teamsContainer}>
          {(item.status === 'live' || item.status === 'past') && (item.team1_score || item.team2_score) ? (
            // Show mini scores for live and past matches
            <View style={styles.teamRowWithScores}>
              <View style={styles.teamWithScore}>
                <Text style={styles.teamName} numberOfLines={1}>{team1Name}</Text>
                {item.team1_score && (
                  <Text style={styles.miniScore} numberOfLines={1}>
                    {item.team1_score.summary || `${item.team1_score.runs}/${item.team1_score.wickets} (${item.team1_score.overs})`}
                  </Text>
                )}
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.teamWithScore}>
                <Text style={styles.teamName} numberOfLines={1}>{team2Name}</Text>
                {item.team2_score && (
                  <Text style={styles.miniScore} numberOfLines={1}>
                    {item.team2_score.summary || `${item.team2_score.runs}/${item.team2_score.wickets} (${item.team2_score.overs})`}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            // Show regular team names for upcoming matches or when no scores available
            <View style={styles.teamRow}>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName} numberOfLines={1}>{team1Name}</Text>
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName} numberOfLines={1}>{team2Name}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.matchFooter}>
          <View style={styles.matchDetails}>
            <Text style={styles.matchType}>{item.match_format || 'T20'}</Text>
            {item.ground_name && (
              <Text style={styles.groundName} numberOfLines={1}>{item.ground_name}</Text>
            )}
            <Text style={styles.matchTime}>
              {formatMatchTime(item.start_time || item.match_start_time)}
            </Text>
          </View>

          {item.status === 'past' && item.match_result && (
            <View style={styles.resultContainer}>
              <Text style={styles.matchResultText} numberOfLines={2}>
                {item.match_result}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading matches...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
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
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color="#3498db" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {status === 'upcoming' ? 'No upcoming matches' :
              status === 'live' ? 'No live matches' :
                'No past matches found'}
          </Text>
        </View>
      }
    />
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation: _navigation }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: { fontSize: 14, fontWeight: 'bold' },
        tabBarStyle: { backgroundColor: '#f8f9fa' },
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
        // Fetch local matches only on first page load
        const localMatches = await getLocalScheduledMatches();
        const localUpcomingMatches = localMatches.filter(m => m.status === 'upcoming');

        const allMatches = [...localUpcomingMatches, ...upcomingMatches];
        // Deduplicate by match_id
        const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.match_id, item])).values());
        // Sort by start time (ascending)
        uniqueMatches.sort((a, b) => new Date(a.match_start_time).getTime() - new Date(b.match_start_time).getTime());

        setMatches(uniqueMatches);
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

  useFocusEffect(
    useCallback(() => {
      // Always reload matches when screen comes into focus to pick up newly added local matches
      loadMatches(null, true);
    }, [loadMatches])
  );

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
        // Fetch local matches only on first page load
        const localMatches = await getLocalScheduledMatches();
        const localLiveMatches = localMatches.filter(m => m.status === 'live');

        const allMatches = [...localLiveMatches, ...liveMatches];
        // Deduplicate by match_id
        const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.match_id, item])).values());
        // Sort by start time (ascending for live matches usually, or descending?)
        // Let's keep it ascending for now
        uniqueMatches.sort((a, b) => new Date(a.match_start_time).getTime() - new Date(b.match_start_time).getTime());

        setMatches(uniqueMatches);
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

  useFocusEffect(
    useCallback(() => {
      // Always reload matches when screen comes into focus to pick up newly added local matches
      loadMatches(null, true);
    }, [loadMatches])
  );

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
      let pageNo = '1';
      if (pageUrl) {
        try {
          // Try to parse as complete URL first
          const url = new URL(pageUrl);
          pageNo = url.searchParams.get('pageno') || '1';
        } catch {
          // If URL parsing fails, check if it's just a page number
          const numericPageUrl = parseInt(pageUrl);
          if (!isNaN(numericPageUrl)) {
            pageNo = pageUrl;
          } else {
            // Try to extract page number from relative URL or query string
            const pageMatch = pageUrl.match(/pageno=(\d+)/);
            pageNo = pageMatch ? pageMatch[1] : '1';
          }
        }
      }
      const response = await apiService.getPlayerPastMatches(parseInt(pageNo), 12);

      // The API service returns { matches, page } with properly mapped data
      const { matches: pastMatches, page } = response;

      if (isRefresh || !pageUrl) {
        // Fetch local matches only on first page load
        const localMatches = await getLocalScheduledMatches();
        const localPastMatches = localMatches.filter(m => m.status === 'past');

        const allMatches = [...localPastMatches, ...pastMatches];
        // Deduplicate by match_id
        const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.match_id, item])).values());
        // Sort by start time (descending for past matches)
        uniqueMatches.sort((a, b) => new Date(b.match_start_time).getTime() - new Date(a.match_start_time).getTime());

        setMatches(uniqueMatches);
      } else {
        setMatches(prev => [...prev, ...pastMatches]);
      }

      // Set next page URL if available
      setNextPageUrl(page?.next || null);
      setError(null);
      setHasInitiallyLoaded(true);
    } catch {
      setError('Failed to load past matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Always reload matches when screen comes into focus to pick up newly added local matches
      loadMatches(null, true);
    }, [loadMatches])
  );

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
    paddingHorizontal: 16,
    paddingTop: 12,
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
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  roundName: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  teamsContainer: {
    marginBottom: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 12,
  },
  matchFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchType: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  groundName: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  matchTime: {
    fontSize: 12,
    color: '#666',
  },
  resultContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  matchResultText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Mini score styles
  teamRowWithScores: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamWithScore: {
    flex: 1,
    alignItems: 'center',
  },
  miniScore: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default HomeScreen;
