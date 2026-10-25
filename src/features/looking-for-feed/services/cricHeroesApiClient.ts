/**
 * CricHeroes API Client for Looking For Feed
 * 
 * This client handles API communication with CricHeroes recruitment posts endpoint
 * with proper authentication, request formatting, response validation, and retry mechanisms.
 */

import { RecruitmentPost } from '../types';
import { parseLooseDate, parseTimeAgo } from '../../../utils/dates';
import { defaultRetryManager, rateLimitRetryManager, RetryResult } from '../utils/retryUtils';
import { defaultCacheService, CacheService } from './cacheService';

// API Response interfaces
export interface CricHeroesApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface CricHeroesRecruitmentResponse {
  status: boolean;
  data: CricHeroesRecruitmentPost[];
  page?: {
    next?: string | null;
    previous?: string | null;
    total?: number;
    current_page?: number;
    last_page?: number;
  };
  message?: string;
}

// Raw API response structure from CricHeroes
export interface CricHeroesRecruitmentPost {
  _id: string;
  user_id: number;
  user_name: string;
  profile_photo: string;
  mobile: string;
  country_code: string;
  what_value: string; // position needed
  what2_value?: string;
  where2_value?: string; // location
  which_value?: string; // team name
  which2_value?: string; // timing type
  ground_type: string;
  comment: string;
  comment_html_value?: string;
  latitude: string;
  longitude: string;
  city_id: number[];
  city_name: string;
  ball_type_id: number[];
  when_value_original?: string;
  time_ago: string;
  is_expired: number;
  is_pro: number;
  how_to_contact: string;
  type: string;
  type_id: number;
  ground_name?: string;
}

