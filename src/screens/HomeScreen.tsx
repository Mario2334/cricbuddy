import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import type { Match } from '../types/Match';
import type { HomeScreenNavigationProp, TabParamList } from '../types/navigation';
import { PROFILE } from '../config/profile';
import { colors, glass, palette, radii } from '../theme';
import { MAX_STAGGERED_ITEMS } from '../theme/motion';
import { formatShortDate, isSameLocalDay, relativeDayLabel, toDateKey } from '../utils/dates';
import { buildMarkedDates, buildMatchDetailParams, getMatchStart, matchKey, sortByStart } from '../utils/matchDisplay';
import { rememberMatch } from '../utils/matchRegistry';
import { useNow } from '../hooks/useNow';
import { useHomeMatches, type HomeSegment } from '../hooks/useHomeMatches';
import { useTabBarSpace } from '../navigation/useTabBarSpace';
import { MatchCard } from '../components/match/MatchCard';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';
import { Chip } from '../ui/Chip';
import { EmptyState } from '../ui/EmptyState';
import { GlassView } from '../ui/GlassView';
import { GradientText } from '../ui/GradientText';
import { IconTile } from '../ui/IconTile';
import { MeshBackground } from '../ui/MeshBackground';
import { MatchCardSkeleton } from '../ui/Skeleton';
import { PullBall } from '../ui/PullBall';
import { SegmentedTabs, type Segment } from '../ui/SegmentedTabs';
import { SpinningBall } from '../ui/CricketBall';
import { TodayHero } from '../ui/TodayHero';
import { WeekStrip } from '../ui/WeekStrip';
import { EMPTY_COPY, ERROR_COPY, REST_DAY_COPY } from './home/copy';

type Row =
  | { type: 'tabs' }
  | { type: 'match'; match: Match }
  | { type: 'skeleton'; id: number }
  | { type: 'empty' }
  | { type: 'error'; message: string };

const SEGMENTS: HomeSegment[] = ['upcoming', 'live', 'past'];

const keyExtractor = (item: Row, index: number) =>
  item.type === 'match' ? matchKey(item.match, index) : item.type === 'skeleton' ? `sk-${item.id}` : item.type;

