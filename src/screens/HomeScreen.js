import React, { useState, useEffect, useCallback } from 'react';
import {
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
  Card,
  Badge,
  Heading,
  Spinner,
  Center,
  Divider,
  LinearGradient,
} from '@gluestack-ui/themed';
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
    <Pressable 
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
      $pressed={{
        opacity: 0.8,
        scale: 0.98,
      }}
    >
      <Card
        size="md"
        variant="elevated"
        m="$1"
        mx="$2"
        mb="$3"
        bg="$white"
        borderRadius="$xl"
        shadowColor="$blue600"
        shadowOffset={{ width: 0, height: 4 }}
        shadowOpacity={0.15}
        shadowRadius={8}
        elevation={6}
        borderLeftWidth={4}
        borderLeftColor={getMatchStatusColor(item.status)}
      >
        <VStack space="sm" p="$4">
          {/* Header */}
          <HStack justifyContent="space-between" alignItems="flex-start">
            <VStack flex={1} space="xs" mr="$3">
              <Heading 
                size="sm" 
                color="$blue600" 
                fontWeight="$semibold"
                numberOfLines={1}
              >
                {item.tournament_name && item.tournament_name.trim() !== '' 
                  ? item.tournament_name 
                  : 'Practice Match'
                }
              </Heading>
              <Text 
                size="xs" 
                color="$coolGray500"
                fontWeight="$medium"
              >
                {item.tournament_round_name}
              </Text>
            </VStack>
            <Badge
              size="sm"
              variant="solid"
              bg={getMatchStatusColor(item.status)}
              borderRadius="$full"
              px="$3"
              py="$1"
            >
              <Text 
                color="$white" 
                size="xs" 
                fontWeight="$bold"
                textTransform="uppercase"
              >
                {item.status}
              </Text>
            </Badge>
          </HStack>

          <Divider my="$2" />

          {/* Teams */}
          <VStack space="sm">
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flex={1} alignItems="center">
                <Text 
                  size="md" 
                  fontWeight="$bold" 
                  color="$coolGray800"
                  textAlign="center"
                  numberOfLines={1}
                >
                  {item.team_a}
                </Text>
              </VStack>
              
              <Badge
                variant="outline"
                borderColor="$coolGray300"
                bg="$coolGray50"
                borderRadius="$md"
                mx="$4"
                px="$2"
                py="$1"
              >
                <Text 
                  size="xs" 
                  fontWeight="$semibold" 
                  color="$coolGray600"
                >
                  VS
                </Text>
              </Badge>
              
              <VStack flex={1} alignItems="center">
                <Text 
                  size="md" 
                  fontWeight="$bold" 
                  color="$coolGray800"
                  textAlign="center"
                  numberOfLines={1}
                >
                  {item.team_b}
                </Text>
              </VStack>
            </HStack>
            
            {/* Show match result for past matches */}
            {item.status === 'past' && item.match_summary?.summary && (
              <Box
                bg="$green50"
                borderRadius="$md"
                p="$3"
                mt="$2"
                borderLeftWidth={3}
                borderLeftColor="$green500"
              >
                <HStack alignItems="center" space="xs">
                  <Text size="sm" color="$green700">🏆</Text>
                  <Text 
                    size="sm" 
                    color="$green700"
                    fontWeight="$medium"
                    flex={1}
                    numberOfLines={2}
                  >
                    {item.match_summary.summary}
                  </Text>
                </HStack>
              </Box>
            )}
          </VStack>

          <Divider my="$2" />

          {/* Footer */}
          <HStack justifyContent="space-between" alignItems="flex-end">
            <VStack flex={1} space="xs">
              <Text 
                size="xs" 
                color="$coolGray600"
                fontWeight="$medium"
              >
                {item.match_type} • {item.overs} Overs
              </Text>
              <Text 
                size="xs" 
                color="$coolGray500"
                numberOfLines={1}
              >
                📍 {item.ground_name}
              </Text>
            </VStack>
            <Box
              bg="$blue50"
              borderRadius="$md"
              px="$2"
              py="$1"
            >
              <Text 
                size="xs" 
                color="$blue700"
                fontWeight="$semibold"
              >
                {formatMatchTime(item.match_start_time)}
              </Text>
            </Box>
          </HStack>
        </VStack>
      </Card>
    </Pressable>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <Center py="$4">
        <HStack space="sm" alignItems="center">
          <Spinner size="small" color="$blue600" />
          <Text size="sm" color="$coolGray600">Loading more matches...</Text>
        </HStack>
      </Center>
    );
  };

  const renderEmpty = (isLoading, error, tabType) => {
    if (isLoading) {
      return (
        <Center flex={1} py="$20">
          <VStack space="md" alignItems="center">
            <Spinner size="large" color="$blue600" />
            <Text size="md" color="$coolGray600">Loading {tabType} matches...</Text>
          </VStack>
        </Center>
      );
    }

    if (error) {
      return (
        <Center flex={1} py="$20">
          <VStack space="md" alignItems="center" mx="$4">
            <Box
              w="$16"
              h="$16"
              bg="$red50"
              borderRadius="$full"
              justifyContent="center"
              alignItems="center"
            >
              <Text size="xl" color="$red500">⚠️</Text>
            </Box>
            <Heading size="sm" color="$red600" textAlign="center">
              Failed to load matches
            </Heading>
            <Text size="sm" color="$coolGray600" textAlign="center">
              {error}
            </Text>
            <Pressable
              mt="$2"
              bg="$blue600"
              borderRadius="$md"
              px="$4"
              py="$2"
              onPress={() => tabType === 'Past' ? loadPastMatches(null, true) : loadMatches(null, true)}
              $pressed={{
                bg: "$blue700",
              }}
            >
              <Text color="$white" fontWeight="$semibold" size="sm">
                Try Again
              </Text>
            </Pressable>
          </VStack>
        </Center>
      );
    }

    return (
      <Center flex={1} py="$20">
        <VStack space="md" alignItems="center" mx="$4">
          <Box
            w="$20"
            h="$20"
            bg="$coolGray50"
            borderRadius="$full"
            justifyContent="center"
            alignItems="center"
          >
            <Text size="2xl" color="$coolGray400">🏏</Text>
          </Box>
          <Heading size="sm" color="$coolGray600" textAlign="center">
            No {tabType} matches found
          </Heading>
          <Text size="sm" color="$coolGray500" textAlign="center">
            Check back later for new matches
          </Text>
        </VStack>
      </Center>
    );
  };

  // Component for each tab content
  const MatchList = ({ status }) => {
    const filteredMatches = status === 'completed' ? pastMatches : allMatches.filter(match => match.status === status);

    // No useFocusEffect - use shared data from parent component
    
    if (status === 'completed' ? pastLoading : loading && !hasInitiallyLoaded) {
      return renderEmpty(true, null, status === 'completed' ? 'Past' : status.charAt(0).toUpperCase() + status.slice(1));
    }

    if ((status === 'completed' ? pastError : error) && !hasInitiallyLoaded) {
      return renderEmpty(false, status === 'completed' ? pastError : error, status === 'completed' ? 'Past' : status.charAt(0).toUpperCase() + status.slice(1));
    }

    return (
      <FlatList
        data={filteredMatches}
        renderItem={renderMatchItem}
        keyExtractor={(item) => item.match_id.toString()}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
        }}
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
        ListEmptyComponent={() => renderEmpty(false, null, status === 'completed' ? 'Past' : status.charAt(0).toUpperCase() + status.slice(1))}
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

export default HomeScreen;
