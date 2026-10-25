import * as fc from 'fast-check';
import { AIRecommender } from '../services/aiRecommender';
import { OpenRouterApiClient } from '../services/openRouterApiClient';
import { 
  RecruitmentPost, 
  AIQuery, 
  PostFilters, 
  SkillLevel, 
  TeamType, 
  BallType, 
  GroundType, 
  MatchFormat,
  DateRange,
  TimeRange
} from '../types';

// Mock the OpenRouter API client
jest.mock('../services/openRouterApiClient');

describe('AI Recommender', () => {
  let aiRecommender: AIRecommender;
  let mockOpenRouterClient: jest.Mocked<OpenRouterApiClient>;

  beforeEach(() => {
    mockOpenRouterClient = new OpenRouterApiClient() as jest.Mocked<OpenRouterApiClient>;
    aiRecommender = new AIRecommender(mockOpenRouterClient);
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 6: AI filter application
     * **Validates: Requirements 2.4**
     * 
     * For any set of AI-generated filters and post collection, only posts matching 
     * all specified criteria should be displayed in the filtered results.
     */
    it('Property 6: AI filter application', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various filter combinations
          fc.record({
            positions: fc.option(fc.array(fc.constantFrom('batsman', 'bowler', 'wicket-keeper', 'all-rounder'), { minLength: 1, maxLength: 3 }), { nil: undefined }),
            dates: fc.option(fc.record({
              startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
              endDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
            }).map(({ startDate, endDate }) => {
              // Ensure both dates are valid and start <= end
              const validStart = isNaN(startDate.getTime()) ? new Date('2024-01-01') : startDate;
              const validEnd = isNaN(endDate.getTime()) ? new Date('2024-12-31') : endDate;
              return {
                startDate: validStart < validEnd ? validStart : validEnd,
                endDate: validStart < validEnd ? validEnd : validStart
              };
            }), { nil: undefined }),
            times: fc.option(fc.record({
              startTime: fc.constantFrom('06:00', '09:00', '14:00', '18:00'),
              endTime: fc.constantFrom('12:00', '15:00', '17:00', '22:00')
            }).filter(({ startTime, endTime }) => {
              const start = timeToMinutes(startTime);
              const end = timeToMinutes(endTime);
              return start < end;
            }), { nil: undefined }),
            locations: fc.option(fc.array(fc.constantFrom('Mumbai', 'Delhi', 'Bangalore', 'Chennai'), { minLength: 1, maxLength: 2 }), { nil: undefined }),
            skillLevels: fc.option(fc.array(fc.constantFrom(...Object.values(SkillLevel)), { minLength: 1, maxLength: 2 }), { nil: undefined })
          }),
          // Generate a collection of recruitment posts
          fc.array(
            fc.record({
              id: fc.string(),
              user: fc.record({
                id: fc.string(),
                name: fc.string(),
                profilePhoto: fc.string(),
                contactDetails: fc.record({
                  phone: fc.option(fc.string(), { nil: undefined }),
                  email: fc.option(fc.string(), { nil: undefined })
                })
              }),
              requirements: fc.record({
                positionsNeeded: fc.array(fc.constantFrom('batsman', 'bowler', 'wicket-keeper', 'all-rounder'), { minLength: 1, maxLength: 2 }),
                skillLevel: fc.constantFrom(...Object.values(SkillLevel)),
                teamType: fc.constantFrom(...Object.values(TeamType)),
                description: fc.string()
              }),
              matchDetails: fc.record({
                ballType: fc.constantFrom(...Object.values(BallType)),
                groundType: fc.constantFrom(...Object.values(GroundType)),
                matchFormat: fc.constantFrom(...Object.values(MatchFormat)),
                comments: fc.string()
              }),
              location: fc.record({
                latitude: fc.float({ min: -90, max: 90 }),
                longitude: fc.float({ min: -180, max: 180 }),
                cityId: fc.integer({ min: 1 }),
                cityName: fc.constantFrom('Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Kolkata'),
                venue: fc.option(fc.string(), { nil: undefined })
              }),
              timing: fc.record({
                isLongTerm: fc.boolean(),
                specificDates: fc.option(fc.array(fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
                preferredTimes: fc.array(
                  fc.record({
                    startTime: fc.constantFrom('06:00', '09:00', '14:00', '18:00', '19:30'),
                    endTime: fc.constantFrom('12:00', '15:00', '17:00', '22:00', '21:30')
                  }),
                  { minLength: 1, maxLength: 2 }
                )
              }),
              createdAt: fc.date(),
              updatedAt: fc.date()
            }),
            { minLength: 0, maxLength: 15 }
          ),
          async (filters, posts) => {
            // Create AI query with the generated filters
            const aiQuery: AIQuery = {
              rawQuery: 'test filter application',
              processedFilters: filters,
              confidence: 0.9, // High confidence to ensure filters are applied
              suggestions: []
            };

            // Apply filters
            const result = aiRecommender.applyFilters(posts, aiQuery);

            // Verify basic result structure
            expect(result).toBeDefined();
            expect(Array.isArray(result.filteredPosts)).toBe(true);
            expect(typeof result.totalMatches).toBe('number');
            expect(result.totalMatches).toBe(result.filteredPosts.length);
            expect(typeof result.confidence).toBe('number');

            // Verify filtered posts are subset of original posts
            expect(result.filteredPosts.length).toBeLessThanOrEqual(posts.length);

            // Verify all filtered posts exist in original collection
            result.filteredPosts.forEach(filteredPost => {
              expect(posts.some(post => post.id === filteredPost.id)).toBe(true);
            });

            // Verify each filtered post matches ALL specified criteria
            result.filteredPosts.forEach(post => {
              // Position filter verification
              if (filters.positions && filters.positions.length > 0) {
                const hasMatchingPosition = filters.positions.some(position => 
                  post.requirements.positionsNeeded.some(needed => 
                    needed.toLowerCase().includes(position.toLowerCase()) ||
                    position.toLowerCase().includes(needed.toLowerCase())
                  )
                );
                expect(hasMatchingPosition).toBe(true);
              }

              // Date filter verification
              if (filters.dates) {
                const { startDate, endDate } = filters.dates;
                
                if (!post.timing.isLongTerm && post.timing.specificDates) {
                  const hasMatchingDate = post.timing.specificDates.some(postDate => {
                    const postDateTime = new Date(postDate);
                    return postDateTime >= startDate && postDateTime <= endDate;
                  });
                  expect(hasMatchingDate || post.timing.isLongTerm).toBe(true);
                }
                // Long-term posts should always match
              }

              // Time filter verification
              if (filters.times && post.timing.preferredTimes.length > 0) {
                const { startTime, endTime } = filters.times;
                const filterStart = timeToMinutes(startTime);
                const filterEnd = timeToMinutes(endTime);
                
                const hasTimeOverlap = post.timing.preferredTimes.some(timeSlot => {
                  const postStart = timeToMinutes(timeSlot.startTime);
                  const postEnd = timeToMinutes(timeSlot.endTime);
                  return filterStart < postEnd && postStart < filterEnd;
                });
                
                expect(hasTimeOverlap).toBe(true);
              }

              // Location filter verification
              if (filters.locations && filters.locations.length > 0) {
                const hasMatchingLocation = filters.locations.some(location =>
                  post.location.cityName.toLowerCase().includes(location.toLowerCase()) ||
                  (post.location.venue && post.location.venue.toLowerCase().includes(location.toLowerCase()))
                );
                expect(hasMatchingLocation).toBe(true);
              }

              // Skill level filter verification
              if (filters.skillLevels && filters.skillLevels.length > 0) {
                expect(filters.skillLevels.includes(post.requirements.skillLevel)).toBe(true);
              }
            });
          }
        ),
        { numRuns: 50 } // Reduced runs for complex test
      );
    });

    /**
     * Property 7: AI failure graceful degradation with model fallback
     * **Validates: Requirements 2.5, 2.6**
     * 
     * For any AI processing failure, the system should attempt fallback models 
     * (gpt-oss-120b → qwen3-next-80b → gpt-oss-20b) before displaying all posts with a notification.
     */
    it('Property 7: AI failure graceful degradation with model fallback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0), // Natural language query (non-empty)
          fc.array(
            fc.record({
              id: fc.string(),
              user: fc.record({
                id: fc.string(),
                name: fc.string(),
                profilePhoto: fc.string(),
                contactDetails: fc.record({
                  phone: fc.option(fc.string(), { nil: undefined }),
                  email: fc.option(fc.string(), { nil: undefined })
                })
              }),
              requirements: fc.record({
                positionsNeeded: fc.array(fc.constantFrom('batsman', 'bowler', 'wicket-keeper', 'all-rounder'), { minLength: 1 }),
                skillLevel: fc.constantFrom(...Object.values(SkillLevel)),
                teamType: fc.constantFrom(...Object.values(TeamType)),
                description: fc.string()
              }),
              matchDetails: fc.record({
                ballType: fc.constantFrom(...Object.values(BallType)),
                groundType: fc.constantFrom(...Object.values(GroundType)),
                matchFormat: fc.constantFrom(...Object.values(MatchFormat)),
                comments: fc.string()
              }),
              location: fc.record({
                latitude: fc.float({ min: -90, max: 90 }),
                longitude: fc.float({ min: -180, max: 180 }),
                cityId: fc.integer({ min: 1 }),
                cityName: fc.string(),
                venue: fc.option(fc.string(), { nil: undefined })
              }),
              timing: fc.record({
                isLongTerm: fc.boolean(),
                specificDates: fc.option(fc.array(fc.date()), { nil: undefined }),
                preferredTimes: fc.array(
                  fc.record({
                    startTime: fc.constantFrom('06:00', '09:00', '14:00', '18:00'),
                    endTime: fc.constantFrom('12:00', '15:00', '17:00', '22:00')
                  }),
                  { minLength: 1 }
                )
              }),
              createdAt: fc.date(),
              updatedAt: fc.date()
            }),
            { minLength: 0, maxLength: 10 }
          ),
          fc.constantFrom(
            'AI service unavailable',
            'Rate limit exceeded',
            'Authentication failed',
            'Network timeout',
            'Invalid response format'
          ), // Error types
          async (query, posts, errorType) => {
            // Mock AI client failure
            mockOpenRouterClient.processQuery.mockResolvedValue({
              success: false,
              error: errorType,
              fallbackAttempts: 3 // Simulate all models failed
            });

            // Generate filters (should fallback gracefully)
            const filterResult = await aiRecommender.generateFilters(query);

            // Verify graceful degradation
            expect(filterResult.success).toBe(true); // Should succeed with fallback
            expect(filterResult.data).toBeDefined();

            if (filterResult.data) {
              // Verify fallback response characteristics
              expect(filterResult.data.rawQuery).toBe(query);
              expect(filterResult.data.confidence).toBe(0.1); // Low confidence for fallback
              expect(filterResult.data.processedFilters).toEqual({}); // Empty filters
              expect(filterResult.data.fallbackAttempts).toBe(999); // Fallback indicator
              expect(Array.isArray(filterResult.data.suggestions)).toBe(true);
              expect(filterResult.data.suggestions!.length).toBeGreaterThan(0);
              
              // Verify fallback suggestions contain helpful messages
              const suggestions = filterResult.data.suggestions!;
              expect(suggestions.some(s => s.includes('AI processing is currently unavailable'))).toBe(true);

              // Apply filters to posts (should return all posts)
              const applicationResult = aiRecommender.applyFilters(posts, filterResult.data);

              // Verify all posts are returned when AI fails
              expect(applicationResult.filteredPosts).toEqual(posts);
              expect(applicationResult.totalMatches).toBe(posts.length);
              expect(applicationResult.confidence).toBe(0.1);
              expect(Array.isArray(applicationResult.suggestions)).toBe(true);
              
              // Verify fallback statistics
              if (applicationResult.statistics) {
                expect(applicationResult.statistics.totalPosts).toBe(posts.length);
                expect(applicationResult.statistics.filteredPosts).toBe(posts.length);
                
                // Filter efficiency should be 1.0 when posts exist, or 0 when no posts
                const expectedEfficiency = posts.length > 0 ? 1.0 : 0;
                expect(applicationResult.statistics.filterEfficiency).toBe(expectedEfficiency);
              }
            }
          }
        ),
        { numRuns: 30 } // Fewer runs for failure scenarios
      );
    });
  });

  describe('Unit Tests', () => {
    it('should create AIRecommender with correct default configuration', () => {
      expect(aiRecommender).toBeDefined();
      expect(aiRecommender.generateFilters).toBeDefined();
      expect(aiRecommender.applyFilters).toBeDefined();
      expect(aiRecommender.testRecommender).toBeDefined();
      expect(aiRecommender.getConfig).toBeDefined();
    });

    it('should handle empty queries', async () => {
      const result = await aiRecommender.generateFilters('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Query cannot be empty');
    });

    it('should apply filters correctly with valid data', () => {
      const mockPost: RecruitmentPost = {
        id: 'test-1',
        user: {
          id: 'user-1',
          name: 'Test User',
          profilePhoto: 'photo.jpg',
          contactDetails: { phone: '123456789' }
        },
        requirements: {
          positionsNeeded: ['batsman'],
          skillLevel: SkillLevel.INTERMEDIATE,
          teamType: TeamType.COMPETITIVE,
          description: 'Need batsman'
        },
        matchDetails: {
          ballType: BallType.LEATHER,
          groundType: GroundType.TURF,
          matchFormat: MatchFormat.T20,
          comments: 'Test match'
        },
        location: {
          latitude: 19.0760,
          longitude: 72.8777,
          cityId: 1,
          cityName: 'Mumbai',
          venue: 'Test Ground'
        },
        timing: {
          isLongTerm: false,
          specificDates: [new Date('2024-01-15')],
          preferredTimes: [{ startTime: '09:00', endTime: '12:00' }]
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const aiQuery: AIQuery = {
        rawQuery: 'Find batsman in Mumbai',
        processedFilters: {
          positions: ['batsman'],
          locations: ['Mumbai']
        },
        confidence: 0.9,
        suggestions: []
      };

      const result = aiRecommender.applyFilters([mockPost], aiQuery);

      expect(result.filteredPosts).toHaveLength(1);
      expect(result.filteredPosts[0].id).toBe('test-1');
      expect(result.totalMatches).toBe(1);
    });
  });
});

// Helper function to convert time string to minutes
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}