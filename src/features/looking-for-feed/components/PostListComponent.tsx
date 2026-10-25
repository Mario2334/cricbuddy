import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { RecruitmentPost } from '../types';
import { colors } from '../../../theme';
import { AppText } from '../../../ui/AppText';
import { EmptyState } from '../../../ui/EmptyState';
import { GlassModeProvider } from '../../../ui/GlassView';
import { PostCardSkeleton } from '../../../ui/Skeleton';
import { SpinningBall } from '../../../ui/CricketBall';
import { useTabBarSpace } from '../../../navigation/useTabBarSpace';
import { useNow } from '../../../hooks/useNow';
import { PostCard } from './PostCard';

interface PostListComponentProps {
  posts: RecruitmentPost[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onPostPress: (post: RecruitmentPost) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
}

const SKELETON_COUNT = 4;

const PostListComponent: React.FC<PostListComponentProps> = ({
  posts,
  loading,
  error,
  refreshing,
  loadingMore,
  hasNextPage,
  onRefresh,
  onLoadMore,
  onPostPress,
  ListHeaderComponent = null,
  ListEmptyComponent = null,
}) => {
  const bottomSpace = useTabBarSpace();
  // Keeps "Today" / "Tomorrow" on date badges correct (also rolls over at midnight).
  const now = useNow(10 * 60_000);

  const renderPost = useCallback(
    ({ item, index }: { item: RecruitmentPost; index: number }) => (
      <PostCard post={item} index={index} now={now} onPress={onPostPress} />
    ),
    [onPostPress, now],
  );

  const keyExtractor = useCallback((item: RecruitmentPost) => item.id, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !loadingMore && !loading) {
      onLoadMore();
    }
  }, [hasNextPage, loadingMore, loading, onLoadMore]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadingMoreContainer}>
        <SpinningBall size={22} />
        <AppText variant="smallStrong" color={colors.textMuted} style={styles.loadingMoreText}>
          Bowling you more posts...
        </AppText>
      </View>
    );
  }, [loadingMore]);

  const defaultEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon="search"
        title="No posts found"
        message="We're checking multiple cities for cricket opportunities. Pull to refresh or check back later."
        actionLabel="Refresh"
        onAction={onRefresh}
      />
    ),
    [onRefresh],
  );

  const contentStyle = useMemo(
    () => [styles.listContainer, { paddingBottom: bottomSpace }],
    [bottomSpace],
  );

  if (loading && posts.length === 0) {
    return (
      <View style={[styles.listContainer, styles.skeletons]} accessibilityLabel="Loading posts">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState
          icon="oops"
          tone="error"
          title="Something went wrong"
          message={error}
          actionLabel="Try again"
          onAction={onRefresh}
        />
      </View>
    );
  }

  // Frost everywhere in the list: cards fade in and scroll, where real blur is costly and glitchy.
  return (
    <GlassModeProvider value="frost">
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent || defaultEmptyComponent}
        ListFooterComponent={renderFooter}
        // Clipping would cut off the cards' entering animations.
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />
    </GlassModeProvider>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  skeletons: {
    flex: 1,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
});

export default PostListComponent;
