/**
 * Feed Manager for Looking For Feed
 * 
 * Central coordinator for data fetching, state management, and coordination
 * between API clients, AI recommender, cache service, and query processor.
 * Implements debouncing for API requests and app lifecycle handling.
 */

import { RecruitmentPost, AIQuery, PostFilters } from '../types';
import { CricHeroesApiClient, CricHeroesRecruitmentResponse } from './cricHeroesApiClient';
import { AIRecommender, FilterApplicationResult } from './aiRecommender';
import { CacheService, defaultCacheService } from './cacheService';
import { QueryProcessor } from '../utils/queryProcessor';
import { AppState, AppStateStatus } from 'react-native';

export interface FeedState {
  posts: RecruitmentPost[];
  filteredPosts: RecruitmentPost[];
  isLoading: boolean;
  /** A "load more" page is on its way (drives the list footer and blocks repeats). */
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  currentQuery: string;
  currentFilters: PostFilters;
  aiQuery: AIQuery | null;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
  lastFetchTime: Date | null;
  isAIProcessing: boolean;
  filterStats: FilterApplicationResult | null;
}

export interface FeedManagerConfig {
  debounceDelay: number; // Milliseconds to debounce API requests
  pageSize: number; // Number of posts per page
  maxRetries: number; // Maximum retry attempts for failed requests
  cacheTimeout: number; // Cache timeout in milliseconds
  backgroundRefreshInterval: number; // Background refresh interval in milliseconds
  enableAI: boolean; // Enable AI-powered filtering
  enableCaching: boolean; // Enable caching
}

export interface FeedManagerEvents {
  onStateChange: (state: FeedState) => void;
  onError: (error: string) => void;
  onPostsLoaded: (posts: RecruitmentPost[]) => void;
  onFiltersApplied: (result: FilterApplicationResult) => void;
}

export class FeedManager {
  private readonly config: FeedManagerConfig;
  private readonly cricHeroesClient: CricHeroesApiClient;
  private readonly aiRecommender: AIRecommender;
  private readonly cacheService: CacheService;
  private readonly queryProcessor: QueryProcessor;
  private readonly events: Partial<FeedManagerEvents>;

  private state: FeedState;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private backgroundRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  /** The Find tab isn't on show: no background refreshes until it is again. */
  private paused = false;
  private appStateSubscription: any = null;
  private isDestroyed: boolean = false;

  constructor(
    config?: Partial<FeedManagerConfig>,
    services?: {
      cricHeroesClient?: CricHeroesApiClient;
      aiRecommender?: AIRecommender;
      cacheService?: CacheService;
      queryProcessor?: QueryProcessor;
    },
    events?: Partial<FeedManagerEvents>
  ) {
    this.config = {
      debounceDelay: 300,
      pageSize: 20,
      maxRetries: 3,
      cacheTimeout: 30 * 60 * 1000, // 30 minutes
      backgroundRefreshInterval: 5 * 60 * 1000, // 5 minutes
      enableAI: true,
      enableCaching: true,
      ...config,
    };

    this.cricHeroesClient = services?.cricHeroesClient || new CricHeroesApiClient();
    this.aiRecommender = services?.aiRecommender || new AIRecommender();
    this.cacheService = services?.cacheService || defaultCacheService;
    this.queryProcessor = services?.queryProcessor || new QueryProcessor();
    this.events = events || {};

    this.state = this.getInitialState();
    this.setupAppStateHandling();
  }

  /**
   * Initialize the feed manager and fetch initial data
   */
  async initialize(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('FeedManager has been destroyed');
    }

    console.log('[FeedManager] Initializing feed manager');
    
    try {
      this.updateState({ isLoading: true, error: null });
      
      // Try to load cached data first for immediate display
      if (this.config.enableCaching) {
        await this.loadCachedData();
      }
      
      // Fetch fresh data
      await this.fetchPosts(1, false);
      
      // Start background refresh timer (unless the tab was left meanwhile)
      if (!this.paused) this.startBackgroundRefresh();
      
      console.log('[FeedManager] Feed manager initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize feed manager';
      console.error('[FeedManager] Initialization failed:', error);
      this.updateState({ 
        isLoading: false, 
        error: errorMessage 
      });
      this.events.onError?.(errorMessage);
    }
  }

