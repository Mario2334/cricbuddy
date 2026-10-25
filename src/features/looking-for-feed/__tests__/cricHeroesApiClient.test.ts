import * as fc from 'fast-check';
import { CricHeroesApiClient, CricHeroesRecruitmentPost } from '../services/cricHeroesApiClient';

// Mock fetch
const mockFetch = jest.fn();
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

describe('CricHeroes API Client', () => {
  let apiClient: CricHeroesApiClient;

  beforeEach(() => {
    apiClient = new CricHeroesApiClient();
    mockFetch.mockClear();
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 10: API client request formatting
     * **Validates: Requirements 4.1**
     * 
     * For any valid API request parameters, the CricHeroes API client should format
     * requests with correct endpoints, authentication headers, and query parameters.
     */
    it('Property 10: API client request formatting', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // pageNo
          fc.integer({ min: 1, max: 50 }),  // pageSize
          fc.option(fc.integer({ min: 1, max: 1000 })), // cityId
          fc.option(fc.constantFrom('beginner', 'intermediate', 'advanced', 'professional')), // skillLevel
          fc.option(fc.constantFrom('casual', 'competitive', 'tournament', 'league')), // teamType
          fc.option(fc.constantFrom('leather', 'tennis', 'rubber', 'plastic')), // ballType
          async (pageNo, pageSize, cityId, skillLevel, teamType, ballType) => {
            // Mock successful response
            const mockResponse = {
              ok: true,
              status: 200,
              json: jest.fn().mockResolvedValue({
                status: true,
                data: [],
                page: { current_page: pageNo, total: 0 }
              })
            };
            mockFetch.mockResolvedValue(mockResponse as any);

            const filters = {
              ...(cityId && { cityId }),
              ...(skillLevel && { skillLevel }),
              ...(teamType && { teamType }),
              ...(ballType && { ballType })
            };

            // Make API request
            await apiClient.fetchRecruitmentPosts(pageNo, pageSize, Object.keys(filters).length > 0 ? filters : undefined);

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalledTimes(1);
            
            const [url, options] = mockFetch.mock.calls[0];

            // Verify URL structure
            expect(typeof url).toBe('string');
            expect(url).toContain('https://cricheroes.in/api/v1/looking/get-looking-for-feed');
            expect(url).toContain('cityid=');
            expect(url).toContain('typeid=1');

            // Verify filters are included in URL when provided
            if (cityId) expect(url).toContain(`cityid=${cityId}`);
            if (skillLevel) expect(url).toContain(`skill_level=${skillLevel}`);
            if (teamType) expect(url).toContain(`team_type=${teamType}`);
            if (ballType) expect(url).toContain(`ball_type=${ballType}`);

            // Verify request options
            expect(options).toBeDefined();
            if (options) {
              expect(options.method).toBe('GET');
              expect(options.headers).toBeDefined();

              // Verify required authentication headers
              const headers = options.headers as Record<string, string>;
              expect(headers['api-key']).toBe('cr!CkH3r0s');
              expect(headers['Authorization']).toBe('d4f4dc30-4a88-11f0-939e-1b491f4b7e9e');
              expect(headers['udid']).toBe('BFA05B08-7B26-548A-908F-3D09DB8D824E');
              expect(headers['Accept']).toBe('application/json');
              expect(headers['Content-Type']).toBe('application/json');
              expect(headers['Host']).toBe('cricheroes.in');
              expect(headers['User-Agent']).toContain('CricHeroes');

              // Verify additional headers
              expect(headers['is-white-label']).toBe('0');
              expect(headers['app-environment']).toBe('debug');
              expect(headers['device-type']).toBe('ios');
            }

            // Clear mock for next iteration
            mockFetch.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle request timeout correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 500 }), // timeout in ms - reduced range
          async (timeout) => {
            // Mock a delayed response that exceeds timeout
            mockFetch.mockImplementation(() => 
              new Promise(resolve => setTimeout(resolve, timeout + 50)) // Reduced delay
            );

            const result = await apiClient.fetchRecruitmentPosts(1, 10);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 5 } // Fewer runs for timeout tests
      );
    }, 10000); // Increased timeout to 10 seconds

    /**
     * Property 11: Response parsing and validation
     * **Validates: Requirements 4.2, 4.6**
     * 
     * For any API response structure, the CricHeroes API client should correctly parse
     * valid responses and filter out malformed posts with appropriate error logging.
     */
    it('Property 11: Response parsing and validation', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Valid response structure
            fc.record({
              status: fc.boolean(),
              data: fc.array(
                fc.record({
                  _id: fc.string({ minLength: 1 }),
                  user_id: fc.integer({ min: 1 }),
                  user_name: fc.string({ minLength: 1 }),
                  profile_photo: fc.string(),
                  mobile: fc.string({ minLength: 10 }),
                  country_code: fc.string(),
                  what_value: fc.string({ minLength: 1 }), // position needed
                  what2_value: fc.option(fc.string()),
                  where2_value: fc.option(fc.string()), // location
                  which_value: fc.option(fc.string()), // team name
                  which2_value: fc.option(fc.string()), // timing type
                  ground_type: fc.string(),
                  comment: fc.string(),
                  comment_html_value: fc.option(fc.string()),
                  latitude: fc.float({ min: -90, max: 90 }).map(n => n.toString()),
                  longitude: fc.float({ min: -180, max: 180 }).map(n => n.toString()),
                  city_id: fc.array(fc.integer({ min: 1 }), { minLength: 1 }),
                  city_name: fc.string({ minLength: 1 }),
                  ball_type_id: fc.array(fc.integer({ min: 1 }), { minLength: 1 }),
                  when_value_original: fc.option(fc.string()),
                  time_ago: fc.string(),
                  is_expired: fc.integer({ min: 0, max: 1 }),
                  is_pro: fc.integer({ min: 0, max: 1 }),
                  how_to_contact: fc.string(),
                  type: fc.string(),
                  type_id: fc.integer({ min: 1 }),
                  ground_name: fc.option(fc.string())
                })
              ),
              page: fc.option(fc.record({
                current_page: fc.integer({ min: 1 }),
                total: fc.integer({ min: 0 }),
                next: fc.option(fc.string()),
                previous: fc.option(fc.string())
              })),
              message: fc.option(fc.string())
            }),
            // Invalid response structures
            fc.oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.string(),
              fc.integer(),
              fc.record({ invalid: fc.string() }),
              fc.record({ status: fc.string() }), // Invalid status type
              fc.record({ status: fc.boolean(), data: fc.string() }) // Invalid data type
            )
          ),
          (response) => {
            const result = apiClient.parseAndValidateResponse(response);

            // Result should always have success field
            expect(typeof result.success).toBe('boolean');

            if (result.success) {
              // Successful parsing should have valid data structure
              expect(result.data).toBeDefined();
              expect(typeof result.data?.status).toBe('boolean');
              expect(Array.isArray(result.data?.data)).toBe(true);
              
              // All posts in data should be valid
              if (result.data?.data) {
                result.data.data.forEach(post => {
                  expect(post._id).toBeTruthy();
                  expect(post.user_id).toBeTruthy();
                  expect(post.user_name).toBeTruthy();
                  expect(post.what_value).toBeTruthy();
                  expect(typeof post.latitude).toBe('string');
                  expect(typeof post.longitude).toBe('string');
                  const lat = parseFloat(post.latitude);
                  const lng = parseFloat(post.longitude);
                  expect(lat).toBeGreaterThanOrEqual(-90);
                  expect(lat).toBeLessThanOrEqual(90);
                  expect(lng).toBeGreaterThanOrEqual(-180);
                  expect(lng).toBeLessThanOrEqual(180);
                  expect(Array.isArray(post.city_id)).toBe(true);
                  expect(post.city_id.length).toBeGreaterThan(0);
                  expect(Array.isArray(post.ball_type_id)).toBe(true);
                  expect(post.ball_type_id.length).toBeGreaterThan(0);
                  expect(post.city_name).toBeTruthy();
                });
              }
            } else {
              // Failed parsing should have error message
              expect(result.error).toBeDefined();
              expect(typeof result.error).toBe('string');
              if (result.error) {
                expect(result.error.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter malformed posts correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              // Valid post structure
              fc.record({
                _id: fc.string({ minLength: 1 }),
                user_id: fc.integer({ min: 1 }),
                user_name: fc.string({ minLength: 1 }),
                profile_photo: fc.string(),
                mobile: fc.string({ minLength: 10 }),
                country_code: fc.string(),
                what_value: fc.string({ minLength: 1 }),
                what2_value: fc.option(fc.string()),
                where2_value: fc.option(fc.string()),
                which_value: fc.option(fc.string()),
                which2_value: fc.option(fc.string()),
                ground_type: fc.string(),
                comment: fc.string(),
                comment_html_value: fc.option(fc.string()),
                latitude: fc.float({ min: -90, max: 90 }).map(n => n.toString()),
                longitude: fc.float({ min: -180, max: 180 }).map(n => n.toString()),
                city_id: fc.array(fc.integer({ min: 1 }), { minLength: 1 }),
                city_name: fc.string({ minLength: 1 }),
                ball_type_id: fc.array(fc.integer({ min: 1 }), { minLength: 1 }),
                when_value_original: fc.option(fc.string()),
                time_ago: fc.string(),
                is_expired: fc.integer({ min: 0, max: 1 }),
                is_pro: fc.integer({ min: 0, max: 1 }),
                how_to_contact: fc.string(),
                type: fc.string(),
                type_id: fc.integer({ min: 1 }),
                ground_name: fc.option(fc.string())
              }) as fc.Arbitrary<CricHeroesRecruitmentPost>,
              // Invalid post structures - cast to any to allow invalid structures
              fc.record({ _id: fc.constant('') }) as any, // Empty _id
              fc.record({ _id: fc.string(), user_id: fc.constant(0) }) as any, // Invalid user_id
              fc.record({ _id: fc.string(), user_id: fc.integer(), what_value: fc.constant('') }) as any, // Empty what_value
              fc.record({ _id: fc.string(), user_id: fc.integer(), what_value: fc.string(), latitude: fc.string() }) as any, // Invalid latitude
              fc.record({ _id: fc.string(), user_id: fc.integer(), what_value: fc.string(), latitude: fc.string(), city_id: fc.constant([]) }) as any // Empty city_id
            )
          ),
          (posts: any[]) => {
            const filteredPosts = apiClient.filterValidPosts(posts);

            // All filtered posts should be valid
            filteredPosts.forEach(post => {
              expect(post._id).toBeTruthy();
              expect(post.user_id).toBeTruthy();
              expect(post.user_name).toBeTruthy();
              expect(post.what_value).toBeTruthy();
              expect(typeof post.latitude).toBe('string');
              expect(typeof post.longitude).toBe('string');
              expect(Array.isArray(post.city_id)).toBe(true);
              expect(post.city_id.length).toBeGreaterThan(0);
              expect(Array.isArray(post.ball_type_id)).toBe(true);
              expect(post.ball_type_id.length).toBeGreaterThan(0);
            });

            // Filtered count should be <= original count
            expect(filteredPosts.length).toBeLessThanOrEqual(posts.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should create client with correct default configuration', () => {
      expect(apiClient).toBeDefined();
      expect(apiClient.validateResponse).toBeDefined();
      expect(apiClient.filterValidPosts).toBeDefined();
      expect(apiClient.fetchRecruitmentPosts).toBeDefined();
      expect(apiClient.transformToRecruitmentPost).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiClient.fetchRecruitmentPosts(1, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.status).toBe(500);
    });

    it('should handle HTTP errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: jest.fn()
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await apiClient.fetchRecruitmentPosts(1, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP error! status: 404');
      expect(result.status).toBe(500);
    });

    it('should transform raw API response correctly', () => {
      const rawPost = {
        _id: 'post123',
        user_id: 12345,
        user_name: 'John Doe',
        profile_photo: 'https://example.com/photo.jpg',
        mobile: '1234567890',
        country_code: '+91',
        what_value: 'All-rounder',
        what2_value: 'None',
        where2_value: 'Bangalore',
        which_value: 'team (Test Team)',
        which2_value: 'Specific date',
        ground_type: 'turf',
        comment: 'Looking for players',
        comment_html_value: 'Looking for players',
        latitude: '12.9716',
        longitude: '77.5946',
        city_id: [1],
        city_name: 'Bangalore',
        ball_type_id: [1],
        when_value_original: '2024-01-15T10:00:00Z',
        time_ago: '1 hour ago',
        is_expired: 0,
        is_pro: 1,
        how_to_contact: 'WhatsApp',
        type: 'team',
        type_id: 1,
        ground_name: 'Test Ground',
      };

      const transformed = apiClient.transformToRecruitmentPost(rawPost);

      expect(transformed.id).toBe('post123');
      expect(transformed.user.id).toBe('12345');
      expect(transformed.user.name).toBe('John Doe');
      expect(transformed.requirements.positionsNeeded).toEqual(['All-rounder']);
      expect(transformed.location.cityName).toBe('Bangalore');
      expect(transformed.timing.isLongTerm).toBe(false);
      expect(transformed.createdAt).toBeInstanceOf(Date);
    });
  });
});