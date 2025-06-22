import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import apiService from '../services/apiService';

const Tab = createMaterialTopTabNavigator();

const HomeScreen = ({ navigation }) => {
  const [allMatches, setAllMatches] = useState([]);
  const [pastMatches, setPastMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pastLoading, setPastLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pastRefreshing, setPastRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageUrl, setNextPageUrl] = useState(null);
  const [previousPageUrl, setPreviousPageUrl] = useState(null);
  const [pastNextPageUrl, setPastNextPageUrl] = useState(null);
  const [pastPreviousPageUrl, setPastPreviousPageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [pastError, setPastError] = useState(null);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);
  const [isPastRequestInProgress, setIsPastRequestInProgress] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [hasPastInitiallyLoaded, setHasPastInitiallyLoaded] = useState(false);

  const loadMatches = async (pageUrl = null, isRefresh = false) => {
    // Prevent multiple simultaneous requests
    if (isRequestInProgress && !isRefresh) {
      console.log('Request already in progress, skipping...');
      return;
    }

    setIsRequestInProgress(true);
    setError(null);

    if (!pageUrl || isRefresh) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let response;
      
      if (pageUrl) {
        // Use the provided next/previous URL
        response = await apiService.fetchMatchesFromUrl(pageUrl);
      } else {
        // Initial load - fetch first page
        response = await apiService.getPlayerMatches(1, 60);
      }
      
      const newMatches = response.matches || [];
      
      if (isRefresh || !pageUrl) {
        setAllMatches(newMatches);
      } else {
        setAllMatches(prev => [...prev, ...newMatches]);
      }
      
      // Update pagination URLs from response
      setNextPageUrl(response.page?.next || null);
      setPreviousPageUrl(response.page?.previous || null);
      setHasInitiallyLoaded(true);
      
    } catch (error) {
      console.error('Error loading matches:', error);
      setError('An unexpected error occurred. Please try again.');
      if (error.message && error.message.includes('429')) {
        setError('Too many requests. Please wait a moment and try again.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setIsRequestInProgress(false);
    }
  };

  const loadPastMatches = async (pageUrl = null, isRefresh = false) => {
    // Prevent multiple simultaneous requests
    if (isPastRequestInProgress && !isRefresh) {
      console.log('Request already in progress, skipping...');
      return;
    }

    setIsPastRequestInProgress(true);
    setPastError(null);

    if (!pageUrl || isRefresh) {
      setPastLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let response;
      
      if (pageUrl) {
        // Use the provided next/previous URL
        response = await apiService.fetchMatchesFromUrl(pageUrl);
      } else {
        // Initial load - fetch first page
        response = await apiService.getPlayerPastMatches(1, 60);
      }
      
      const newMatches = response.matches || [];
      
      if (isRefresh || !pageUrl) {
        setPastMatches(newMatches);
      } else {
        setPastMatches(prev => [...prev, ...newMatches]);
      }
      
      // Update pagination URLs from response
      setPastNextPageUrl(response.page?.next || null);
      setPastPreviousPageUrl(response.page?.previous || null);
      setHasPastInitiallyLoaded(true);
      
    } catch (error) {
      console.error('Error loading past matches:', error);
      setPastError('An unexpected error occurred. Please try again.');
      if (error.message && error.message.includes('429')) {
        setPastError('Too many requests. Please wait a moment and try again.');
      }
    } finally {
      setPastLoading(false);
      setLoadingMore(false);
      setPastRefreshing(false);
      setIsPastRequestInProgress(false);
    }
  };

  const onRefresh = () => {
    if (isRequestInProgress) {
      console.log('Request in progress, cannot refresh now');
      return;
    }
    setRefreshing(true);
    loadMatches(null, true);
  };

  const loadMoreMatches = () => {
    // Only allow loading more matches in Upcoming tab and when user manually scrolls
    // Use the nextPageUrl provided by the API instead of manual page calculation
    if (!loadingMore && nextPageUrl && !isRequestInProgress) {
      loadMatches(nextPageUrl);
    }
  };

  const loadMorePastMatches = () => {
    // Only allow loading more matches in Past tab and when user manually scrolls
    // Use the nextPageUrl provided by the API instead of manual page calculation
    if (!loadingMore && pastNextPageUrl && !isPastRequestInProgress) {
      loadPastMatches(pastNextPageUrl);
    }
  };

  const formatMatchTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMatchStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return '#007AFF';
      case 'live': return '#FF3B30';
      case 'completed': return '#28a745';
      default: return '#8E8E93';
    }
  };

  const renderMatchItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.matchCard}
      onPress={() => {
        // Only allow navigation to scorecard for live or past matches
        if (item.status === 'live' || item.status === 'past') {
          navigation.navigate('MatchDetail', { match: item });
        } else {
          Alert.alert(
            'Match Scorecard', 
            'Scorecard is only available for live and past matches.',
            [{ text: 'OK' }]
          );
        }
      }}
    >
      <View style={styles.matchHeader}>
        <View style={styles.tournamentInfo}>
          <Text style={styles.tournamentName} numberOfLines={1}>
            {item.tournament_name}
          </Text>
          <Text style={styles.roundName}>{item.tournament_round_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getMatchStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.teamsContainer}>
        <View style={styles.teamRow}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName} numberOfLines={1}>{item.team_a}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName} numberOfLines={1}>{item.team_b}</Text>
          </View>
        </View>
        
        {/* Show match result for past matches */}
        {item.status === 'past' && item.match_summary?.summary && (
          <View style={styles.resultContainer}>
            <Text style={styles.matchResultText} numberOfLines={2}>
              🏆 {item.match_summary.summary}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.matchFooter}>
        <View style={styles.matchDetails}>
          <Text style={styles.matchType}>{item.match_type} • {item.overs} Overs</Text>
          <Text style={styles.groundName} numberOfLines={1}>{item.ground_name}</Text>
        </View>
        <Text style={styles.matchTime}>{formatMatchTime(item.match_start_time)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0066cc" />
        <Text style={styles.loadingText}>Loading more matches...</Text>
      </View>
    );
  };

  const renderEmptyState = (status) => {
    if (!hasInitiallyLoaded) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Pull down to load {status} matches</Text>
          <TouchableOpacity style={styles.loadButton} onPress={() => loadMatches(null, true)}>
            <Text style={styles.loadButtonText}>Load Matches</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No {status} matches found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadMatches(null, true)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPastEmptyState = (status) => {
    if (!hasPastInitiallyLoaded) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Pull down to load {status} matches</Text>
          <TouchableOpacity style={styles.loadButton} onPress={() => loadPastMatches(null, true)}>
            <Text style={styles.loadButtonText}>Load Matches</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No {status} matches found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadPastMatches(null, true)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Component for each tab content
  const MatchList = ({ status }) => {
    const filteredMatches = status === 'completed' ? pastMatches : allMatches.filter(match => match.status === status);

    // No useFocusEffect - use shared data from parent component
    
    if (status === 'completed' ? pastLoading : loading && !hasInitiallyLoaded) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading {status} matches...</Text>
        </View>
      );
    }

    if ((status === 'completed' ? pastError : error) && !hasInitiallyLoaded) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{status === 'completed' ? pastError : error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => status === 'completed' ? loadPastMatches(null, true) : loadMatches(null, true)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredMatches}
        renderItem={renderMatchItem}
        keyExtractor={(item) => item.match_id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status === 'completed' ? pastRefreshing : refreshing}
            onRefresh={status === 'completed' ? () => loadPastMatches(null, true) : onRefresh}
            colors={['#0066cc']}
            tintColor="#0066cc"
          />
        }
        // Only allow pagination in Upcoming tab
        onEndReached={hasInitiallyLoaded && status === 'upcoming' ? loadMoreMatches : status === 'completed' ? loadMorePastMatches : null}
        onEndReachedThreshold={0.1}
        // Only show footer loader for Upcoming tab
        ListFooterComponent={status === 'upcoming' ? renderFooter : status === 'completed' ? renderFooter : null}
        ListEmptyComponent={() => status === 'completed' ? renderPastEmptyState(status) : renderEmptyState(status)}
      />
    );
  };

  useEffect(() => {
    if (!hasInitiallyLoaded && !isRequestInProgress) {
      loadMatches(null, false);
    }
  }, [hasInitiallyLoaded, isRequestInProgress]);

  useEffect(() => {
    if (!hasPastInitiallyLoaded && !isPastRequestInProgress) {
      loadPastMatches(null, false);
    }
  }, [hasPastInitiallyLoaded, isPastRequestInProgress]);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
          textTransform: 'capitalize',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3.84,
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#0066cc',
          height: 3,
        },
      }}
    >
      <Tab.Screen 
        name="Upcoming" 
        children={() => <MatchList status="upcoming" />}
      />
      <Tab.Screen 
        name="Live" 
        children={() => <MatchList status="live" />}
      />
      <Tab.Screen 
        name="Past" 
        children={() => <MatchList status="completed" />}
      />
    </Tab.Navigator>
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
  matchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 2,
  },
  roundName: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
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
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  matchFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  matchDetails: {
    flex: 1,
  },
  matchType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  groundName: {
    fontSize: 12,
    color: '#888',
  },
  matchTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  loadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 20,
  },
  resultContainer: {
    marginTop: 8,
  },
  matchResultText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default HomeScreen;
