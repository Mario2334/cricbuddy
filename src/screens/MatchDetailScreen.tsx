import React, { useState, useEffect } from 'react';
// import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Ground } from '../types/Ground';
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
import GroundMapView from '../components/GroundMapView';

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

const MatchDetailScreen: React.FC<MatchDetailScreenProps> = ({ route }) => {
  const { matchId, tournamentName, teamNames, groundName, groundId, city, defaultTab } = route.params;
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [groundData, setGroundData] = useState<Ground | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [groundLoading, setGroundLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mainTabIndex, setMainTabIndex] = useState<number>(
    defaultTab === 'scorecard' ? 1 : 0
  );
  const [scorecardTabIndex, setScorecardTabIndex] = useState<number>(0);
  const [mainTabRoutes] = useState([
    { key: 'info', title: 'Info' },
    { key: 'scorecard', title: 'Scorecard' }
  ]);
  const [scorecardRoutes, setScorecardRoutes] = useState<Array<{ key: string; title: string; innings: Innings }>>([]);
  const [matchStatus, setMatchStatus] = useState<string>('unknown');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const layout = useWindowDimensions();

  useEffect(() => {
    fetchScorecard();
    if (groundId) {
      fetchGroundDetail();
    }
  }, []);

  // Auto-refresh for live matches
  useEffect(() => {
    if (matchStatus === 'live' && mainTabIndex === 1) { // Only refresh when on scorecard tab
      const interval = setInterval(() => {
        fetchScorecard();
      }, 30000); // Refresh every 30 seconds for live matches

      setAutoRefreshInterval(interval);

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else {
      // Clear interval if not on live match or not on scorecard tab
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        setAutoRefreshInterval(null);
      }
    }
  }, [matchStatus, mainTabIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
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
        setScorecardRoutes(newRoutes);
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

        // Detect match status from scorecard data
        const scorecardData = response.data?.pageProps?.scorecard;
        if (scorecardData && Array.isArray(scorecardData) && scorecardData.length > 0) {
          // Check if match is live by looking for ongoing innings or incomplete match data
          const hasIncompleteInnings = scorecardData.some((innings: any) => {
            return innings.inning && (
              innings.inning.is_completed === false ||
              innings.inning.status === 'live' ||
              (innings.inning.total_wicket < 10 && innings.inning.overs_played && 
               parseFloat(innings.inning.overs_played) < (innings.inning.total_overs || 20))
            );
          });

          if (hasIncompleteInnings) {
            setMatchStatus('live');
          } else {
            setMatchStatus('past');
          }
        } else {
          // No scorecard data available - could be upcoming or very early live match
          setMatchStatus('upcoming');
        }
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

  const fetchGroundDetail = async () => {
    if (!groundId) return;

    try {
      setGroundLoading(true);
      const response = await apiService.getGroundDetail(groundId);

      if (response.success) {
        setGroundData(response.data);
      } else {
        console.error('Failed to load ground details:', response.error);
      }
    } catch (error) {
      console.error('Error fetching ground details:', error);
    } finally {
      setGroundLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchScorecard(),
      groundId ? fetchGroundDetail() : Promise.resolve()
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const renderMatchHeader = () => {
    const matchInfo = scorecard?.pageProps?.matchInfo;

    return (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.tournamentName}>
            {matchInfo?.tournamentName || tournamentName}
          </Text>
          {matchStatus === 'live' && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <Text style={styles.matchTitle}>
          {teamNames.team1} vs {teamNames.team2}
        </Text>

        {/* Additional Match Details */}
        {matchInfo?.tournamentRound && (
          <Text style={styles.matchSubtitle}>{matchInfo.tournamentRound}</Text>
        )}

        {matchInfo?.groundName && matchInfo?.cityName && (
          <View style={styles.venueInfo}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.venueText}>
              {matchInfo.groundName}, {matchInfo.cityName}
            </Text>
          </View>
        )}

        {matchInfo?.startDateTime && (
          <View style={styles.matchTimeInfo}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.matchTimeText}>
              {new Date(matchInfo.startDateTime).toLocaleString()}
            </Text>
          </View>
        )}

        {matchInfo?.tossDetails && (
          <View style={styles.tossInfo}>
            <Ionicons name="disc-outline" size={14} color="#666" />
            <Text style={styles.tossText}>{matchInfo.tossDetails}</Text>
          </View>
        )}

        {matchInfo?.matchType && matchInfo?.overs && (
          <View style={styles.matchFormatInfo}>
            <Text style={styles.matchFormatText}>
              {matchInfo.matchType} • {matchInfo.overs} overs • {matchInfo.ballType || 'Cricket'}
            </Text>
          </View>
        )}

        {matchInfo?.matchSummary?.summary && (
          <View style={styles.matchSummaryInfo}>
            <Text style={styles.matchSummaryText}>{matchInfo.matchSummary.summary}</Text>
          </View>
        )}

        {matchStatus === 'live' && autoRefreshInterval && (
          <Text style={styles.autoRefreshText}>
            <Ionicons name="refresh-outline" size={12} color="#FFD700" />
            {' '}Auto-refreshing every 30s
          </Text>
        )}
      </View>
    );
  };

  const renderInningsCard = (teamInnings: Innings | null, title: string, index: number) => {
    if (!teamInnings) {
      return null;
    }

    const { 
      batting = [], 
      bowling = [], 
      inning = {}, 
      extras = { total: 0, summary: '', data: [] },
      fallOfWicket = { summary: '', data: [] },
      partnership = [],
      toBeBat = [],
      teamLogo,
      captain,
      wicketKeeper
    } = teamInnings;

    return (
      <ScrollView key={index} style={styles.inningsCard} showsVerticalScrollIndicator={false}>
        {/* Team Header with Logo */}
        <View style={styles.teamHeader}>
          {teamLogo && (
            <View style={styles.teamLogoContainer}>
              {/* Note: You might want to use Image component here if logos are to be displayed */}
              <Text style={styles.teamLogoPlaceholder}>🏏</Text>
            </View>
          )}
          <View style={styles.teamTitleContainer}>
            <Text style={styles.inningsTitle}>{title}</Text>
            {captain && (
              <Text style={styles.captainInfo}>
                Captain: {captain.player_name} {captain.is_wicket_keeper ? '(wk)' : ''}
              </Text>
            )}
          </View>
        </View>

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
            {extras.total > 0 && (
              <Text style={styles.extrasText}>Extras: {extras.total}</Text>
            )}
          </View>
        )}

        {/* Batting Stats */}
        {batting.length > 0 && (
          <View style={styles.battingSection}>
            <Text style={styles.sectionTitle}>Batting</Text>
            <View style={styles.battingHeader}>
              <Text style={styles.battingHeaderText}>Batsman</Text>
              <Text style={styles.battingHeaderText}>R(B)</Text>
              <Text style={styles.battingHeaderText}>4s</Text>
              <Text style={styles.battingHeaderText}>6s</Text>
              <Text style={styles.battingHeaderText}>SR</Text>
            </View>
            {batting.map((batsman: any, index: number) => (
              <View key={batsman.player_id || `batsman-${index}`} style={styles.batsmanRow}>
                <View style={styles.batsmanNameContainer}>
                  <Text style={styles.batsmanName} numberOfLines={1}>
                    {batsman.name || 'Unknown'}
                    {batsman.how_to_out === 'not out' ? '*' : ''}
                  </Text>
                  {batsman.how_to_out && batsman.how_to_out !== 'not out' && (
                    <Text style={styles.dismissalText} numberOfLines={1}>
                      {batsman.how_to_out}
                    </Text>
                  )}
                </View>
                <Text style={styles.batsmanStat}>{batsman.runs || 0}({batsman.balls || 0})</Text>
                <Text style={styles.batsmanStat}>{batsman['4s'] || 0}</Text>
                <Text style={styles.batsmanStat}>{batsman['6s'] || 0}</Text>
                <Text style={styles.batsmanStat}>{batsman.SR || '0.00'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Extras Breakdown */}
        {extras.total > 0 && (
          <View style={styles.extrasSection}>
            <Text style={styles.sectionTitle}>Extras ({extras.total})</Text>
            <Text style={styles.extrasDetail}>{extras.summary || `Total: ${extras.total}`}</Text>
          </View>
        )}

        {/* Fall of Wickets */}
        {fallOfWicket.data && fallOfWicket.data.length > 0 && (
          <View style={styles.fallOfWicketsSection}>
            <Text style={styles.sectionTitle}>Fall of Wickets</Text>
            <Text style={styles.fallOfWicketsText}>{fallOfWicket.summary}</Text>
          </View>
        )}

        {/* Yet to Bat */}
        {toBeBat.length > 0 && (
          <View style={styles.toBeBatSection}>
            <Text style={styles.sectionTitle}>Yet to Bat</Text>
            <Text style={styles.toBeBatText}>
              {toBeBat.map((player: any) => player.name).join(', ')}
            </Text>
          </View>
        )}

        {/* Bowling Stats */}
        {bowling.length > 0 && (
          <View style={styles.bowlingSection}>
            <Text style={styles.sectionTitle}>Bowling</Text>
            <View style={styles.bowlingHeader}>
              <Text style={styles.bowlingHeaderText}>Bowler</Text>
              <Text style={styles.bowlingHeaderText}>O</Text>
              <Text style={styles.bowlingHeaderText}>M</Text>
              <Text style={styles.bowlingHeaderText}>R</Text>
              <Text style={styles.bowlingHeaderText}>W</Text>
              <Text style={styles.bowlingHeaderText}>Econ</Text>
            </View>
            {bowling.map((bowler: any, index: number) => (
              <View key={bowler.player_id || `bowler-${index}`} style={styles.bowlerRow}>
                <Text style={styles.bowlerName} numberOfLines={1}>{bowler.name || 'Unknown'}</Text>
                <Text style={styles.bowlerStat}>{bowler.overs || 0}</Text>
                <Text style={styles.bowlerStat}>{bowler.maidens || 0}</Text>
                <Text style={styles.bowlerStat}>{bowler.runs || 0}</Text>
                <Text style={styles.bowlerStat}>{bowler.wickets || 0}</Text>
                <Text style={styles.bowlerStat}>{bowler.economy_rate || '0.00'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Partnership Details */}
        {partnership.length > 0 && (
          <View style={styles.partnershipSection}>
            <Text style={styles.sectionTitle}>Partnerships</Text>
            {partnership.map((p: any, index: number) => (
              <Text key={index} style={styles.partnershipText}>
                {p.summary || `Partnership ${index + 1}`}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderInfoTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <Text style={styles.infoSectionTitle}>Match Information</Text>

          <View style={styles.infoRow}>
            <Ionicons name="trophy-outline" size={20} color="#0066cc" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Tournament</Text>
              <Text style={styles.infoValue}>{tournamentName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color="#0066cc" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Teams</Text>
              <Text style={styles.infoValue}>{teamNames.team1} vs {teamNames.team2}</Text>
            </View>
          </View>

          {groundName && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#0066cc" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Ground</Text>
                <Text style={styles.infoValue}>{groundName}</Text>
              </View>
            </View>
          )}

          {city && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color="#0066cc" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>City</Text>
                <Text style={styles.infoValue}>{city}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Ground Details Section */}
        {groundData && (
          <View style={styles.infoCard}>
            <Text style={styles.infoSectionTitle}>Ground Details</Text>

            {/* Google Maps Integration */}
            <View style={styles.mapSection}>
              <GroundMapView ground={groundData} showSearchButton={true} />
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#0066cc" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Ground Name</Text>
                <Text style={styles.infoValue}>{groundData.name}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color="#0066cc" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>City</Text>
                <Text style={styles.infoValue}>{groundData.city_name}</Text>
              </View>
            </View>

            {groundData.address && (
              <View style={styles.infoRow}>
                <Ionicons name="home-outline" size={20} color="#0066cc" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{groundData.address}</Text>
                </View>
              </View>
            )}

            {groundData.primary_mobile && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color="#0066cc" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Contact</Text>
                  <Text style={styles.infoValue}>{groundData.primary_mobile}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="eye-outline" size={20} color="#0066cc" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Total Views</Text>
                <Text style={styles.infoValue}>{groundData.total_views}</Text>
              </View>
            </View>

            {groundData.rating > 0 && (
              <View style={styles.infoRow}>
                <Ionicons name="star-outline" size={20} color="#0066cc" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Rating</Text>
                  <Text style={styles.infoValue}>{groundData.rating}/5</Text>
                </View>
              </View>
            )}

            {(groundData.day_price || groundData.night_price) && (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={20} color="#0066cc" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Pricing</Text>
                  <Text style={styles.infoValue}>
                    {groundData.day_price && `Day: ${groundData.day_price}`}
                    {groundData.day_price && groundData.night_price && ' | '}
                    {groundData.night_price && `Night: ${groundData.night_price}`}
                  </Text>
                </View>
              </View>
            )}

            {groundData.slot_booking_ball_type && (
              <View style={styles.infoRow}>
                <Ionicons name="baseball-outline" size={20} color="#0066cc" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Ball Types</Text>
                  <Text style={styles.infoValue}>{groundData.slot_booking_ball_type}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#0066cc" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Available for Booking</Text>
                <Text style={styles.infoValue}>{groundData.is_available_for_booking ? 'Yes' : 'No'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading state for ground details */}
        {groundLoading && (
          <View style={styles.infoCard}>
            <Text style={styles.infoSectionTitle}>Ground Details</Text>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#0066cc" />
              <Text style={styles.loadingText}>Loading ground details...</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderScorecardScene = ({ route }: { route: { key: string; title: string; innings: Innings } }) => (
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

  const renderScorecardTab = () => {
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
          <Ionicons name="baseball-outline" size={24} color="#3f51b5" style={{ marginRight: 8 }} />
          <Text style={styles.noDataText}>Match scorecard will be available once the match starts</Text>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <TabView
          navigationState={{ index: scorecardTabIndex, routes: scorecardRoutes }}
          renderScene={renderScorecardScene}
          onIndexChange={setScorecardTabIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
          style={{ flex: 1 }}
        />
      </View>
    );
  };

  const renderMainScene = ({ route }: { route: { key: string; title: string } }) => {
    switch (route.key) {
      case 'info':
        return renderInfoTab();
      case 'scorecard':
        return renderScorecardTab();
      default:
        return null;
    }
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
        <TabView
          navigationState={{ index: mainTabIndex, routes: mainTabRoutes }}
          renderScene={renderMainScene}
          onIndexChange={setMainTabIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
          style={{ flex: 1 }}
        />
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tournamentName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff4444',
    marginRight: 4,
  },
  liveText: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  matchTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  autoRefreshText: {
    color: '#FFD700',
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },
  matchSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginBottom: 4,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  venueText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  matchTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchTimeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  tossInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tossText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  matchFormatInfo: {
    marginBottom: 4,
  },
  matchFormatText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  matchSummaryInfo: {
    marginBottom: 4,
  },
  matchSummaryText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
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
  extrasText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamLogoContainer: {
    marginRight: 12,
  },
  teamLogoPlaceholder: {
    fontSize: 24,
  },
  teamTitleContainer: {
    flex: 1,
  },
  captainInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  battingHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  battingHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  batsmanRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  batsmanNameContainer: {
    flex: 2,
  },
  batsmanName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  dismissalText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  batsmanStat: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    flex: 1,
    fontFamily: 'monospace',
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
  bowlingHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  bowlingHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  bowlerRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bowlerStat: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    flex: 1,
    fontFamily: 'monospace',
  },
  bowlerName: {
    flex: 2,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  bowlerStats: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  extrasSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  extrasDetail: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
  },
  fallOfWicketsSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  fallOfWicketsText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
  },
  toBeBatSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  toBeBatText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    lineHeight: 20,
  },
  partnershipSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  partnershipText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
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
  infoContainer: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#ffffff',
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
  infoSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  mapSection: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default MatchDetailScreen;
