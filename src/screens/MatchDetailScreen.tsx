import React, { useState, useEffect } from 'react';
// import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Ground } from '../types/Ground';
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
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabView, TabBar } from 'react-native-tab-view';
import Clipboard from '@react-native-clipboard/clipboard';
import apiService from '../services/apiService';
import GroundMapView from '../components/GroundMapView';
import googleMapsService, { GoogleMapsPlace } from '../services/googleMapsService';

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
  const [matchData, setMatchData] = useState<Match | null>(null);
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
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showGroundDropdown, setShowGroundDropdown] = useState<boolean>(false);
  const [selectedGroundForWhatsApp, setSelectedGroundForWhatsApp] = useState<Ground | null>(null);
  const [availableGrounds, setAvailableGrounds] = useState<Ground[]>([]);
  const [showGoogleMapsModal, setShowGoogleMapsModal] = useState<boolean>(false);
  const [googleMapsPlaces, setGoogleMapsPlaces] = useState<GoogleMapsPlace[]>([]);
  const [selectedGoogleMapsPlace, setSelectedGoogleMapsPlace] = useState<GoogleMapsPlace | null>(null);
  const [searchingPlaces, setSearchingPlaces] = useState<boolean>(false);
  const [selectedBallJersey, setSelectedBallJersey] = useState<string>('White ball, Coloured Jersey');
  const [showBallJerseyDropdown, setShowBallJerseyDropdown] = useState<boolean>(false);
  const layout = useWindowDimensions();

  const ballJerseyOptions = [
    'White ball, Coloured Jersey',
    'Red Ball, White Jersey'
  ];

  useEffect(() => {
    fetchMatchData();
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

  const fetchMatchData = async () => {
    try {
      // Fetch matches from the team matches API to get match details
      const response = await apiService.getTeamMatches('5179117', 1, 100); // Get first 100 matches
      if (response.status && response.data) {
        // Find the specific match by ID
        const match = response.data.find((m: Match) => 
          m.match_id?.toString() === matchId || m.id?.toString() === matchId
        );
        if (match) {
          setMatchData(match);
        } else {
          console.log('Match not found in current page, trying more pages...');
          // If not found in first page, try a few more pages
          for (let page = 2; page <= 5; page++) {
            const pageResponse = await apiService.getTeamMatches('5179117', page, 100);
            if (pageResponse.status && pageResponse.data) {
              const foundMatch = pageResponse.data.find((m: Match) => 
                m.match_id?.toString() === matchId || m.id?.toString() === matchId
              );
              if (foundMatch) {
                setMatchData(foundMatch);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching match data:', error);
    }
  };

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
        const scorecardData = response.data && typeof response.data === 'object' && response.data !== null && 'pageProps' in response.data 
          ? (response.data as ScorecardData).pageProps?.scorecard 
          : null;
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

      if (response.success && response.data) {
        setGroundData(response.data);
        // Set current ground as default selection for WhatsApp
        setSelectedGroundForWhatsApp(response.data);
      } else {
        console.error('Failed to load ground details:', response.error);
      }
    } catch (error) {
      console.error('Error fetching ground details:', error);
    } finally {
      setGroundLoading(false);
    }
  };

  const fetchAvailableGrounds = async () => {
    try {
      // This is a placeholder - you might need to implement a grounds search API
      // For now, we'll use the current ground data if available
      if (groundData) {
        setAvailableGrounds([groundData]);
      }
    } catch (error) {
      console.error('Error fetching available grounds:', error);
    }
  };

  const generateWhatsAppMessage = () => {
    const selectedGround = selectedGroundForWhatsApp || groundData;

    // Format date - use matchData instead of scorecard
    const matchDate = matchData?.match_start_time || matchData?.start_time
      ? new Date(matchData.match_start_time || matchData.start_time || '').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          weekday: 'long'
        })
      : 'TBD';

    // Format match time
    const matchTime = matchData?.match_start_time || matchData?.start_time
      ? new Date(matchData.match_start_time || matchData.start_time || '').toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : 'TBD';

    // Format time - reporting time is 30 minutes before match time
    const reportingTime = matchData?.match_start_time || matchData?.start_time
      ? (() => {
          const matchDateTime = new Date(matchData.match_start_time || matchData.start_time || '');
          const reportingDateTime = new Date(matchDateTime.getTime() - 30 * 60 * 1000); // Subtract 30 minutes
          return reportingDateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        })()
      : 'TBD';

    // Generate Google Maps link
    let locationLink = '';
    if (selectedGoogleMapsPlace) {
      locationLink = googleMapsService.generateMapsUrl(selectedGoogleMapsPlace);
    } else if (selectedGround?.latitude && selectedGround?.longitude) {
      locationLink = `https://maps.google.com/?q=${selectedGround.latitude},${selectedGround.longitude}`;
    } else if (selectedGround?.place_id) {
      locationLink = `https://maps.google.com/maps/place/?q=place_id:${selectedGround.place_id}`;
    } else {
      locationLink = `https://maps.google.com/maps/search/${encodeURIComponent(selectedGround?.name || groundName || 'Cricket Ground')}`;
    }

    // Generate Cricheroes link
    const cricHeroesLink = `https://cricheroes.com/scorecard/${matchId}/${tournamentName?.toLowerCase().replace(/\s+/g, '-')}/${teamNames.team1?.toLowerCase().replace(/\s+/g, '-')}-vs-${teamNames.team2?.toLowerCase().replace(/\s+/g, '-')}`;

    const message = `${tournamentName || 'Cricket Tournament'} match
${teamNames.team1} VS ${teamNames.team2}

📅 Match Date: ${matchDate}
🕐 Match Time: ${matchTime}
⌚ Reporting Time: ${reportingTime}
🏏 Overs: ${matchData?.overs || '20'} Overs
👕 Ball & Jersey: ${selectedBallJersey}
📍Location: ${locationLink}

Cricheroes : ${cricHeroesLink}

 1.⁠ ⁠Sanket`;

    return message;
  };

  const searchGoogleMapsPlaces = async () => {
    setSearchingPlaces(true);
    try {
      const searchQuery = groundName || selectedGroundForWhatsApp?.name || 'Cricket Ground';
      const places = await googleMapsService.searchPlaces(searchQuery);
      setGoogleMapsPlaces(places);
      setShowGoogleMapsModal(true);
    } catch (error) {
      console.error('Error searching Google Maps places:', error);
      Alert.alert(
        'Error',
        'Failed to search for places. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSearchingPlaces(false);
    }
  };

  const copyToWhatsApp = () => {
    // First search for Google Maps places
    searchGoogleMapsPlaces();
  };

  const copyToWhatsAppWithSelectedPlace = () => {
    try {
      const message = generateWhatsAppMessage();
      Clipboard.setString(message);
      setShowGoogleMapsModal(false);
      Alert.alert(
        'Success',
        'WhatsApp message copied to clipboard! You can now paste it in WhatsApp.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to copy message to clipboard. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchMatchData(),
      fetchScorecard(),
      groundId ? fetchGroundDetail() : Promise.resolve()
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const renderMatchHeader = () => {
    return (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.tournamentName}>
            {matchData?.tournament_name || tournamentName}
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
        {matchData?.tournament_round_name && (
          <Text style={styles.matchSubtitle}>{matchData.tournament_round_name}</Text>
        )}

        {matchData?.ground_name && (
          <View style={styles.venueInfo}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.venueText}>
              {matchData.ground_name}
            </Text>
          </View>
        )}

        {(matchData?.match_start_time || matchData?.start_time) && (
          <View style={styles.matchTimeInfo}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.matchTimeText}>
              {new Date(matchData.match_start_time || matchData.start_time || '').toLocaleString()}
            </Text>
          </View>
        )}

        {matchData?.match_type && matchData?.overs && (
          <View style={styles.matchFormatInfo}>
            <Text style={styles.matchFormatText}>
              {matchData.match_type} • {matchData.overs} overs • Cricket
            </Text>
          </View>
        )}

        {matchData?.match_result && (
          <View style={styles.matchSummaryInfo}>
            <Text style={styles.matchSummaryText}>{matchData.match_result}</Text>
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

        {/* WhatsApp Copy Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoSectionTitle}>Share Match Details</Text>

          {/* Ground Selection */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#0066cc" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Selected Ground</Text>
              <TouchableOpacity 
                style={styles.groundSelector}
                onPress={() => {
                  fetchAvailableGrounds();
                  setShowGroundDropdown(true);
                }}
              >
                <Text style={styles.groundSelectorText}>
                  {selectedGroundForWhatsApp?.name || groundName || 'Select Ground'}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Ball & Jersey Selection */}
          <View style={styles.infoRow}>
            <Ionicons name="shirt-outline" size={20} color="#0066cc" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Ball & Jersey</Text>
              <TouchableOpacity 
                style={styles.groundSelector}
                onPress={() => setShowBallJerseyDropdown(true)}
              >
                <Text style={styles.groundSelectorText}>
                  {selectedBallJersey}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Copy to WhatsApp Button */}
          <TouchableOpacity style={styles.whatsappButton} onPress={copyToWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={styles.whatsappButtonText}>Copy to WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ground Selection Modal */}
      <Modal
        visible={showGroundDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroundDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Ground</Text>
              <TouchableOpacity onPress={() => setShowGroundDropdown(false)}>
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableGrounds}
              keyExtractor={(item) => item.ground_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.groundOption,
                    selectedGroundForWhatsApp?.ground_id === item.ground_id && styles.selectedGroundOption
                  ]}
                  onPress={() => {
                    setSelectedGroundForWhatsApp(item);
                    setShowGroundDropdown(false);
                  }}
                >
                  <View style={styles.groundOptionContent}>
                    <Text style={styles.groundOptionName}>{item.name}</Text>
                    <Text style={styles.groundOptionAddress}>{item.address}</Text>
                    <Text style={styles.groundOptionCity}>{item.city_name}</Text>
                  </View>
                  {selectedGroundForWhatsApp?.ground_id === item.ground_id && (
                    <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyGroundsList}>
                  <Text style={styles.emptyGroundsText}>No grounds available</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Google Maps Place Selection Modal */}
      <Modal
        visible={showGoogleMapsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoogleMapsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location from Google Maps</Text>
              <TouchableOpacity onPress={() => setShowGoogleMapsModal(false)}>
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {searchingPlaces ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0066cc" />
                <Text style={styles.loadingText}>Searching places...</Text>
              </View>
            ) : (
              <FlatList
                data={googleMapsPlaces}
                keyExtractor={(item) => item.place_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.groundOption,
                      selectedGoogleMapsPlace?.place_id === item.place_id && styles.selectedGroundOption
                    ]}
                    onPress={() => {
                      setSelectedGoogleMapsPlace(item);
                    }}
                  >
                    <View style={styles.groundOptionContent}>
                      <Text style={styles.groundOptionName}>{item.name}</Text>
                      <Text style={styles.groundOptionAddress}>{item.formatted_address}</Text>
                      <Text style={styles.groundOptionCity}>
                        {item.types.join(', ')}
                      </Text>
                    </View>
                    {selectedGoogleMapsPlace?.place_id === item.place_id && (
                      <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyGroundsList}>
                    <Text style={styles.emptyGroundsText}>No places found</Text>
                  </View>
                }
              />
            )}

            {selectedGoogleMapsPlace && (
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.confirmButton} 
                  onPress={copyToWhatsAppWithSelectedPlace}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>Copy to WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Ball & Jersey Selection Modal */}
      <Modal
        visible={showBallJerseyDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBallJerseyDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Ball & Jersey</Text>
              <TouchableOpacity onPress={() => setShowBallJerseyDropdown(false)}>
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={ballJerseyOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.groundOption,
                    selectedBallJersey === item && styles.selectedGroundOption
                  ]}
                  onPress={() => {
                    setSelectedBallJersey(item);
                    setShowBallJerseyDropdown(false);
                  }}
                >
                  <View style={styles.groundOptionContent}>
                    <Text style={styles.groundOptionName}>{item}</Text>
                  </View>
                  {selectedBallJersey === item && (
                    <Ionicons name="checkmark-circle" size={20} color="#0066cc" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 25,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tournamentName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
    shadowColor: '#ef4444',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  liveText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  matchTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inningsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  scoreSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  teamScore: {
    fontSize: 32,
    fontWeight: '800',
    color: '#667eea',
    textAlign: 'center',
    letterSpacing: 1,
  },
  runRate: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  extrasText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    marginTop: 20,
    letterSpacing: 0.3,
  },
  battingSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  battingHeader: {
    flexDirection: 'row',
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  battingHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.2,
  },
  batsmanRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    marginBottom: 2,
  },
  batsmanNameContainer: {
    flex: 2,
  },
  batsmanName: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dismissalText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 3,
  },
  batsmanStat: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    flex: 1,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  batsmanStats: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  bowlingSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bowlingHeader: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  bowlingHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.2,
  },
  bowlerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    marginBottom: 2,
  },
  bowlerStat: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    flex: 1,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  bowlerName: {
    flex: 2,
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  bowlerStats: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  extrasSection: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  extrasDetail: {
    fontSize: 15,
    color: '#92400e',
    fontWeight: '600',
    lineHeight: 22,
  },
  fallOfWicketsSection: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  fallOfWicketsText: {
    fontSize: 15,
    color: '#991b1b',
    fontWeight: '600',
    lineHeight: 22,
  },
  toBeBatSection: {
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  toBeBatText: {
    fontSize: 15,
    color: '#0c4a6e',
    fontWeight: '600',
    lineHeight: 22,
  },
  partnershipSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  partnershipText: {
    fontSize: 15,
    color: '#15803d',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 6,
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
    backgroundColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderBottomWidth: 0,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  tabIndicator: {
    backgroundColor: '#667eea',
    height: 4,
    borderRadius: 2,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0.3,
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
  // WhatsApp Copy Styles
  groundSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginTop: 4,
  },
  groundSelectorText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  groundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedGroundOption: {
    backgroundColor: '#f0f8ff',
  },
  groundOptionContent: {
    flex: 1,
  },
  groundOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groundOptionAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  groundOptionCity: {
    fontSize: 12,
    color: '#999',
  },
  emptyGroundsList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyGroundsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MatchDetailScreen;
