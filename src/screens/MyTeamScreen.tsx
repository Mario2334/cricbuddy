import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TabView, type SceneRendererProps, type NavigationState } from 'react-native-tab-view';
import apiService from '../services/apiService';
import type { Match } from '../types/Match';
import type { MyTeamScreenNavigationProp } from '../types/navigation';
import { colors } from '../theme';
import { MAX_STAGGERED_ITEMS } from '../theme/motion';
import { relativeDayLabel } from '../utils/dates';
import { buildMatchDetailParams, getMatchStart, matchKey } from '../utils/matchDisplay';
import { rememberMatch } from '../utils/matchRegistry';
import { useNow } from '../hooks/useNow';
import { useTabBarSpace } from '../navigation/useTabBarSpace';
import MatchCalendar from '../components/MatchCalendar';
import { MatchCard } from '../components/match/MatchCard';
import { EmptyState } from '../ui/EmptyState';
import { MatchCardSkeleton } from '../ui/Skeleton';
import { MeshBackground } from '../ui/MeshBackground';
import { ScreenHeader } from '../ui/ScreenHeader';
import { SpinningBall } from '../ui/CricketBall';
import { TabViewSegmentedBar } from '../ui/adapters/TabViewSegmentedBar';

type TeamRoute = { key: 'matches' | 'calendar'; title: string };

const TEAM_ROUTES: TeamRoute[] = [
  { key: 'matches', title: 'Matches' },
  { key: 'calendar', title: 'Calendar' },
];

const PAGE_SIZE = 12;
// Coming back within this window keeps the list as it is (no refetch, no jump).
const FOCUS_REFRESH_MS = 30_000;

const MyTeamScreen: React.FC<MyTeamScreenNavigationProp> = ({ navigation }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const layout = useWindowDimensions();
  const now = useNow(60_000);
  const tabBarSpace = useTabBarSpace();
  const animated = useRef(new Set<string>());
  const lastLoaded = useRef(0);
  const pageRef = useRef(1);
  const hasDataRef = useRef(false);

  const teamId = '5179117'; // Default team ID from the API URL

  /** `background`: a focus refresh. It keeps what's on screen and never pops an alert. */
  const fetchTeamMatches = useCallback(
    async (page: number = 1, isRefresh: boolean = false, background = false) => {
      try {
        if (page === 1) {
          if (!background || !hasDataRef.current) setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        const response = await apiService.getTeamMatches(teamId, page, PAGE_SIZE);
        const newMatches = response.data || [];

        if (isRefresh || page === 1) {
          // Unchanged matches come back as the same objects, so this is a no-op re-render-wise.
          setMatches(prev => (prev.length === newMatches.length && prev.every((m, i) => m === newMatches[i]) ? prev : newMatches));
        } else {
          setMatches(prev => {
            const seen = new Set(prev.map(m => m.match_id));
            const fresh = newMatches.filter(m => !seen.has(m.match_id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        }

        hasDataRef.current = hasDataRef.current || newMatches.length > 0;
        lastLoaded.current = Date.now();
        pageRef.current = page;
        setHasNextPage(newMatches.length === PAGE_SIZE);
        setPageNo(page);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        if (!background || !hasDataRef.current) setError(errorMessage);
        if (!background) Alert.alert('Error', errorMessage);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [teamId],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeamMatches(1, true);
  }, [fetchTeamMatches]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasNextPage) {
      fetchTeamMatches(pageNo + 1);
    }
  }, [loadingMore, hasNextPage, pageNo, fetchTeamMatches]);

  const handleMatchPress = useCallback(
    (item: Match) => {
      const params = buildMatchDetailParams(item);
      if (!params) return;
      rememberMatch(item);
      navigation.navigate('MatchDetail', params);
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      // Refetch only when stale, and never over a list the user has paged into.
      if (Date.now() - lastLoaded.current < FOCUS_REFRESH_MS || pageRef.current > 1) return;
      fetchTeamMatches(1, true, true);
    }, [fetchTeamMatches]),
  );

  const nextMatch = useMemo(() => {
    const t = now.getTime();
    return matches
      .map(m => getMatchStart(m))
      .filter((d): d is Date => !!d && d.getTime() > t)
      .sort((a, b) => a.getTime() - b.getTime())[0];
  }, [matches, now]);

  const subtitle = loading && matches.length === 0
    ? 'Warming up…'
    : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}${nextMatch ? ` · next ${relativeDayLabel(nextMatch, now).toLowerCase()}` : ''}`;

  const renderMatch = useCallback(
    ({ item, index }: { item: Match; index: number }) => {
      const key = matchKey(item, index);
      const animateIn = index < MAX_STAGGERED_ITEMS && !animated.current.has(key);
      if (animateIn) animated.current.add(key);
      return <MatchCard match={item} now={now} onPress={handleMatchPress} index={index} animateIn={animateIn} />;
    },
    [now, handleMatchPress],
  );

  const renderMatchesTab = () => {
    if (loading && matches.length === 0) {
      return (
        <View style={styles.list}>
          <MatchCardSkeleton />
          <MatchCardSkeleton />
          <MatchCardSkeleton />
        </View>
      );
    }
    return (
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={matchKey}
        extraData={now}
        removeClippedSubviews={false}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primaryStrong]} tintColor={colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <SpinningBall size={26} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <EmptyState
              icon="oops"
              title="Dropped catch!"
              message="Failed to load team matches."
              tone="error"
              actionLabel="Retry"
              onAction={() => fetchTeamMatches(1, true)}
            />
          ) : (
            <EmptyState icon="team" tone="teal" title="No team matches yet" message="Once your team plays, the fixtures land here." />
          )
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderScene = ({ route }: { route: TeamRoute }) => {
    switch (route.key) {
      case 'matches':
        return renderMatchesTab();
      case 'calendar':
        return (
          <MatchCalendar
            matches={matches}
            loading={loading}
            onMatchPress={handleMatchPress}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            showWeekStrip={false}
            bottomSpace={tabBarSpace}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MeshBackground>
      <ScreenHeader title="My Team" icon="team" iconTone="teal" subtitle={subtitle} />
      <TabView
        navigationState={{ index: tabIndex, routes: TEAM_ROUTES }}
        renderScene={renderScene}
        onIndexChange={setTabIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={renderTeamTabBar}
        // The calendar (month grid + agenda) mounts only once it's opened.
        lazy
        swipeEnabled={false}
        animationEnabled
        style={styles.flex}
      />
    </MeshBackground>
  );
};

const renderTeamTabBar = (props: SceneRendererProps & { navigationState: NavigationState<TeamRoute> }) => (
  <TabViewSegmentedBar {...props} icons={{ matches: 'bat', calendar: 'calendar' }} />
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 6 },
  footer: { paddingVertical: 20, alignItems: 'center' },
});

export default MyTeamScreen;
