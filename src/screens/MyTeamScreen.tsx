import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TabView, TabBar } from 'react-native-tab-view';
import apiService from '../services/apiService';
import type { Match } from '../types/Match';
import { MyTeamScreenNavigationProp } from '../types/navigation';
import { formatMatchTime, getMatchStatusColor } from '../utils/matchUtils';
import MatchCalendar from '../components/MatchCalendar';

interface MyTeamScreenProps {
  navigation: MyTeamScreenNavigationProp['navigation'];
  route: MyTeamScreenNavigationProp['route'];
}

const MyTeamScreen: React.FC<MyTeamScreenProps> = ({ navigation }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [tabRoutes] = useState([
    { key: 'matches', title: 'Matches' },
    { key: 'calendar', title: 'Calendar' }
  ]);
  const layout = useWindowDimensions();

  const teamId = '5179117'; // Default team ID from the API URL

  const fetchTeamMatches = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
    try {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const response = await apiService.getTeamMatches(teamId, page, 12);

      const newMatches = response.data || [];

      if (isRefresh || page === 1) {
        setMatches(newMatches);
      } else {
        setMatches(prev => [...prev, ...newMatches]);
      }

      // Check if there are more pages
      setHasNextPage(newMatches.length === 12);
      setPageNo(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [teamId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeamMatches(1, true);
  }, [fetchTeamMatches]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasNextPage) {
      fetchTeamMatches(pageNo + 1);
    }
  }, [loadingMore, hasNextPage, pageNo, fetchTeamMatches]);

  const handleMatchPress = useCallback((item: Match) => {
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
        city: undefined,
        matchStartTime: item.match_start_time || item.start_time,
        defaultTab: item.status === 'live' || item.status === 'past' ? 'scorecard' : 'info',
      });
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchTeamMatches(1, true);
    }, [fetchTeamMatches])
  );

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
          <View style={styles.groundInfo}>
            <Text style={styles.groundName} numberOfLines={1}>
              {item.ground_name || 'Ground TBD'}
            </Text>
          </View>
          <Text style={styles.matchTime}>
            {formatMatchTime(item.match_start_time || item.start_time || '')}
          </Text>
        </View>

        {item.match_result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText} numberOfLines={2}>
              {item.match_result}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0066cc" />
        <Text style={styles.loadingText}>Loading more matches...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {error ? 'Failed to load team matches' : 'No team matches found'}
        </Text>
        {error && (
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchTeamMatches(1, true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={styles.tabIndicator}
      style={styles.tabBar}
      labelStyle={styles.tabLabel}
      activeColor="#0066cc"
      inactiveColor="#666"
    />
  );

  const renderMatchesTab = () => {
    if (loading && matches.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading team matches...</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => (item.id || item.match_id || Math.random()).toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0066cc']}
              tintColor="#0066cc"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={matches.length === 0 ? styles.emptyListContainer : undefined}
        />
      </View>
    );
  };

  const renderCalendarTab = () => {
    return (
      <View style={styles.tabContent}>
        <MatchCalendar
          matches={matches}
          loading={loading}
          onMatchPress={handleMatchPress}
          onRefresh={handleRefresh}
        />
      </View>
    );
  };

  const renderScene = ({ route }: { route: { key: string; title: string } }) => {
    switch (route.key) {
      case 'matches':
        return renderMatchesTab();
      case 'calendar':
        return renderCalendarTab();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <TabView
        navigationState={{ index: tabIndex, routes: tabRoutes }}
        renderScene={renderScene}
        onIndexChange={setTabIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={renderTabBar}
        style={{ flex: 1 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabIndicator: {
    backgroundColor: '#0066cc',
    height: 3,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  matchCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tournamentInfo: {
    flex: 1,
    marginRight: 12,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roundName: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  teamsContainer: {
    marginBottom: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0066cc',
    marginHorizontal: 16,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groundInfo: {
    flex: 1,
  },
  groundName: {
    fontSize: 14,
    color: '#666',
  },
  matchTime: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  resultContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
    textAlign: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Mini score styles
  teamRowWithScores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamWithScore: {
    flex: 1,
    alignItems: 'center',
  },
  miniScore: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default MyTeamScreen;
