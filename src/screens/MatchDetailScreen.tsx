import React, { useState, useEffect } from 'react';
// import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Match } from '../types/Match';
import { MatchDetailScreenNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabView, TabBar } from 'react-native-tab-view';
import apiService from '../services/apiService';

interface Innings {
  teamName: string;
  [key: string]: any;
}

interface ScorecardData {
  pageProps?: {
    scorecard?: Innings[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface MatchDetailScreenProps {
  route: MatchDetailScreenNavigationProp['route'];
  navigation: MatchDetailScreenNavigationProp['navigation'];
}

const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({ route, navigation }) => {
  const { matchId, tournamentName, teamNames } = route.params;
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<number>(0);
  const [routes, setRoutes] = useState<Array<{ key: string; title: string; innings: Innings }>>([]);
  const layout = useWindowDimensions();

  useEffect(() => {
    fetchScorecard();
  }, []);
  
  // Process scorecard data into tab routes when it's loaded
  useEffect(() => {
    if (scorecard && scorecard.pageProps && Array.isArray(scorecard.pageProps.scorecard) && scorecard.pageProps.scorecard.length > 0) {
      const inningsArr = scorecard?.pageProps?.scorecard;
      if (Array.isArray(inningsArr)) {
        const newRoutes = inningsArr.map((innings: Innings, idx: number) => ({
          key: String(idx),
          title: innings.teamName || `Innings ${idx + 1}`,
          innings: innings
        }));
        setRoutes(newRoutes);
      }
    }
  }, [scorecard]);

  const fetchScorecard = async () => {
    try {
      setLoading(true);
      setError(null);
      // Extract match details for API call
      const matchIdParam: string | number = matchId ?? '';
      // Convert to slug format: lowercase, spaces to dashes, preserve parentheses and dots
      const tournamentSlug = (tournamentName || 'tournament')
        .toLowerCase()
        .replace(/\s+/g, '-');
      const teamNamesSlug = `${teamNames.team1 || 'Team A'}-vs-${teamNames.team2 || 'Team B'}`
        .toLowerCase()
        .replace(/\s+/g, '-');
      const response = await apiService.getMatchScorecard(matchIdParam, tournamentSlug, teamNamesSlug);
      if (response && response.data) {
        setScorecard(response.data);
      } else {
        setError('Failed to load scorecard');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load scorecard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchScorecard();
  };

  const renderMatchHeader = () => (
    <View style={styles.header}>
      <Text style={styles.tournamentName}>{tournamentName}</Text>
      <Text style={styles.matchTitle}>
        {teamNames.team1} vs {teamNames.team2}
      </Text>

      
      {false && (
        <View style={styles.resultSection}>
          <Text style={styles.matchResult}>
            <Ionicons name="trophy-outline" size={16} color="#FFD700" />
            {' '}Result: 
          </Text>
        </View>
      )}
      
      {false && (
        <Text style={styles.ground}>
          <Ionicons name="location-outline" size={14} color="#666" />
          {' '}
        </Text>
      )}
    </View>
  );

  const renderInningsCard = (teamInnings: Innings | null, title: string, index: number) => {
    if (!teamInnings) {
      return null;
    }

    const { batting = [], bowling = [], inning = {}, teamName } = teamInnings;

    return (
      <View key={index} style={styles.inningsCard}>
        <Text style={styles.inningsTitle}>{title}</Text>
        
        {/* Team Score */}
        {inning.total_run !== undefined && (
          <View style={styles.scoreSection}>
            <Text style={styles.teamScore}>
              {inning.total_run}/{inning.total_wicket || 0}
              {inning.overs_played && ` (${inning.overs_played} ov)`}
            </Text>
            {inning.summary?.rr && (
              <Text style={styles.runRate}>RR: {inning.summary.rr}</Text>
            )}
          </View>
        )}

        {/* Batting Stats */}
        {batting.length > 0 && (
          <View style={styles.battingSection}>
            <Text style={styles.sectionTitle}>Batting</Text>
            {batting.map((batsman: any, index: number) => (
              <View key={batsman.player_id || `batsman-${index}`} style={styles.batsmanRow}>
                <Text style={styles.batsmanName} numberOfLines={1}>
                  {batsman.name || 'Unknown'}
                  {batsman.how_to_out === 'not out' ? '*' : ''}
                </Text>
                <Text style={styles.batsmanStats}>
                  {batsman.runs || 0} ({batsman.balls || 0})
                  {batsman.fours ? ` 4s:${batsman.fours}` : ''}
                  {batsman.sixes ? ` 6s:${batsman.sixes}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Bowling Stats */}
        {bowling.length > 0 && (
          <View style={styles.bowlingSection}>
            <Text style={styles.sectionTitle}>Bowling</Text>
            {bowling.map((bowler: any, index: number) => (
              <View key={bowler.player_id || `bowler-${index}`} style={styles.bowlerRow}>
                <Text style={styles.bowlerName}>{bowler.name || 'Unknown'}</Text>
                <Text style={styles.bowlerStats}>
                  {bowler.overs || 0}-{bowler.maidens || 0}-{bowler.runs || 0}-{bowler.wickets || 0}
                  {bowler.economy && ` (${bowler.economy})`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderScene = ({ route }: { route: { key: string; title: string; innings: Innings } }) => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
    >
      {renderInningsCard(route.innings, route.title, parseInt(route.key, 10))} 
    </ScrollView>
  );

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={styles.tabIndicator}
      style={styles.tabBar}
      labelStyle={styles.tabLabel}
      activeColor="#0066cc"
      inactiveColor="#888888"
    />
  );

  const renderScorecardContent = () => {
    if (!scorecard?.pageProps) {
      return (
        <View style={styles.noData}>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text style={styles.noDataText}>No scorecard data available</Text>
        </View>
      );
    }

    const scorecardData = scorecard.pageProps.scorecard || [];
    
    if (scorecardData.length === 0) {
      return (
        <View style={styles.noData}>
          <Ionicons name={"cricket-outline" as any} size={24} color="#3f51b5" style={{ marginRight: 8 }} />
          <Text style={styles.noDataText}>Match scorecard will be available once the match starts</Text>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
          style={{ flex: 1 }}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {renderMatchHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading scorecard...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {renderMatchHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchScorecard}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderMatchHeader()}
      <View style={styles.scorecardContainer}>
        {renderScorecardContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#0066cc',
    padding: 16,
    paddingTop: 20,
  },
  tournamentName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  matchStatus: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginBottom: 4,
  },
  ground: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  inningsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inningsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  scoreSection: {
    marginBottom: 16,
  },
  teamScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066cc',
    textAlign: 'center',
  },
  runRate: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  battingSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  batsmanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  batsmanName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  batsmanStats: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  bowlingSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
  bowlerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  bowlerName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  bowlerStats: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  tabBar: {
    backgroundColor: '#f8f8f8',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tabIndicator: {
    backgroundColor: '#0066cc',
    height: 3,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  noData: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scorecardContainer: {
    flex: 1,
  },
  resultSection: {
    marginBottom: 8,
  },
  matchResult: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
});

export default MatchDetailScreen;
