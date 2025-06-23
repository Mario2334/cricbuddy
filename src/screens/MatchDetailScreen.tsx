import React, { useState, useEffect } from 'react';
// import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Match } from '../types/Match';
import { MatchDetailScreenNavigationProp } from '../types/navigation';

import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Layout,
  Text,
  Card,
  Spinner,
  Button,
  Divider,
} from '@ui-kitten/components';
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
    <LinearGradient
      colors={['#3366FF', '#5A7FFF', '#7B9AFF']}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.headerContent}>
        <View style={styles.tournamentSection}>
          <View style={styles.tournamentRow}>
            <Ionicons name="trophy-outline" size={20} color="#FFD700" style={styles.headerIcon} />
            <Text category='s1' style={styles.tournamentName}>{tournamentName}</Text>
          </View>
        </View>

        <View style={styles.matchTitleSection}>
          <View style={styles.teamVsContainer}>
            <View style={styles.teamContainer}>
              <Ionicons name="people-outline" size={18} color="rgba(255,255,255,0.9)" style={styles.teamIcon} />
              <Text category='h6' style={styles.teamName}>{teamNames.team1}</Text>
            </View>

            <View style={styles.vsSection}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.vsGradient}
              >
                <Text category='s1' style={styles.vsText}>VS</Text>
              </LinearGradient>
            </View>

            <View style={styles.teamContainer}>
              <Ionicons name="people-outline" size={18} color="rgba(255,255,255,0.9)" style={styles.teamIcon} />
              <Text category='h6' style={styles.teamName}>{teamNames.team2}</Text>
            </View>
          </View>
        </View>

        <View style={styles.matchInfoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Text category='c1' style={styles.infoText}>Match Details</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );

  const renderInningsCard = (teamInnings: Innings | null, title: string, index: number) => {
    if (!teamInnings) {
      return null;
    }

    const { batting = [], bowling = [], inning = {}, teamName } = teamInnings;

    return (
      <Card key={index} style={styles.inningsCard}>
        <LinearGradient
          colors={['#FFFFFF', '#F8F9FA']}
          style={styles.inningsCardGradient}
        >
          <View style={styles.inningsHeader}>
            <View style={styles.inningsTitleRow}>
              <Ionicons name="baseball-outline" size={20} color="#3366FF" style={styles.inningsIcon} />
              <Text category='h6' style={styles.inningsTitle}>{title}</Text>
            </View>
          </View>

          {/* Team Score */}
          {inning.total_run !== undefined && (
            <LinearGradient
              colors={['#E3F2FD', '#F3E5F5']}
              style={styles.scoreSection}
            >
              <View style={styles.scoreContent}>
                <View style={styles.scoreRow}>
                  <Ionicons name="trophy-outline" size={24} color="#3366FF" />
                  <Text category='h3' style={styles.teamScore}>
                    {inning.total_run}/{inning.total_wicket || 0}
                    {inning.overs_played && ` (${inning.overs_played} ov)`}
                  </Text>
                </View>
                {inning.summary?.rr && (
                  <View style={styles.runRateRow}>
                    <Ionicons name="speedometer-outline" size={16} color="#666" />
                    <Text category='s1' style={styles.runRate}>Run Rate: {inning.summary.rr}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          )}

          {/* Batting Stats */}
          {batting.length > 0 && (
            <View style={styles.battingSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="baseball" size={18} color="#4CAF50" />
                <Text category='s1' style={styles.sectionTitle}>Batting Performance</Text>
              </View>
              <Divider style={styles.divider} />
              {batting.map((batsman: any, index: number) => (
                <View key={batsman.player_id || `batsman-${index}`} style={styles.playerRow}>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Ionicons name="person-circle-outline" size={16} color="#666" />
                      <Text category='p2' style={styles.playerName} numberOfLines={1}>
                        {batsman.name || 'Unknown'}
                        {batsman.how_to_out === 'not out' ? ' *' : ''}
                      </Text>
                    </View>
                    <Text category='c1' appearance='hint' style={styles.dismissalText}>
                      {batsman.how_to_out !== 'not out' ? batsman.how_to_out : 'Not Out'}
                    </Text>
                  </View>
                  <View style={styles.playerStats}>
                    <Text category='p1' style={styles.runsText}>
                      {batsman.runs || 0} ({batsman.balls || 0})
                    </Text>
                    <View style={styles.boundariesRow}>
                      {batsman.fours > 0 && (
                        <View style={styles.boundaryItem}>
                          <Text category='c2' style={styles.boundaryText}>4s: {batsman.fours}</Text>
                        </View>
                      )}
                      {batsman.sixes > 0 && (
                        <View style={styles.boundaryItem}>
                          <Text category='c2' style={styles.boundaryText}>6s: {batsman.sixes}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Bowling Stats */}
          {bowling.length > 0 && (
            <View style={styles.bowlingSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="football" size={18} color="#FF5722" />
                <Text category='s1' style={styles.sectionTitle}>Bowling Figures</Text>
              </View>
              <Divider style={styles.divider} />
              {bowling.map((bowler: any, index: number) => (
                <View key={bowler.player_id || `bowler-${index}`} style={styles.playerRow}>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerNameRow}>
                      <Ionicons name="person-circle-outline" size={16} color="#666" />
                      <Text category='p2' style={styles.playerName}>{bowler.name || 'Unknown'}</Text>
                    </View>
                  </View>
                  <View style={styles.bowlingStats}>
                    <Text category='p1' style={styles.bowlingFigures}>
                      {bowler.overs || 0}-{bowler.maidens || 0}-{bowler.runs || 0}-{bowler.wickets || 0}
                    </Text>
                    {bowler.economy && (
                      <Text category='c1' appearance='hint' style={styles.economyText}>
                        Econ: {bowler.economy}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>
      </Card>
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
      activeColor="#3366FF"
      inactiveColor="#888888"
    />
  );

  const renderScorecardContent = () => {
    if (!scorecard?.pageProps) {
      return (
        <Layout style={styles.noData} level='1'>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text category='h6' appearance='hint' style={styles.noDataText}>No scorecard data available</Text>
        </Layout>
      );
    }

    const scorecardData = scorecard.pageProps.scorecard || [];

    if (scorecardData.length === 0) {
      return (
        <Layout style={styles.noData} level='1'>
          <Ionicons name={"cricket-outline" as any} size={24} color="#3366FF" style={{ marginRight: 8 }} />
          <Text category='h6' appearance='hint' style={styles.noDataText}>Match scorecard will be available once the match starts</Text>
        </Layout>
      );
    }

    return (
      <Layout style={styles.content} level='1'>
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
          style={{ flex: 1 }}
        />
      </Layout>
    );
  };

  if (loading) {
    return (
      <Layout style={styles.container} level='1'>
        {renderMatchHeader()}
        <Layout style={styles.loadingContainer} level='1'>
          <Spinner size="large" />
          <Text category='s1' style={styles.loadingText}>Loading scorecard...</Text>
        </Layout>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout style={styles.container} level='1'>
        {renderMatchHeader()}
        <Layout style={styles.errorContainer} level='1'>
          <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
          <Text category='h6' status='danger' style={styles.errorText}>{error}</Text>
          <Button 
            style={styles.retryButton} 
            onPress={fetchScorecard}
            appearance='outline'
            status='primary'
          >
            Retry
          </Button>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={styles.container} level='1'>
      {renderMatchHeader()}
      <Layout style={styles.scorecardContainer} level='1'>
        {renderScorecardContent()}
      </Layout>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 24,
  },
  headerContent: {
    paddingVertical: 8,
  },
  tournamentSection: {
    marginBottom: 16,
  },
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  tournamentName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  matchTitleSection: {
    marginBottom: 12,
  },
  teamVsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIcon: {
    marginRight: 8,
  },
  teamName: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
  vsSection: {
    marginHorizontal: 16,
  },
  vsGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
  },
  vsText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  matchInfoSection: {
    marginTop: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 6,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  inningsCard: {
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
  inningsCardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  inningsHeader: {
    marginBottom: 16,
  },
  inningsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inningsIcon: {
    marginRight: 8,
  },
  inningsTitle: {
    fontWeight: '700',
    color: '#2C3E50',
    fontSize: 18,
  },
  scoreSection: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#3366FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  scoreContent: {
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamScore: {
    color: '#2C3E50',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 28,
    marginLeft: 12,
  },
  runRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runRate: {
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
    marginLeft: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionTitle: {
    marginLeft: 8,
    fontWeight: '700',
    color: '#2C3E50',
    fontSize: 16,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#E8E8E8',
  },
  battingSection: {
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8',
    paddingTop: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  bowlingSection: {
    borderTopWidth: 1,
    borderTopColor: '#FFEBEE',
    paddingTop: 12,
    backgroundColor: 'rgba(255, 87, 34, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  playerInfo: {
    flex: 1,
    marginRight: 12,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerName: {
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 6,
    flex: 1,
  },
  dismissalText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 22,
  },
  playerStats: {
    alignItems: 'flex-end',
  },
  runsText: {
    fontWeight: '700',
    color: '#2C3E50',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  boundariesRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  boundaryItem: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  boundaryText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 10,
  },
  bowlingStats: {
    alignItems: 'flex-end',
  },
  bowlingFigures: {
    fontWeight: '700',
    color: '#2C3E50',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  economyText: {
    fontSize: 12,
    color: '#FF5722',
    fontWeight: '600',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    marginTop: 8,
  },

  tabBar: {
    backgroundColor: '#f8f8f8',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tabIndicator: {
    backgroundColor: '#3366FF',
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
