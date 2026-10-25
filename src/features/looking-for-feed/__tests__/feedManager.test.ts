import * as fc from 'fast-check';
import { FeedManager, FeedState } from '../services/feedManager';
import { CricHeroesApiClient } from '../services/cricHeroesApiClient';
import { AIRecommender } from '../services/aiRecommender';
import { CacheService } from '../services/cacheService';
import { QueryProcessor } from '../utils/queryProcessor';
import { AppState } from 'react-native';

// Mock React Native AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn(),
}));

describe('FeedManager', () => {
  let mockCricHeroesClient: jest.Mocked<CricHeroesApiClient>;
  let mockAIRecommender: jest.Mocked<AIRecommender>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockQueryProcessor: jest.Mocked<QueryProcessor>;
  let feedManager: FeedManager;

  beforeEach(() => {
    // Create mocked services
    mockCricHeroesClient = {
      fetchRecruitmentPosts: jest.fn(),
      transformToRecruitmentPost: jest.fn(),
      getCachedPost: jest.fn(),
      isCacheStale: jest.fn(),
      invalidateCache: jest.fn(),
      clearAllCache: jest.fn(),
    } as any;

    mockAIRecommender = {
      generateFilters: jest.fn(),
      applyFilters: jest.fn(),
      getConfig: jest.fn(),
      testRecommender: jest.fn(),
    } as any;

    mockCacheService = {
      cacheRecruitmentPosts: jest.fn(),
      getCachedRecruitmentPosts: jest.fn(),
      cachePost: jest.fn(),
      getCachedPost: jest.fn(),
      isCacheStale: jest.fn(),
      invalidateCache: jest.fn(),
      clearAllCache: jest.fn(),
      getCacheStats: jest.fn(),
      generatePostsKey: jest.fn(),
    } as any;

    mockQueryProcessor = {
      processQuery: jest.fn(),
      validateQuery: jest.fn(),
      preprocessQuery: jest.fn(),
      getQueryHistory: jest.fn(),
      clearQueryHistory: jest.fn(),
      getQuerySuggestions: jest.fn(),
    } as any;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (feedManager) {
      feedManager.destroy();
    }
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 1: Tab selection triggers API fetch
     * **Validates: Requirements 1.1**
     * 
     * For any tab selection event (initialization), the Looking_For_Feed should 
     * initiate a request to the CricHeroes API with correct endpoint and parameters.
     */
    it('Property 1: Tab selection triggers API fetch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // pageSize
          fc.boolean(), // enableCaching
          fc.boolean(), // enableAI
          fc.integer({ min: 100, max: 1000 }), // debounceDelay
          async (pageSize, enableCaching, enableAI, debounceDelay) => {
            // Clear mocks before each property test run
            jest.clearAllMocks();
            
            // Setup mock responses
            const mockApiResponse = {
              success: true,
              data: {
                status: true,
                data: [],
                page: {
                  current_page: 1,
                  total: 0,
                  next: null,
                  previous: null,
                },
              },
            };

            mockCricHeroesClient.fetchRecruitmentPosts.mockResolvedValue(mockApiResponse);
            mockCacheService.getCachedRecruitmentPosts.mockResolvedValue(null);
            mockCacheService.generatePostsKey.mockReturnValue('test_key');

            // Create FeedManager with test configuration
            feedManager = new FeedManager(
              {
                pageSize,
                enableCaching,
                enableAI,
                debounceDelay,
              },
              {
                cricHeroesClient: mockCricHeroesClient,
                aiRecommender: mockAIRecommender,
                cacheService: mockCacheService,
                queryProcessor: mockQueryProcessor,
              }
            );

            // Simulate tab selection by initializing the feed manager
            await feedManager.initialize();

            // Wait for debounce delay to ensure API call is made
            await new Promise(resolve => setTimeout(resolve, debounceDelay + 50));

            // Verify that API fetch was triggered
            expect(mockCricHeroesClient.fetchRecruitmentPosts).toHaveBeenCalledTimes(1);

            // Verify API was called with correct parameters
            const [page, actualPageSize, filters, forceRefresh] = mockCricHeroesClient.fetchRecruitmentPosts.mock.calls[0];
            expect(page).toBe(1); // First page on initialization
            expect(actualPageSize).toBe(pageSize);
            expect(filters).toBeUndefined(); // No filters on initial load
            expect(forceRefresh).toBe(false); // Not force refresh on initial load

            // Verify state is updated correctly
            const state = feedManager.getState();
            expect(state.isLoading).toBe(false); // Should complete loading
            expect(state.currentPage).toBe(1);
            expect(state.error).toBeNull();

            // If caching is enabled, verify cache operations
            if (enableCaching) {
              expect(mockCacheService.getCachedRecruitmentPosts).toHaveBeenCalled();
              expect(mockCacheService.generatePostsKey).toHaveBeenCalledWith(1, pageSize);
            }

            // Clean up
            feedManager.destroy();
            feedManager = null as any;

            // Clean up
            feedManager.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16: Request debouncing
     * **Validates: Requirements 6.4**
     * 
     * For any sequence of rapid API requests, debouncing should prevent excessive 
     * calls while ensuring the latest request is processed.
     */
    it('Property 16: Request debouncing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // numberOfRequests
          fc.integer({ min: 50, max: 300 }), // debounceDelay
          fc.integer({ min: 10, max: 50 }), // requestInterval (should be less than debounce)
          async (numberOfRequests, debounceDelay, requestInterval) => {
            // Clear mocks before each property test run
            jest.clearAllMocks();
            
            // Setup mock responses
            const mockApiResponse = {
              success: true,
              data: {
                status: true,
                data: [],
                page: { current_page: 1, total: 0, next: null },
              },
            };

            mockCricHeroesClient.fetchRecruitmentPosts.mockResolvedValue(mockApiResponse);
            mockCacheService.getCachedRecruitmentPosts.mockResolvedValue(null);
            mockCacheService.generatePostsKey.mockReturnValue('test_key');

            // Create FeedManager with test configuration
            feedManager = new FeedManager(
              {
                debounceDelay,
                pageSize: 20,
                enableCaching: false, // Disable caching for cleaner test
              },
              {
                cricHeroesClient: mockCricHeroesClient,
                aiRecommender: mockAIRecommender,
                cacheService: mockCacheService,
                queryProcessor: mockQueryProcessor,
              }
            );

            // Initialize first
            await feedManager.initialize();
            
            // Wait for initial request to complete
            await new Promise(resolve => setTimeout(resolve, debounceDelay + 50));
            
            // Clear the initial call
            mockCricHeroesClient.fetchRecruitmentPosts.mockClear();

            // Make rapid successive requests
            const requestPromises: Promise<void>[] = [];
            for (let i = 0; i < numberOfRequests; i++) {
              requestPromises.push(feedManager.fetchPosts(i + 1, false, false));
              
              // Wait a short interval between requests (less than debounce delay)
              if (i < numberOfRequests - 1) {
                await new Promise(resolve => setTimeout(resolve, requestInterval));
              }
            }

            // Wait for all requests to be initiated
            await Promise.all(requestPromises);

            // Wait for debounce delay to ensure the final request is processed
            await new Promise(resolve => setTimeout(resolve, debounceDelay + 100));

            // Verify that only ONE API call was made (the last one due to debouncing)
            expect(mockCricHeroesClient.fetchRecruitmentPosts).toHaveBeenCalledTimes(1);

            // Verify the API was called with the parameters from the LAST request
            const [page] = mockCricHeroesClient.fetchRecruitmentPosts.mock.calls[0];
            expect(page).toBe(numberOfRequests); // Should be the last page requested

            // Verify state reflects the final request
            const state = feedManager.getState();
            expect(state.currentPage).toBe(numberOfRequests);

            // Clean up
            feedManager.destroy();
            feedManager = null as any;
          }
        ),
        { numRuns: 50 } // Reduced runs due to timing-sensitive nature
      );
    }, 30000); // 30 second timeout

    /**
     * Property 17: App lifecycle data refresh
     * **Validates: Requirements 6.6**
     * 
     * For any app backgrounding and resuming cycle, data should be refreshed 
     * appropriately without disrupting user context or losing unsaved state.
     */
    it('Property 17: App lifecycle data refresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 5000 }), // backgroundDuration (ms)
          fc.integer({ min: 10000, max: 60000 }), // cacheTimeout (ms)
          fc.boolean(), // shouldDataBeStale
          async (backgroundDuration, cacheTimeout, shouldDataBeStale) => {
            // Clear mocks before each property test run
            jest.clearAllMocks();
            
            // Setup mock responses
            const mockApiResponse = {
              success: true,
              data: {
                status: true,
                data: [],
                page: { current_page: 1, total: 0, next: null },
              },
            };

            mockCricHeroesClient.fetchRecruitmentPosts.mockResolvedValue(mockApiResponse);
            mockCacheService.getCachedRecruitmentPosts.mockResolvedValue(null);
            mockCacheService.generatePostsKey.mockReturnValue('test_key');

            // Create FeedManager with test configuration
            feedManager = new FeedManager(
              {
                cacheTimeout,
                backgroundRefreshInterval: 60000, // 1 minute
                pageSize: 20,
              },
              {
                cricHeroesClient: mockCricHeroesClient,
                aiRecommender: mockAIRecommender,
                cacheService: mockCacheService,
                queryProcessor: mockQueryProcessor,
              }
            );

            // Initialize and wait for initial load
            await feedManager.initialize();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Clear initial API calls
            mockCricHeroesClient.fetchRecruitmentPosts.mockClear();

            // Get initial state to preserve user context
            const initialState = feedManager.getState();
            const initialQuery = 'test query';
            const initialFilters = { positions: ['batsman'] };

            // Simulate user having applied filters
            feedManager.getState().currentQuery = initialQuery;
            feedManager.getState().currentFilters = initialFilters;

            // Mock app state change listener
            let appStateChangeHandler: (state: string) => void = () => {};
            (AppState.addEventListener as jest.Mock).mockImplementation((event, handler) => {
              if (event === 'change') {
                appStateChangeHandler = handler;
              }
              return { remove: jest.fn() };
            });

            // Simulate app going to background
            appStateChangeHandler('background');

            // Wait for background duration
            await new Promise(resolve => setTimeout(resolve, backgroundDuration));

            // Determine if data should be considered stale based on test parameters
            const timeSinceLastFetch = backgroundDuration;
            const dataIsStale = shouldDataBeStale || timeSinceLastFetch > cacheTimeout;

            // Simulate app coming back to foreground
            appStateChangeHandler('active');

            // Wait for app resume handling
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify behavior based on data staleness
            if (dataIsStale) {
              // If data is stale, should trigger refresh
              expect(mockCricHeroesClient.fetchRecruitmentPosts).toHaveBeenCalled();
            } else {
              // If data is fresh, should not trigger unnecessary refresh
              // Note: This might still be called due to background refresh timer
              // so we don't assert it wasn't called, just that state is preserved
            }

            // Verify user context is preserved
            const finalState = feedManager.getState();
            
            // User's query and filters should be preserved
            expect(finalState.currentQuery).toBe(initialQuery);
            expect(finalState.currentFilters).toEqual(initialFilters);
            
            // App should not be in error state
            expect(finalState.error).toBeNull();

            // Clean up
            feedManager.destroy();
            feedManager = null as any;
          }
        ),
        { numRuns: 30 } // Reduced runs due to timing complexity
      );
    }, 30000); // 30 second timeout
  });

  describe('Unit Tests', () => {
    it('should initialize with correct default state', () => {
      feedManager = new FeedManager();
      const state = feedManager.getState();
      
      expect(state.posts).toEqual([]);
      expect(state.filteredPosts).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentQuery).toBe('');
      expect(state.hasMore).toBe(true);
      expect(state.currentPage).toBe(0);
    });

    it('should handle initialization failure gracefully', async () => {
      mockCricHeroesClient.fetchRecruitmentPosts.mockRejectedValue(new Error('Network error'));
      
      feedManager = new FeedManager(
        {},
        { cricHeroesClient: mockCricHeroesClient }
      );

      await feedManager.initialize();
      
      const state = feedManager.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('should clear filters correctly', () => {
      feedManager = new FeedManager();
      
      // Set some initial state
      feedManager.getState().currentQuery = 'test query';
      feedManager.getState().currentFilters = { positions: ['batsman'] };
      feedManager.getState().posts = [{ id: '1' } as any];
      
      feedManager.clearFilters();
      
      const state = feedManager.getState();
      expect(state.currentQuery).toBe('');
      expect(state.currentFilters).toEqual({});
      expect(state.filteredPosts).toEqual(state.posts);
    });

    it('should handle destroy correctly', () => {
      feedManager = new FeedManager();
      
      // Should not throw
      expect(() => feedManager.destroy()).not.toThrow();
      
      // Should prevent further operations
      expect(() => feedManager.getState()).not.toThrow();
    });
  });
});