const HomeScreen: React.FC<HomeScreenNavigationProp> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  // Pauses by itself while Home isn't on show.
  const now = useNow(60_000);
  const tabBarSpace = useTabBarSpace();
  const { segments, refreshAll, loadMore, allMatches, liveMatch, nextMatch, userRefreshing, initialLoading } = useHomeMatches();

  const [segIndex, setSegIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Keys that already played their entrance, so cards only stagger in once.
  const animated = useRef(new Set<string>());

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => {
      scrollY.value = e.contentOffset.y;
    },
  });

  useFocusEffect(
    useCallback(() => {
      // Reload on focus so newly scheduled local matches show up.
      refreshAll(false);
    }, [refreshAll]),
  );

  const segment = SEGMENTS[segIndex];
  const seg = segments[segment];
  const markedDates = useMemo(() => buildMarkedDates(allMatches), [allMatches]);
  const next = useMemo(() => nextMatch(now), [nextMatch, now]);

  const openMatch = useCallback(
    (m: Match) => {
      const params = buildMatchDetailParams(m);
      if (!params) return;
      rememberMatch(m);
      navigation.navigate('MatchDetail', params);
    },
    [navigation],
  );

  const openAdd = useCallback(
    (day?: Date | null) => {
      navigation
        .getParent<BottomTabNavigationProp<TabParamList>>()
        ?.navigate('Calendar', { screen: 'CalendarList', params: { openAddFor: toDateKey(day ?? new Date()) } });
    },
    [navigation],
  );

  const changeSegment = useCallback((i: number) => {
    animated.current.clear();
    setSegIndex(i);
  }, []);

  const selectDate = useCallback((d: Date | null) => {
    animated.current.clear();
    setSelectedDate(d);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ type: 'tabs' }];
    if (selectedDate) {
      const list = sortByStart(
        allMatches.filter(m => {
          const s = getMatchStart(m);
          return !!s && isSameLocalDay(s, selectedDate);
        }),
        'asc',
      );
      if (list.length === 0) out.push({ type: 'empty' });
      else list.forEach(match => out.push({ type: 'match', match }));
      return out;
    }
    if (seg.matches.length === 0) {
      if (!seg.loaded || seg.loading) [0, 1, 2].forEach(id => out.push({ type: 'skeleton', id }));
      else if (seg.error) out.push({ type: 'error', message: seg.error });
      else out.push({ type: 'empty' });
      return out;
    }
    seg.matches.forEach(match => out.push({ type: 'match', match }));
    return out;
  }, [selectedDate, allMatches, seg]);

  const tabSegments = useMemo<Segment[]>(
    () => [
      { key: 'upcoming', label: 'Upcoming', badge: segments.upcoming.matches.length },
      { key: 'live', label: 'Live', badge: segments.live.matches.length > 0 ? 'dot' : undefined },
      { key: 'past', label: 'Done' },
    ],
    [segments.upcoming.matches.length, segments.live.matches.length],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      switch (item.type) {
        case 'tabs':
          return (
            <View style={styles.sticky}>
              {selectedDate ? (
                <GlassView mode="frost" radius={radii.pill} shadow="soft" style={styles.dayBanner}>
                  <IconTile icon="calendar" size="xs" tone="emerald" />
                  <AppText variant="title" numberOfLines={1} style={styles.flex}>
                    {formatShortDate(selectedDate, now)}
                    <AppText variant="smallStrong" color={colors.textMuted}>
                      {'  ·  '}
                      {relativeDayLabel(selectedDate, now)}
                    </AppText>
                  </AppText>
                  <Chip label="Clear" icon="close" size="sm" tone="neutral" onPress={() => selectDate(null)} />
                </GlassView>
              ) : (
                <SegmentedTabs segments={tabSegments} index={segIndex} onChange={changeSegment} />
              )}
            </View>
          );
        case 'match': {
          const key = matchKey(item.match, index);
          const position = index - 1;
          const animateIn = position < MAX_STAGGERED_ITEMS && !animated.current.has(key);
          if (animateIn) animated.current.add(key);
          return (
            <View style={styles.pad}>
              <MatchCard match={item.match} now={now} onPress={openMatch} index={position} animateIn={animateIn} />
            </View>
          );
        }
        case 'skeleton':
          return (
            <View style={styles.pad}>
              <MatchCardSkeleton />
            </View>
          );
        case 'error':
          return (
            <EmptyState
              icon={ERROR_COPY.icon}
              title={ERROR_COPY.title}
              message={`${item.message}. Check your connection and have another go.`}
              tone="error"
              actionLabel="Try again"
              onAction={() => refreshAll(true)}
            />
          );
        case 'empty':
          if (selectedDate) {
            return (
              <EmptyState
                icon={REST_DAY_COPY.icon}
                tone={REST_DAY_COPY.tone}
                title={REST_DAY_COPY.title}
                message={`No matches on ${formatShortDate(selectedDate, now)}. Fancy a game?`}
                actionLabel="Add a match"
                onAction={() => openAdd(selectedDate)}
              />
            );
          }
          return (
            <EmptyState
              icon={EMPTY_COPY[segment].icon}
              tone={EMPTY_COPY[segment].tone}
              title={EMPTY_COPY[segment].title}
              message={EMPTY_COPY[segment].message}
              actionLabel={segment === 'upcoming' ? 'Add a match' : undefined}
              onAction={segment === 'upcoming' ? () => openAdd() : undefined}
            />
          );
      }
    },
    [selectedDate, now, tabSegments, segIndex, changeSegment, selectDate, openMatch, refreshAll, openAdd, segment],
  );

  const openAddToday = useCallback(() => openAdd(), [openAdd]);
  const onEndReached = useCallback(() => {
    if (!selectedDate) loadMore(segment);
  }, [selectedDate, loadMore, segment]);
  const onRefresh = useCallback(() => refreshAll(true), [refreshAll]);

  // Memoized: the hero, week strip and their glass only re-render when their inputs change.
  const header = useMemo(() => (
    <View>
      <PullBall scrollY={scrollY} refreshing={userRefreshing} />
      <View style={[styles.pad, styles.brandRow]}>
        <View style={styles.brandLeft}>
          <IconTile icon="bat" tone="emerald" size="sm" />
          <GradientText variant="h1" style={styles.brand} accessibilityRole="header">
            CricBuddy
          </GradientText>
        </View>
        <Avatar name={PROFILE.firstName} size={38} ring={palette.green500} />
      </View>
      <View style={styles.pad}>
        <TodayHero
          now={now}
          firstName={PROFILE.firstName}
          liveMatch={liveMatch}
          nextMatch={next}
          loading={initialLoading}
          onPressMatch={openMatch}
          onPressAdd={openAddToday}
          scrollY={scrollY}
        />
      </View>
      <View style={[styles.pad, styles.weekWrap]}>
        <GlassView mode="frost" radius={radii.lg} fill={glass.fill} style={styles.weekCard}>
          <WeekStrip selectedDate={selectedDate} onSelectDate={selectDate} now={now} markedDates={markedDates} />
        </GlassView>
      </View>
    </View>
  ), [scrollY, userRefreshing, now, liveMatch, next, initialLoading, openMatch, openAddToday, selectedDate, selectDate, markedDates]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={userRefreshing}
        onRefresh={onRefresh}
        tintColor={Platform.OS === 'ios' ? 'transparent' : colors.primary}
        colors={[colors.primaryStrong]}
        progressBackgroundColor={palette.white}
      />
    ),
    [userRefreshing, onRefresh],
  );

  return (
    <MeshBackground style={{ paddingTop: insets.top }}>
      <Animated.FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={now}
        ListHeaderComponent={header}
        stickyHeaderIndices={[1]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        // Match cards are heavy: mount a screenful and a bit, not the whole first page.
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          seg.loadingMore && !selectedDate ? (
            <View style={styles.footer}>
              <SpinningBall size={26} />
            </View>
          ) : null
        }
        refreshControl={refreshControl}
      />
    </MeshBackground>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 16 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 14,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontSize: 26, lineHeight: 32, letterSpacing: -0.8 },
  weekWrap: { marginTop: 14 },
  weekCard: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 6 },
  // Sticky: near-opaque mint frost so cards scrolling beneath stay legible.
  sticky: {
    backgroundColor: 'rgba(238,248,243,0.94)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  dayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingLeft: 12,
    paddingRight: 8,
  },
  footer: { paddingVertical: 20, alignItems: 'center' },
});

export default HomeScreen;
