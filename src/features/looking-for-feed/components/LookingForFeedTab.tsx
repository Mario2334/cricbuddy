import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MeshBackground } from '../../../ui/MeshBackground';
import { useScreenActivity } from '../../../hooks/useScreenActivity';
import { ScreenHeader } from '../../../ui/ScreenHeader';

// Import components
import SearchInterface from './SearchInterface';
import PostListComponent from './PostListComponent';
import PostDetailComponent from './PostDetailComponent';
import ErrorBoundary from './ErrorBoundary';

// Import services and types
import FeedManager, { FeedState, FeedManagerEvents } from '../services/feedManager';
import { RecruitmentPost, AIQuery, BallType } from '../types';
import { TabParamList } from '../../../types/navigation';
import { errorHandler, LookingForFeedError, ErrorType } from '../utils/errorHandler';
import { 
  handleTap, 
  handleSearch, 
  handleRefresh, 
  InteractionType,
  FeedbackType 
} from '../utils/interactionHandler';

type LookingForFeedTabProps = BottomTabScreenProps<TabParamList, 'LookingForFeed'>;

const LookingForFeedTab: React.FC<LookingForFeedTabProps> = ({ navigation }) => {
  // State management
  const [feedState, setFeedState] = useState<FeedState>({
    posts: [],
    filteredPosts: [],
    isLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
    error: null,
    currentQuery: '',
    currentFilters: {},
    aiQuery: null,
    hasMore: true,
    currentPage: 0,
    totalCount: 0,
    lastFetchTime: null,
    isAIProcessing: false,
    filterStats: null,
  });

  const [selectedPost, setSelectedPost] = useState<RecruitmentPost | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [lastError, setLastError] = useState<LookingForFeedError | null>(null);
  const [selectedBallType, setSelectedBallType] = useState<BallType | null>(null);

  // Refs
  const feedManagerRef = useRef<FeedManager | null>(null);
  const isInitializedRef = useRef(false);
  const retryCountRef = useRef(0);

  // Error handling
  const handleFeedError = useCallback((error: Error | LookingForFeedError, context?: string) => {
    console.error(`[LookingForFeedTab] Error in ${context}:`, error);
    
    const handledError = errorHandler.handleError(error, {
      component: 'LookingForFeedTab',
      action: context,
      timestamp: new Date(),
    });

    setLastError(handledError);

    // Show user-friendly error message for critical errors
    if (handledError.severity === 'CRITICAL' || handledError.severity === 'HIGH') {
      Alert.alert(
        'Error',
        handledError.userMessage,
        [
          {
            text: 'OK',
            style: 'default',
          },
          ...(handledError.canRetry() ? [{
            text: 'Retry',
            style: 'default' as const,
            onPress: () => handleRetry(handledError),
          }] : []),
        ]
      );
    }
  }, []);

  // Retry mechanism
  const handleRetry = useCallback(async (error?: LookingForFeedError) => {
    console.log('[LookingForFeedTab] Retrying after error');
    
    try {
      retryCountRef.current++;
      setLastError(null);

      if (feedManagerRef.current) {
        // Determine what to retry based on error type
        if (error?.type === ErrorType.AI_ERROR) {
          // Retry AI processing
          if (feedState.currentQuery) {
            await feedManagerRef.current.processQuery(feedState.currentQuery);
          }
        } else {
          // Retry data fetching
          await feedManagerRef.current.refresh();
        }
      } else {
        // Reinitialize if feed manager is null
        await initializeFeedManager();
      }
      
      retryCountRef.current = 0; // Reset on success
    } catch (retryError) {
      console.error('[LookingForFeedTab] Retry failed:', retryError);
      handleFeedError(retryError instanceof Error ? retryError : new Error(String(retryError)), 'retry');
    }
  }, [feedState.currentQuery]);

  // Initialize feed manager with error handling
  const initializeFeedManager = useCallback(async () => {
    try {
      console.log('[LookingForFeedTab] Initializing feed manager');
      
      const events: FeedManagerEvents = {
        onStateChange: (state: FeedState) => {
          setFeedState(state);
        },
        onError: (error: string) => {
          handleFeedError(new Error(error), 'feedManager');
        },
        onPostsLoaded: (posts: RecruitmentPost[]) => {
          console.log(`[LookingForFeedTab] Loaded ${posts.length} posts`);
        },
        onFiltersApplied: (result) => {
          console.log(`[LookingForFeedTab] Filters applied: ${result.totalMatches} matches`);
        },
      };

      feedManagerRef.current = new FeedManager(
        {
          debounceDelay: 300,
          pageSize: 20,
          enableAI: true,
          enableCaching: true,
        },
        undefined,
        events
      );

      await feedManagerRef.current.initialize();
      setLastError(null); // Clear any previous errors on successful init
    } catch (error) {
      console.error('[LookingForFeedTab] Failed to initialize feed manager:', error);
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'initialization');
    }
  }, [handleFeedError]);

  // Background refreshes only while the Find tab is on show (and the app is in front).
  useScreenActivity(active => {
    if (active) feedManagerRef.current?.resume();
    else feedManagerRef.current?.pause();
  });

  // Initialize feed manager
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    initializeFeedManager();
    isInitializedRef.current = true;

    // Cleanup on unmount
    return () => {
      if (feedManagerRef.current) {
        feedManagerRef.current.destroy();
        feedManagerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [initializeFeedManager]);

  // Handle tab focus - refresh data when tab becomes active
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[LookingForFeedTab] Tab focused, checking for refresh');
      
      try {
        if (feedManagerRef.current && feedManagerRef.current.hasData()) {
          // Only refresh if we haven't fetched data recently
          const state = feedManagerRef.current.getState();
          if (state.lastFetchTime) {
            const timeSinceLastFetch = Date.now() - state.lastFetchTime.getTime();
            const shouldRefresh = timeSinceLastFetch > 5 * 60 * 1000; // 5 minutes
            
            if (shouldRefresh) {
              feedManagerRef.current.refresh().catch(error => {
                handleFeedError(error, 'tabFocusRefresh');
              });
            }
          }
        } else if (feedManagerRef.current && !feedManagerRef.current.isLoading()) {
          // Initialize if not already done
          feedManagerRef.current.initialize().catch(error => {
            handleFeedError(error, 'tabFocusInitialize');
          });
        } else if (!feedManagerRef.current) {
          // Reinitialize if feed manager is null
          initializeFeedManager();
        }
      } catch (error) {
        handleFeedError(error instanceof Error ? error : new Error(String(error)), 'tabFocus');
      }
    });

    return unsubscribe;
  }, [navigation, handleFeedError, initializeFeedManager]);

  // Search handlers with interaction feedback
  const handleQuerySubmit = useCallback(async (query: AIQuery) => {
    console.log('[LookingForFeedTab] Processing query:', query.rawQuery);
    
    await handleSearch(
      {
        component: 'LookingForFeedTab',
        action: 'querySubmit',
        timestamp: new Date(),
        additionalData: { query: query.rawQuery, confidence: query.confidence },
      },
      async () => {
        if (feedManagerRef.current) {
          await feedManagerRef.current.processQuery(query.rawQuery);
        }
      },
      {
        hapticFeedback: FeedbackType.LIGHT,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'querySubmit');
    });
  }, [handleFeedError]);

  const handleQueryClear = useCallback(() => {
    console.log('[LookingForFeedTab] Clearing query');
    
    handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'queryClear',
        timestamp: new Date(),
      },
      () => {
        if (feedManagerRef.current) {
          feedManagerRef.current.clearFilters();
        }
        setSelectedBallType(null); // Clear ball type filter too
      },
      {
        hapticFeedback: FeedbackType.LIGHT,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'queryClear');
    });
  }, [handleFeedError]);

  const handleBallTypeFilter = useCallback((ballType: BallType | null) => {
    console.log('[LookingForFeedTab] Ball type filter changed:', ballType);
    
    handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'ballTypeFilter',
        timestamp: new Date(),
        additionalData: { ballType },
      },
      () => {
        setSelectedBallType(ballType);
        // Apply filter to feed manager if available
        if (feedManagerRef.current) {
          // For now, we'll handle this in the UI by filtering the displayed posts
          // In a full implementation, you'd want to pass this to the feed manager
        }
      },
      {
        hapticFeedback: FeedbackType.LIGHT,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'ballTypeFilter');
    });
  }, [handleFeedError]);

  // Post list handlers with interaction feedback
  const handleRefreshWithFeedback = useCallback(async () => {
    console.log('[LookingForFeedTab] Refreshing posts');
    
    await handleRefresh(
      {
        component: 'LookingForFeedTab',
        action: 'refresh',
        timestamp: new Date(),
      },
      async () => {
        if (feedManagerRef.current) {
          await feedManagerRef.current.refresh();
        }
      },
      {
        hapticFeedback: FeedbackType.MEDIUM,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'refresh');
    });
  }, [handleFeedError]);

  const handleLoadMoreWithFeedback = useCallback(async () => {
    console.log('[LookingForFeedTab] Loading more posts');
    
    await handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'loadMore',
        timestamp: new Date(),
        additionalData: { currentPage: feedState.currentPage, totalPosts: feedState.posts.length },
      },
      async () => {
        if (feedManagerRef.current) {
          await feedManagerRef.current.loadMore();
        }
      },
      {
        // Reaching the end of the list isn't a tap: no haptic.
        hapticFeedback: FeedbackType.NONE,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'loadMore');
    });
  }, [handleFeedError, feedState.currentPage, feedState.posts.length]);

  const handlePostPressWithFeedback = useCallback((post: RecruitmentPost) => {
    console.log('[LookingForFeedTab] Post pressed:', post.id);
    
    handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'postPress',
        itemId: post.id,
        timestamp: new Date(),
        additionalData: { 
          postType: post.requirements.teamType,
          skillLevel: post.requirements.skillLevel,
          positions: post.requirements.positionsNeeded,
        },
      },
      () => {
        setSelectedPost(post);
        setShowPostDetail(true);
      },
      {
        hapticFeedback: FeedbackType.LIGHT,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'postPress');
    });
  }, [handleFeedError]);

  // Post detail handlers with interaction feedback
  const handlePostDetailCloseWithFeedback = useCallback(() => {
    console.log('[LookingForFeedTab] Closing post detail');
    
    handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'postDetailClose',
        itemId: selectedPost?.id,
        timestamp: new Date(),
      },
      () => {
        setShowPostDetail(false);
        setSelectedPost(null);
      },
      {
        hapticFeedback: FeedbackType.LIGHT,
        trackAnalytics: true,
      }
    ).catch(error => {
      handleFeedError(error instanceof Error ? error : new Error(String(error)), 'postDetailClose');
    });
  }, [handleFeedError, selectedPost?.id]);

  const handleContactPressWithFeedback = useCallback((contactInfo: RecruitmentPost['user']['contactDetails']) => {
    console.log('[LookingForFeedTab] Contact pressed:', contactInfo);
    
    // Track contact interaction
    handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'contactPress',
        itemId: selectedPost?.id,
        timestamp: new Date(),
        additionalData: {
          contactMethods: Object.keys(contactInfo).filter(key => contactInfo[key as keyof typeof contactInfo]),
          userName: selectedPost?.user.name,
        },
      },
      () => {
        // Contact handling is managed by PostDetailComponent
        // This is just for tracking and feedback
      },
      {
        hapticFeedback: FeedbackType.LIGHT,
        trackAnalytics: true,
      }
    ).catch(error => {
      console.warn('[LookingForFeedTab] Contact interaction tracking failed:', error);
    });
  }, [selectedPost]);

  // Error boundary handlers
  const handleErrorBoundaryError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('[LookingForFeedTab] Error boundary caught error:', error, errorInfo);
    
    handleFeedError(error, 'errorBoundary');
  }, [handleFeedError]);

  const handleErrorBoundaryRetry = useCallback(() => {
    console.log('[LookingForFeedTab] Error boundary retry');
    
    handleTap(
      {
        component: 'LookingForFeedTab',
        action: 'errorBoundaryRetry',
        timestamp: new Date(),
        additionalData: { errorType: lastError?.type, retryCount: retryCountRef.current },
      },
      () => {
        // Reset state and reinitialize
        setLastError(null);
        setSelectedPost(null);
        setShowPostDetail(false);
        
        // Reinitialize feed manager
        if (feedManagerRef.current) {
          feedManagerRef.current.destroy();
          feedManagerRef.current = null;
        }
        
        isInitializedRef.current = false;
        initializeFeedManager();
      },
      {
        hapticFeedback: FeedbackType.MEDIUM,
        trackAnalytics: true,
      }
    ).catch(error => {
      console.error('[LookingForFeedTab] Error boundary retry failed:', error);
    });
  }, [initializeFeedManager, lastError?.type]);

  // Render search interface
  const renderSearchInterface = () => (
    <SearchInterface
      onQuerySubmit={handleQuerySubmit}
      onQueryClear={handleQueryClear}
      loading={feedState.isAIProcessing}
      placeholder="Find cricket opportunities..."
      initialQuery={feedState.currentQuery}
      onBallTypeFilter={handleBallTypeFilter}
      selectedBallType={selectedBallType}
    />
  );

  // Filter posts by ball type if selected (memoized: a new array would re-render every card)
  const filteredPosts = useMemo(
    () =>
      selectedBallType
        ? feedState.filteredPosts.filter(post => post.matchDetails.ballType === selectedBallType)
        : feedState.filteredPosts,
    [feedState.filteredPosts, selectedBallType],
  );

  // Render post list
  const renderPostList = () => {
    return (
      <PostListComponent
        posts={filteredPosts}
        loading={feedState.isLoading}
        error={feedState.error}
        refreshing={feedState.isRefreshing}
        loadingMore={feedState.isLoadingMore}
        hasNextPage={feedState.hasMore}
        onRefresh={handleRefreshWithFeedback}
        onLoadMore={handleLoadMoreWithFeedback}
        onPostPress={handlePostPressWithFeedback}
        ListHeaderComponent={null}
        ListEmptyComponent={null}
      />
    );
  };

  // Render post detail modal
  const renderPostDetailModal = () => {
    if (!selectedPost) return null;

    return (
      <Modal
        visible={showPostDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePostDetailCloseWithFeedback}
      >
        <MeshBackground variant="calm" style={styles.modalContainer}>
          <PostDetailComponent
            post={selectedPost}
            onClose={handlePostDetailCloseWithFeedback}
            onContactPress={handleContactPressWithFeedback}
          />
        </MeshBackground>
      </Modal>
    );
  };

  return (
    <ErrorBoundary
      onError={handleErrorBoundaryError}
      onRetry={handleErrorBoundaryRetry}
    >
      <MeshBackground>
        <ScreenHeader title="Looking For" icon="find" subtitle="Players & teams wanted near you" />

        <View style={styles.content}>
          {/* Search Interface */}
          <ErrorBoundary
            onError={(error) => handleFeedError(error, 'searchInterface')}
            onRetry={() => {
              // Search interface retry - just clear any error state
              setLastError(null);
            }}
          >
            {renderSearchInterface()}
          </ErrorBoundary>
          
          {/* Post List */}
          <View style={styles.listContainer}>
            <ErrorBoundary
              onError={(error) => handleFeedError(error, 'postList')}
              onRetry={handleRefreshWithFeedback}
            >
              {renderPostList()}
            </ErrorBoundary>
          </View>
        </View>

        {/* Post Detail Modal */}
        <ErrorBoundary
          onError={(error) => handleFeedError(error, 'postDetail')}
          onRetry={handlePostDetailCloseWithFeedback}
        >
          {renderPostDetailModal()}
        </ErrorBoundary>
      </MeshBackground>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
});

export default LookingForFeedTab;