  /**
   * Fetch recruitment posts with debouncing
   */
  async fetchPosts(
    page: number = 1, 
    append: boolean = false,
    forceRefresh: boolean = false
  ): Promise<void> {
    if (this.isDestroyed) return;

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce the actual fetch operation
    return new Promise((resolve, reject) => {
      this.debounceTimer = setTimeout(async () => {
        try {
          await this.performFetch(page, append, forceRefresh);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, this.config.debounceDelay);
    });
  }

  /**
   * Process natural language query and apply AI filters
   */
  async processQuery(query: string): Promise<void> {
    if (this.isDestroyed) return;

    console.log(`[FeedManager] Processing query: "${query}"`);
    
    try {
      this.updateState({ 
        isAIProcessing: true, 
        currentQuery: query,
        error: null 
      });

      if (!query || query.trim().length === 0) {
        // Clear filters and show all posts
        this.updateState({
          filteredPosts: this.state.posts,
          currentFilters: {},
          aiQuery: null,
          isAIProcessing: false,
          filterStats: null,
        });
        return;
      }

      if (!this.config.enableAI) {
        console.warn('[FeedManager] AI processing is disabled');
        this.updateState({
          filteredPosts: this.state.posts,
          isAIProcessing: false,
          error: 'AI processing is currently disabled',
        });
        return;
      }

      // Process query with AI
      const aiQuery = await this.queryProcessor.processQuery(query);
      
      // Apply filters to current posts
      const filterResult = this.aiRecommender.applyFilters(this.state.posts, aiQuery);
      
      this.updateState({
        filteredPosts: filterResult.filteredPosts,
        currentFilters: filterResult.appliedFilters,
        aiQuery,
        isAIProcessing: false,
        filterStats: filterResult,
      });

      this.events.onFiltersApplied?.(filterResult);
      
      console.log(`[FeedManager] Query processed successfully, ${filterResult.totalMatches} matches found`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process query';
      console.error('[FeedManager] Query processing failed:', error);
      
      this.updateState({
        isAIProcessing: false,
        error: errorMessage,
        filteredPosts: this.state.posts, // Fallback to showing all posts
      });
      
      this.events.onError?.(errorMessage);
    }
  }

  /**
   * Refresh the feed data
   */
  async refresh({ background = false }: { background?: boolean } = {}): Promise<void> {
    if (this.isDestroyed) return;

    console.log('[FeedManager] Refreshing feed data');
    
    try {
      this.updateState({ isRefreshing: true, error: null });
      
      // Clear cache to force fresh data (a background refresh just refetches page 1)
      if (this.config.enableCaching && !background) {
        await this.cacheService.clearAllCache();
      }
      
      // Fetch fresh data
      await this.performFetch(1, false, true);
      
      // Reapply current filters if any
      if (this.state.currentQuery && this.state.aiQuery) {
        const filterResult = this.aiRecommender.applyFilters(this.state.posts, this.state.aiQuery);
        this.updateState({
          filteredPosts: filterResult.filteredPosts,
          filterStats: filterResult,
        });
      }
      
      this.updateState({ isRefreshing: false });
      console.log('[FeedManager] Feed refreshed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh feed';
      console.error('[FeedManager] Refresh failed:', error);
      
      this.updateState({ 
        isRefreshing: false, 
        error: errorMessage 
      });
      
      this.events.onError?.(errorMessage);
    }
  }

  /**
   * Load more posts (pagination)
   */
  async loadMore(): Promise<void> {
    if (this.isDestroyed || this.state.isLoading || this.state.isLoadingMore || !this.state.hasMore) {
      return;
    }

    console.log(`[FeedManager] Loading more posts, page ${this.state.currentPage + 1}`);
    
    this.updateState({ isLoadingMore: true });
    try {
      await this.fetchPosts(this.state.currentPage + 1, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more posts';
      console.error('[FeedManager] Load more failed:', error);
      this.events.onError?.(errorMessage);
    } finally {
      if (!this.isDestroyed) this.updateState({ isLoadingMore: false });
    }
  }

  /** The tab went off screen: stop background refreshing. */
  pause(): void {
    this.paused = true;
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
  }

  /** The tab is back on screen: catch up if the data went stale, then resume the timer. */
  resume(): void {
    if (this.isDestroyed || !this.paused) return;
    this.paused = false;
    this.handleAppResume();
  }

  /**
   * Clear current filters and show all posts
   */
  clearFilters(): void {
    if (this.isDestroyed) return;

    console.log('[FeedManager] Clearing filters');
    
    this.updateState({
      filteredPosts: this.state.posts,
      currentQuery: '',
      currentFilters: {},
      aiQuery: null,
      filterStats: null,
    });
  }

  /**
   * Get current feed state
   */
  getState(): FeedState {
    return { ...this.state };
  }

  /**
   * Check if feed has data
   */
  hasData(): boolean {
    return this.state.posts.length > 0;
  }

  /**
   * Check if feed is currently loading
   */
  isLoading(): boolean {
    return this.state.isLoading || this.state.isRefreshing || this.state.isAIProcessing;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.config.enableCaching) {
      return null;
    }
    return await this.cacheService.getCacheStats();
  }

  /**
   * Destroy the feed manager and clean up resources
   */
  destroy(): void {
    console.log('[FeedManager] Destroying feed manager');
    
    this.isDestroyed = true;
    
    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
    
    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    console.log('[FeedManager] Feed manager destroyed');
  }

  /**
   * Perform the actual fetch operation
   */
  private async performFetch(
    page: number, 
    append: boolean, 
    forceRefresh: boolean
  ): Promise<void> {
    console.log(`[FeedManager] Fetching posts - page: ${page}, append: ${append}, forceRefresh: ${forceRefresh}`);
    
    if (!append) {
      this.updateState({ isLoading: true });
    }

    try {
      const response = await this.cricHeroesClient.fetchRecruitmentPosts(
        page,
        this.config.pageSize,
        undefined, // No filters for now
        forceRefresh
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch posts');
      }

      const recruitmentResponse = response.data;
      const newPosts = recruitmentResponse.data.map(rawPost => 
        this.cricHeroesClient.transformToRecruitmentPost(rawPost)
      );

      // Update state with new posts. Appends skip posts already listed; a page with
      // nothing new means paging has run out (it used to append page 1 forever).
      let updatedPosts = newPosts;
      let hasMore = recruitmentResponse.page?.next != null;
      if (append) {
        const seen = new Set(this.state.posts.map(post => post.id));
        const fresh = newPosts.filter(post => !seen.has(post.id));
        updatedPosts = fresh.length ? [...this.state.posts, ...fresh] : this.state.posts;
        if (fresh.length === 0) hasMore = false;
      }
      const totalCount = recruitmentResponse.page?.total || updatedPosts.length;

      this.updateState({
        posts: updatedPosts,
        filteredPosts: this.state.currentQuery ? this.state.filteredPosts : updatedPosts,
        isLoading: false,
        hasMore,
        currentPage: page,
        totalCount,
        lastFetchTime: new Date(),
        error: null,
      });

      this.events.onPostsLoaded?.(newPosts);
      
      console.log(`[FeedManager] Successfully fetched ${newPosts.length} posts`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch posts';
      console.error('[FeedManager] Fetch failed:', error);
      
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });
      
      throw error;
    }
  }

  /**
   * Load cached data for immediate display
   */
  private async loadCachedData(): Promise<void> {
    try {
      const cacheKey = this.cacheService.generatePostsKey(1, this.config.pageSize);
      const cachedResponse = await this.cacheService.getCachedRecruitmentPosts(cacheKey);
      
      if (cachedResponse && cachedResponse.data.length > 0) {
        const cachedPosts = cachedResponse.data.map(rawPost => 
          this.cricHeroesClient.transformToRecruitmentPost(rawPost)
        );
        
        this.updateState({
          posts: cachedPosts,
          filteredPosts: cachedPosts,
          totalCount: cachedResponse.page?.total || cachedPosts.length,
        });
        
        console.log(`[FeedManager] Loaded ${cachedPosts.length} cached posts`);
      }
    } catch (error) {
      console.warn('[FeedManager] Failed to load cached data:', error);
    }
  }

  /**
   * Setup app state handling for background/foreground transitions
   */
  private setupAppStateHandling(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  /**
   * Handle app state changes (background/foreground)
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (this.isDestroyed) return;

    console.log(`[FeedManager] App state changed to: ${nextAppState}`);
    
    if (nextAppState === 'active') {
      // App came to foreground, check if we need to refresh data
      this.handleAppResume();
    } else if (nextAppState === 'background') {
      // App went to background, pause background refresh
      this.handleAppBackground();
    }
  }

  /**
   * Handle app resume (foreground)
   */
  private async handleAppResume(): Promise<void> {
    if (this.paused) return;
    console.log('[FeedManager] App resumed, checking for data refresh');
    
    // Check if data is stale and needs refresh
    if (this.state.lastFetchTime) {
      const timeSinceLastFetch = Date.now() - this.state.lastFetchTime.getTime();
      const shouldRefresh = timeSinceLastFetch > this.config.cacheTimeout;
      
      if (shouldRefresh) {
        console.log('[FeedManager] Data is stale, refreshing...');
        await this.refresh({ background: true });
      }
    }
    
    // Restart background refresh
    this.startBackgroundRefresh();
  }

  /**
   * Handle app background
   */
  private handleAppBackground(): void {
    console.log('[FeedManager] App backgrounded, pausing background refresh');
    
    // Stop background refresh to save battery
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
    }
  }

  /**
   * Start background refresh timer
   */
  private startBackgroundRefresh(): void {
    // Clear existing timer
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer);
    }
    
    // Set up new timer
    this.backgroundRefreshTimer = setTimeout(() => {
      if (!this.isDestroyed && !this.paused && AppState.currentState === 'active') {
        console.log('[FeedManager] Background refresh triggered');
        this.refresh({ background: true }).catch(error => {
          console.warn('[FeedManager] Background refresh failed:', error);
        });
      }
    }, this.config.backgroundRefreshInterval);
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<FeedState>): void {
    this.state = { ...this.state, ...updates };
    this.events.onStateChange?.(this.state);
  }

  /**
   * Get initial state
   */
  private getInitialState(): FeedState {
    return {
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
    };
  }
}

export default FeedManager;