export interface CricHeroesRequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export class CricHeroesApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly authorization: string;
  private readonly deviceId: string;
  private readonly userAgent: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly cacheService: CacheService;

  constructor(cacheService?: CacheService) {
    this.baseUrl = 'https://cricheroes.in/api/v1';
    this.apiKey = 'cr!CkH3r0s';
    this.authorization = 'd4f4dc30-4a88-11f0-939e-1b491f4b7e9e';
    this.deviceId = 'BFA05B08-7B26-548A-908F-3D09DB8D824E';
    this.userAgent = 'CricHeroes/11.7.2 (com.cricheroes.cricheroes; build:359; iOS 26.2.0) Alamofire/5.3.0';
    this.cacheService = cacheService || defaultCacheService;

    this.defaultHeaders = {
      'Host': 'cricheroes.in',
      'is-white-label': '0',
      'BBDFE7305E21531F2F4BD0C321BEDC37': 'EB6BCD0923CBDE33B64EA29A09095D06',
      '6f7da8dc0af66b4f815369934d1af9bf': 'C8EF6AB22D48B5B7AF7D05E0077F051BE7E8B8BD8B3F68A4E178D2007985ACC4955D512EE82CC2FAFAF72DE061D446B8',
      '14BF8AC398576A807F214B286E6506EA': 'CD4712042F72C1B9CF94C30715D3D72F',
      'User-Agent': this.userAgent,
      '59C5E215222C10EA43A0D10D72F431AB': '4D31C6A435757C8122D89172D9E3BF57',
      'app-environment': 'debug',
      'ios-version': '26.2.0',
      'udid': this.deviceId,
      '4E559607BC7F82FE9746AA76C388E6A0': '2A5E586E08B686CACB295746A5488D14',
      '9B1B3E6121CCB9BE642A921BD930EA9F': '062375E0A811ACDCAD9191BE418B9E74',
      'Connection': 'keep-alive',
      '069F4D735691EE67395EDE10ABE98533': '282F97FB5606B977D9DA326DEFFC67BF402384EC2CE21A5144F04349B50565F777215B492E59B59FA5E296DF092EAA42',
      'app-mode': 'alpha',
      '80D8DCE1C394894F2846D46D3767EA970CC8EE72A457C3AAA35F79627FD13728': '5409BD46FE98598D313E380AA77B60DE',
      'Authorization': this.authorization,
      'Accept-Language': 'en-US;q=1.0',
      'device-info': 'model:iPad Pro (12.9-inch) (3rd generation)',
      'device-type': 'ios',
      'Accept': 'application/json',
      'app-version': '11.7.2',
      'api-key': this.apiKey,
      'app-version-code': '359',
      'app-name': 'cricheroes',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make HTTP request to CricHeroes API with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    config: CricHeroesRequestConfig = {}
  ): Promise<CricHeroesApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 10000
    } = config;

    const url = `${this.baseUrl}${endpoint}`;
    const requestHeaders = { ...this.defaultHeaders, ...headers };

    // Use retry manager for the actual HTTP request
    const retryResult = await defaultRetryManager.executeWithRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check for rate limiting specifically
          if (response.status === 429) {
            const rateLimitError = new Error('Rate limit exceeded') as any;
            rateLimitError.status = 429;
            throw rateLimitError;
          }

          // Check for other HTTP errors
          if (!response.ok) {
            const httpError = new Error(`HTTP error! status: ${response.status}`) as any;
            httpError.status = response.status;
            throw httpError;
          }

          const data = await response.json();
          return { data, status: response.status };
        } catch (error) {
          clearTimeout(timeoutId);
          
          // Handle specific error types for retry logic
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              const timeoutError = new Error('Request timeout') as any;
              timeoutError.code = 'TIMEOUT';
              throw timeoutError;
            }
            
            // Network errors
            if (error.message.includes('fetch')) {
              const networkError = new Error('Network error') as any;
              networkError.code = 'NETWORK_ERROR';
              throw networkError;
            }
          }
          
          throw error;
        }
      },
      `CricHeroes API ${method} ${endpoint}`
    );

    if (retryResult.success && retryResult.data) {
      return {
        success: true,
        data: retryResult.data.data,
        status: retryResult.data.status,
      };
    } else {
      // If all retries failed, check if it was a rate limit issue
      if (retryResult.error?.includes('Rate limit')) {
        // Try with rate limit specific retry manager
        const rateLimitResult = await rateLimitRetryManager.executeWithRetry(
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
              method,
              headers: requestHeaders,
              body: body ? JSON.stringify(body) : undefined,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const httpError = new Error(`HTTP error! status: ${response.status}`) as any;
              httpError.status = response.status;
              throw httpError;
            }

            const data = await response.json();
            return { data, status: response.status };
          },
          `CricHeroes API Rate Limit Retry ${method} ${endpoint}`
        );

        if (rateLimitResult.success && rateLimitResult.data) {
          return {
            success: true,
            data: rateLimitResult.data.data,
            status: rateLimitResult.data.status,
          };
        }
      }

      return {
        success: false,
        error: retryResult.error || 'Request failed after retries',
        status: 500,
      };
    }
  }

  /**
   * Fetch recruitment posts from CricHeroes API with caching support
   */
  async fetchRecruitmentPosts(
    pageNo: number = 1,
    pageSize: number = 20,
    filters?: {
      cityId?: number;
      skillLevel?: string;
      teamType?: string;
      ballType?: string;
    },
    forceRefresh: boolean = false
  ): Promise<CricHeroesApiResponse<CricHeroesRecruitmentResponse>> {
    // Generate cache key based on parameters
    const cacheKey = this.cacheService.generatePostsKey(pageNo, pageSize, filters);
    
    // Try to get from cache first (unless force refresh is requested)
    if (!forceRefresh) {
      const cachedData = await this.cacheService.getCachedRecruitmentPosts(cacheKey);
      if (cachedData) {
        console.log(`[CricHeroesApiClient] Returning cached data for page ${pageNo}`);
        return {
          success: true,
          data: cachedData,
          status: 200,
        };
      }
    }

    // If not in cache or force refresh, fetch from API
    const queryParams = new URLSearchParams({
      cityid: filters?.cityId?.toString() || '1798', // Use Bangalore as default
      typeid: '1', // Default type ID for looking for feed
      // CHANGED: send the page (it was only part of the cache key, so "load more" refetched page 1).
      pageno: String(pageNo),
      pagesize: String(pageSize),
    });

    // Add other filters if provided
    if (filters) {
      if (filters.skillLevel) queryParams.append('skill_level', filters.skillLevel);
      if (filters.teamType) queryParams.append('team_type', filters.teamType);
      if (filters.ballType) queryParams.append('ball_type', filters.ballType);
    }

    const endpoint = `/looking/get-looking-for-feed?${queryParams.toString()}`;

    const response = await this.makeRequest<any>(endpoint);

    if (!response.success) {
      // If API fails, try to return stale cache data as fallback
      const staleData = await this.cacheService.getCachedRecruitmentPosts(cacheKey);
      if (staleData) {
        console.warn(`[CricHeroesApiClient] API failed, returning stale cached data for page ${pageNo}`);
        return {
          success: true,
          data: staleData,
          status: 200,
        };
      }
      return response;
    }

    // Parse and validate the response
    const parsedResponse = this.parseAndValidateResponse(response.data);
    
    if (parsedResponse.success && parsedResponse.data) {
      // Cache the successful response
      await this.cacheService.cacheRecruitmentPosts(cacheKey, parsedResponse.data);
      
      // Also cache individual posts for quick access (one batched write, not one per post)
      const posts: RecruitmentPost[] = [];
      for (const rawPost of parsedResponse.data.data) {
        try {
          posts.push(this.transformToRecruitmentPost(rawPost));
        } catch (error) {
          console.warn('[CricHeroesApiClient] Failed to cache individual post:', error);
        }
      }
      await this.cacheService.cachePosts(posts);
    }
    
    return {
      success: parsedResponse.success,
      data: parsedResponse.data,
      error: parsedResponse.error,
      status: response.status,
    };
  }

  /**
   * Parse and validate API response with error logging
   */
  parseAndValidateResponse(rawData: any): CricHeroesApiResponse<CricHeroesRecruitmentResponse> {
    try {
      // Validate response structure
      if (!this.validateResponse(rawData)) {
        console.error('Invalid API response structure:', rawData);
        return {
          success: false,
          error: 'Invalid response structure from API',
        };
      }

      // If API returned error status
      if (!rawData.status) {
        console.warn('API returned error status:', rawData);
        return {
          success: false,
          error: rawData.message || 'API request failed',
        };
      }

      // Filter out malformed posts and log errors
      const validPosts = this.filterValidPosts(rawData.data || []);
      const filteredCount = (rawData.data || []).length - validPosts.length;
      
      if (filteredCount > 0) {
        console.warn(`Filtered out ${filteredCount} malformed posts from API response`);
      }

      console.log(`[CricHeroesApiClient] Successfully parsed ${validPosts.length} valid posts`);

      const validatedResponse: CricHeroesRecruitmentResponse = {
        status: rawData.status,
        data: validPosts,
        page: rawData.page || null,
        message: rawData.message,
      };

      return {
        success: true,
        data: validatedResponse,
      };
    } catch (error) {
      console.error('Error parsing API response:', error, { rawData });
      return {
        success: false,
        error: 'Failed to parse API response',
      };
    }
  }

  /**
   * Transform raw CricHeroes API response to our domain model
   */
  transformToRecruitmentPost(rawPost: CricHeroesRecruitmentPost): RecruitmentPost {
    const now = new Date();
    // Unparseable dates are dropped rather than becoming Invalid Date.
    const matchDate = parseLooseDate(rawPost.when_value_original);
    const timeAgo = typeof rawPost.time_ago === 'string' && rawPost.time_ago.trim() ? rawPost.time_ago.trim() : undefined;

    return {
      id: rawPost._id,
      user: {
        id: rawPost.user_id.toString(),
        name: rawPost.user_name,
        profilePhoto: rawPost.profile_photo,
        contactDetails: {
          phone: rawPost.mobile,
          whatsapp: rawPost.mobile, // Use mobile as whatsapp
        },
        rating: rawPost.is_pro ? 4.5 : undefined, // Pro users get higher rating
      },
      requirements: {
        positionsNeeded: [rawPost.what_value], // Single position from what_value
        skillLevel: this.mapSkillLevel('intermediate'), // Default to intermediate
        teamType: this.mapTeamType('casual'), // Default to casual
        description: rawPost.comment || '',
      },
      matchDetails: {
        ballType: this.mapBallTypeFromId(rawPost.ball_type_id[0] || 1),
        groundType: this.mapGroundTypeFromString(rawPost.ground_type),
        matchFormat: this.mapMatchFormat('t20'), // Default to T20
        comments: rawPost.comment || '',
      },
      location: {
        latitude: parseFloat(rawPost.latitude),
        longitude: parseFloat(rawPost.longitude),
        cityId: rawPost.city_id[0] || 0,
        cityName: rawPost.city_name,
        venue: rawPost.where2_value || rawPost.ground_name,
      },
      timing: {
        isLongTerm: rawPost.which2_value === 'Long Term',
        specificDates: matchDate ? [matchDate] : undefined,
        preferredTimes: [{
          startTime: '09:00', // Default time
          endTime: '17:00',   // Default time
        }],
      },
      // Derived from the API's relative "time_ago" label; falls back to now.
      createdAt: parseTimeAgo(rawPost.time_ago, now) ?? now,
      updatedAt: now,
      ...(timeAgo ? { timeAgo } : {}),
    };
  }

  /**
   * Map string skill level to enum
   */
  private mapSkillLevel(skillLevel: string) {
    const { SkillLevel } = require('../types');
    switch (skillLevel.toLowerCase()) {
      case 'beginner': return SkillLevel.BEGINNER;
      case 'intermediate': return SkillLevel.INTERMEDIATE;
      case 'advanced': return SkillLevel.ADVANCED;
      case 'professional': return SkillLevel.PROFESSIONAL;
      default: return SkillLevel.INTERMEDIATE;
    }
  }

  /**
   * Map string team type to enum
   */
  private mapTeamType(teamType: string) {
    const { TeamType } = require('../types');
    switch (teamType.toLowerCase()) {
      case 'casual': return TeamType.CASUAL;
      case 'competitive': return TeamType.COMPETITIVE;
      case 'tournament': return TeamType.TOURNAMENT;
      case 'league': return TeamType.LEAGUE;
      default: return TeamType.CASUAL;
    }
  }

  /**
   * Map ball type ID to enum
   */
  private mapBallTypeFromId(ballTypeId: number) {
    const { BallType } = require('../types');
    switch (ballTypeId) {
      case 1: return BallType.LEATHER;
      case 2: return BallType.TENNIS;
      case 3: return BallType.RUBBER;
      case 4: return BallType.PLASTIC;
      default: return BallType.TENNIS;
    }
  }

  /**
   * Map ground type string to enum
   */
  private mapGroundTypeFromString(groundType: string) {
    const { GroundType } = require('../types');
    const lowerType = groundType.toLowerCase();
    if (lowerType.includes('turf')) return GroundType.TURF;
    if (lowerType.includes('matting')) return GroundType.MATTING;
    if (lowerType.includes('concrete')) return GroundType.CONCRETE;
    if (lowerType.includes('grass')) return GroundType.GRASS;
    return GroundType.TURF; // Default
  }

  /**
   * Map string match format to enum
   */
  private mapMatchFormat(matchFormat: string) {
    const { MatchFormat } = require('../types');
    switch (matchFormat.toLowerCase()) {
      case 't20': return MatchFormat.T20;
      case 'odi': return MatchFormat.ODI;
      case 'test': return MatchFormat.TEST;
      case 't10': return MatchFormat.T10;
      case 'hundred': return MatchFormat.HUNDRED;
      default: return MatchFormat.T20;
    }
  }

  /**
   * Validate API response structure
   */
  validateResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      console.error('Response validation failed: not an object', { response });
      return false;
    }

    // Check if response has required structure
    if (typeof response.status !== 'boolean') {
      console.error('Response validation failed: missing or invalid status field', { response });
      return false;
    }

    // If status is true, data should be an array
    if (response.status && !Array.isArray(response.data)) {
      console.error('Response validation failed: data should be array when status is true', { response });
      return false;
    }

    // If status is false, there might be a message
    if (!response.status && response.data && !Array.isArray(response.data)) {
      console.warn('Response validation warning: unexpected data format for error response', { response });
    }

    return true;
  }

  /**
   * Get cached recruitment post by ID
   */
  async getCachedPost(postId: string): Promise<RecruitmentPost | null> {
    return await this.cacheService.getCachedPost(postId);
  }

  /**
   * Check if cache is stale for given parameters
   */
  async isCacheStale(
    pageNo: number = 1,
    pageSize: number = 20,
    filters?: {
      cityId?: number;
      skillLevel?: string;
      teamType?: string;
      ballType?: string;
    },
    staleThreshold?: number
  ): Promise<boolean> {
    const cacheKey = this.cacheService.generatePostsKey(pageNo, pageSize, filters);
    return await this.cacheService.isCacheStale(cacheKey, staleThreshold);
  }

  /**
   * Invalidate cache for specific parameters
   */
  async invalidateCache(
    pageNo: number = 1,
    pageSize: number = 20,
    filters?: {
      cityId?: number;
      skillLevel?: string;
      teamType?: string;
      ballType?: string;
    }
  ): Promise<void> {
    const cacheKey = this.cacheService.generatePostsKey(pageNo, pageSize, filters);
    await this.cacheService.invalidateCache(cacheKey);
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    await this.cacheService.clearAllCache();
  }

  /**
   * Filter out malformed posts and log errors
   */
  filterValidPosts(posts: CricHeroesRecruitmentPost[]): CricHeroesRecruitmentPost[] {
    if (!Array.isArray(posts)) {
      console.error('filterValidPosts: input is not an array', { posts });
      return [];
    }

    return posts.filter(post => {
      try {
        // Validate required fields
        if (!post._id || !post.user_id || !post.user_name) {
          console.warn('Invalid post: missing required user fields', { postId: post._id });
          return false;
        }

        if (!post.what_value || typeof post.what_value !== 'string') {
          console.warn('Invalid post: missing or invalid what_value (position)', { postId: post._id });
          return false;
        }

        if (!post.latitude || !post.longitude) {
          console.warn('Invalid post: missing location coordinates', { postId: post._id });
          return false;
        }

        // Validate coordinate ranges
        const lat = parseFloat(post.latitude);
        const lng = parseFloat(post.longitude);
        
        if (isNaN(lat) || lat < -90 || lat > 90) {
          console.warn('Invalid post: latitude out of range', { postId: post._id, latitude: post.latitude });
          return false;
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
          console.warn('Invalid post: longitude out of range', { postId: post._id, longitude: post.longitude });
          return false;
        }

        // Validate required string fields
        const requiredStringFields = ['user_name', 'city_name'];
        for (const field of requiredStringFields) {
          if (!post[field as keyof CricHeroesRecruitmentPost] || typeof post[field as keyof CricHeroesRecruitmentPost] !== 'string') {
            console.warn(`Invalid post: missing or invalid ${field}`, { postId: post._id, [field]: post[field as keyof CricHeroesRecruitmentPost] });
            return false;
          }
        }

        // Validate required array fields
        if (!Array.isArray(post.city_id) || post.city_id.length === 0) {
          console.warn('Invalid post: invalid city_id array', { postId: post._id, city_id: post.city_id });
          return false;
        }

        if (!Array.isArray(post.ball_type_id) || post.ball_type_id.length === 0) {
          console.warn('Invalid post: invalid ball_type_id array', { postId: post._id, ball_type_id: post.ball_type_id });
          return false;
        }

        return true;
      } catch (error) {
        console.error('Error validating post:', error, { postId: post?._id });
        return false;
      }
    });
  }
}

export default new CricHeroesApiClient();