/**
 * API Service Module
 * 
 * This module provides methods to make API calls that replicate cURL requests
 * with the same parameters, headers, and cookies.
 */

import type { Match, TeamMatchResponse, MatchSummary, TeamInnings } from '../types/Match';
import type { Ground, GroundDetailResponse } from '../types/Ground';

// Core interfaces
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface PaginationInfo {
  next?: string | null;
  previous?: string | null;
  total?: number;
  current_page?: number;
  last_page?: number;
}

export interface MatchResponse {
  matches: Match[];
  page: PaginationInfo | null;
  status?: string;
  config?: unknown;
}

interface PlayerStatItem {
  title: string;
  value: string | number;
}


interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

class ApiService {
  private readonly baseApiUrl: string;
  private readonly baseSiteUrl: string;
  private nextJsBuildId: string | null = null;
  private readonly requestCache: Map<string, { data: unknown; timestamp: number }>;
  private lastRequestTime: number;
  private readonly minRequestInterval: number;
  private rateLimitInfo: {
    limit: number | null;
    remaining: number | null;
    reset: number | null;
    retryAfter: number | null;
    lastUpdated: number | null;
  };
  private readonly cricHeroesHeaders: Record<string, string>;
  private readonly cookies: string;
  constructor() {
    this.baseApiUrl = 'https://api.cricheroes.in/api/v1';
    this.baseSiteUrl = 'https://cricheroes.com';

    // Request throttling and caching
    this.requestCache = new Map();
    this.lastRequestTime = 0;
    this.minRequestInterval = 500; // Minimum 500ms between requests

    // Rate limit tracking
    this.rateLimitInfo = {
      limit: null,
      remaining: null,
      reset: null,
      retryAfter: null,
      lastUpdated: null
    };

    // Common headers for CricHeroes API
    this.cricHeroesHeaders = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9,gu;q=0.8,ja;q=0.7',
      'api-key': 'cr!CkH3r0s',
      'authorization': '167a0e60-4ecf-11f0-9aaf-65c0aaccdb8b',
      'device-type': 'Chrome: 137.0.0.0',
      'dnt': '1',
      'origin': 'https://cricheroes.com',
      'priority': 'u=1, i',
      'referer': 'https://cricheroes.com/',
      'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'udid': 'b06d1d63f90cf3493b39e534c59b6935',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    };

    // Cookies for authentication (keeping these for specific endpoints that need them)
    this.cookies = [
      'udid=b06d1d63f90cf3493b39e534c59b6935',
      'Authorization=d65d0380-4ec1-11f0-beae-1ffc65a06b34',
      'current_user=%7B%22user_id%22%3A33835174%2C%22country_id%22%3A1%2C%22country_code%22%3A%22%2B91%22%2C%22mobile%22%3A%228484996704%22%2C%22name%22%3A%22Sanket%20Mokashi%22%7D',
    ].join('; ');
  }

  /**
   * Throttle requests to prevent rate limiting
   */
  async throttleRequest() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get cached response or null if not found/expired
   */
  getCachedResponse(cacheKey: string, maxAge: number = 30000): any { // 30 seconds default cache
    const cached = this.requestCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < maxAge) {
      console.log('Using cached response for:', cacheKey);
      return cached.data;
    }
    return null;
  }

  /**
   * Cache response data
   */
  setCachedResponse(cacheKey: string, data: any): void {
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Generate equivalent cURL command for debugging
   */
  generateCurlCommand(url: string, options: { method?: string; headers?: Record<string,string>; body?: any }): string {
    const { method = 'GET', headers = {}, body } = options;

    let curlCommand = `curl -X ${method.toUpperCase()}`;

    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curlCommand += ` \\\n  -H "${key}: ${value}"`;
    });

    // Add body if present
    if (body) {
      if (typeof body === 'string') {
        curlCommand += ` \\\n  -d '${body}'`;
      } else {
        curlCommand += ` \\\n  -d '${JSON.stringify(body)}'`;
      }
    }

    // Add URL
    curlCommand += ` \\\n  "${url}"`;

    return curlCommand;
  }

  /**
   * Make request with throttling but no automatic retries
   */
  async makeRequestWithRetry(url: string, options: RequestOptions): Promise<Response> {
    await this.throttleRequest();

    const response = await fetch(url, options);

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait and use the refresh button to try again.');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Log response details
    console.log(`📡 API Response [${response.status}]:`, {
      url: url.split('?')[0], // Show base URL without query params
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });

    // Update rate limit info
    this.updateRateLimitInfo(response.headers);

    return response;
  }

  /**
   * Update rate limit info from response headers
   */
  updateRateLimitInfo(headers: Headers): void {
    const rateLimitHeader = headers.get('x-ratelimit-limit');
    const rateLimitRemainingHeader = headers.get('x-ratelimit-remaining');
    const rateLimitResetHeader = headers.get('x-ratelimit-reset');
    const retryAfterHeader = headers.get('retry-after');

    if (rateLimitHeader) {
      this.rateLimitInfo.limit = parseInt(rateLimitHeader);
    }

    if (rateLimitRemainingHeader) {
      this.rateLimitInfo.remaining = parseInt(rateLimitRemainingHeader);
    }

    if (rateLimitResetHeader) {
      this.rateLimitInfo.reset = parseInt(rateLimitResetHeader);
    }

    if (retryAfterHeader) {
      this.rateLimitInfo.retryAfter = parseInt(retryAfterHeader);
    }

    this.rateLimitInfo.lastUpdated = Date.now();

    // Log rate limit info for debugging
    console.log('📊 Rate Limit Info:', {
      limit: this.rateLimitInfo.limit,
      remaining: this.rateLimitInfo.remaining,
      reset: this.rateLimitInfo.reset ? new Date(this.rateLimitInfo.reset * 1000).toISOString() : null,
      retryAfter: this.rateLimitInfo.retryAfter
    });
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo() {
    return this.rateLimitInfo;
  }

  /**
   * Shared fetch/cache/error handler for paginated endpoints
   */
  private async _fetchAndCache<T = any>(
    url: string,
    cacheKey: string,
    extractData: (data: any) => T,
    cacheMaxAge = 15000,
    requestOptions: RequestOptions = { method: 'GET', headers: this.cricHeroesHeaders },
  ): Promise<ApiResponse<T>> {
    // Check cache first
    const cached = this.getCachedResponse(cacheKey, cacheMaxAge);
    if (cached) return cached;
    try {
      const response = await this.makeRequestWithRetry(url, requestOptions);
      const data = await response.json();
      const result = {
        success: true,
        data: extractData(data),
        status: response.status,
      };
      this.setCachedResponse(cacheKey, result);
      return result;
    } catch (error) {
      const { normalizeApiError } = await import('../utils/normalizeApiError');
      const errMsg = normalizeApiError(error);
      return { success: false, error: errMsg, status: 500 };
    }
  }

  /**
   * Private unified method to fetch matches from the API with shared caching
   * This ensures the API is only called once for the same parameters regardless of which public method is used
   * @param {number} pageNo - Page number (1-based)
   * @param {number} pageSize - Number of matches per page
   * @param {number} datetime - Timestamp for consistency
   * @returns {Promise} - Raw API response
   */
  private async _getMatchesUnified(pageNo = 1, pageSize = 60, datetime = Date.now()) {
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetime}`;
    // Use unified cache key based on actual API parameters to prevent duplicate calls
    const cacheKey = `unified_matches_${pageNo}_${pageSize}_${Math.floor(datetime / 30000)}`; // 30s cache window

    return this._fetchAndCache(
      url,
      cacheKey,
      (data) => data, // Return raw data for processing by individual methods
      30000, // 30 second cache to avoid 429 errors
      {
        method: 'GET',
        headers: { ...this.cricHeroesHeaders, 'cookie': this.cookies },
      }
    );
  }

  /**
   * Fetch matches with pagination and caching
   * @param {number} pageNo - Page number (1-based)
   * @param {number} pageSize - Number of matches per page
   * @returns {Promise} - API response with matches data
   */
  async getMatches(pageNo = 1, pageSize = 60) {
    const datetime = Date.now();
    const result = await this._getMatchesUnified(pageNo, pageSize, datetime);

    if (!result.success) {
      return result;
    }

    // Map the API response to our expected format
    const matches = (result.data.data || []).map((match: any) => ({
      id: match.match_id,
      match_id: match.match_id,
      tournament_name: match.tournament_name || '',
      tournament_round_name: match.tournament_round_name,
      round_name: match.tournament_round_name,
      status: match.status,
      team_a: match.team_a,
      team_b: match.team_b,
      team1_name: match.team_a,
      team2_name: match.team_b,
      match_summary: match.match_summary,
      match_type: match.match_type,
      match_format: match.match_type,
      overs: match.overs,
      ground_name: match.ground_name,
      ground_id: match.ground_id,
      match_start_time: match.match_start_time,
      start_time: match.match_start_time,
      match_result: match.match_result,
      team1: match.team_a_id ? {
        id: match.team_a_id,
        name: match.team_a,
        short_name: match.team_a
      } : undefined,
      team2: match.team_b_id ? {
        id: match.team_b_id,
        name: match.team_b,
        short_name: match.team_b
      } : undefined,
      // Add score data for live and past matches - improved logic to handle more field variations
      team1_score: (match.status === 'live' || match.status === 'past') && (
        match.team_a_score || match.team1_score || 
        match.team_a_runs !== undefined || match.team1_runs !== undefined ||
        (match.team_a_runs !== null && match.team_a_runs !== undefined) ||
        (match.team1_runs !== null && match.team1_runs !== undefined)
      ) ? {
        runs: match.team_a_runs || match.team1_runs || match.team_a_score?.runs || 0,
        wickets: match.team_a_wickets || match.team1_wickets || match.team_a_score?.wickets || 0,
        overs: match.team_a_overs || match.team1_overs || match.team_a_score?.overs || match.overs || '20.0',
        summary: match.team_a_score_summary || match.team1_score_summary || match.team_a_score?.summary
      } : undefined,
      team2_score: (match.status === 'live' || match.status === 'past') && (
        match.team_b_score || match.team2_score || 
        match.team_b_runs !== undefined || match.team2_runs !== undefined ||
        (match.team_b_runs !== null && match.team_b_runs !== undefined) ||
        (match.team2_runs !== null && match.team2_runs !== undefined)
      ) ? {
        runs: match.team_b_runs || match.team2_runs || match.team_b_score?.runs || 0,
        wickets: match.team_b_wickets || match.team2_wickets || match.team_b_score?.wickets || 0,
        overs: match.team_b_overs || match.team2_overs || match.team_b_score?.overs || match.overs || '20.0',
        summary: match.team_b_score_summary || match.team2_score_summary || match.team_b_score?.summary
      } : undefined,
    }));

    return {
      success: true,
      data: {
        matches,
        page: result.data.page || null
      },
      status: result.status
    };
  }

  /**
   * Fetch player statistics from CricHeroes API
   * @param {string} playerId - Player ID (default: 33835174)
   * @param {number} pageSize - Number of stats per page (default: 12)
   * @returns {Promise} - API response with player statistics
   */
  async getPlayerStats(playerId = '33835174', pageSize = 12) {
    const url = `${this.baseApiUrl}/player/get-player-statistic/${playerId}?pagesize=${pageSize}`;
    const cacheKey = `player_stats_${playerId}_${pageSize}`;

    return this._fetchAndCache(
      url,
      cacheKey,
      (data) => data,
      15000,
      {
        method: 'GET',
        headers: this.cricHeroesHeaders,
      }
    );
  }

  /**
   * Fetch the latest build ID from CricHeroes website
   * @private
   */
  private async fetchBuildId(): Promise<string> {
    if (this.nextJsBuildId) {
      return this.nextJsBuildId;
    }

    try {
      const response = await fetch(this.baseSiteUrl, {
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch build ID: HTTP ${response.status}`);
      }

      const html = await response.text();
      const buildIdMatch = html.match(/\/_next\/static\/([^/]+)\/_buildManifest\.js/);

      if (!buildIdMatch || !buildIdMatch[1]) {
        throw new Error('Could not extract build ID from HTML');
      }

      this.nextJsBuildId = buildIdMatch[1];
      return this.nextJsBuildId;
    } catch (error) {
      console.error('Error fetching build ID, using fallback:', error);
      // Fallback to a known working build ID if available
      return '3lZSsO4Y198VrvIsAf8dt';
    }
  }

  /**
   * Fetch match scorecard from CricHeroes API
   * @param matchId - Match ID
   * @param tournamentName - Tournament name (not used in new API)
   * @param teamNames - Team names (not used in new API)
   * @returns Promise with match scorecard data
   */
  public async getMatchScorecard(
    matchId: string | number,
    tournamentName: string,
    teamNames: string
  ): Promise<ApiResponse<unknown>> {
    // Use the new API endpoint
    const url = `https://api.cricheroes.in/api/v1/scorecard/get-scorecard/${matchId}`;
    const cacheKey = `match_scorecard_${matchId}`;

    // Headers from the new API curl command
    const scorecardHeaders = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9,gu;q=0.8,ja;q=0.7',
      'api-key': 'cr!CkH3r0s',
      'authorization': '167a0e60-4ecf-11f0-9aaf-65c0aaccdb8b',
      'device-type': 'Chrome: 137.0.0.0',
      'dnt': '1',
      'origin': 'https://cricheroes.com',
      'priority': 'u=1, i',
      'referer': 'https://cricheroes.com/',
      'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'udid': 'b06d1d63f90cf3493b39e534c59b6935',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    };

    try {
      console.log('Fetching match scorecard from new API:', { matchId, url });

      const response = await this.makeRequestWithRetry(url, {
        method: 'GET',
        headers: scorecardHeaders,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiData = await response.json();

      // Transform the new API response to match the expected format
      // The new API returns data in a different structure: { status, data: { team_a, team_b, ... } }
      // We need to convert this to the expected pageProps.scorecard format with complete details
      let scorecardArray = [];

      if (apiData.status && apiData.data) {
        const matchData = apiData.data;

        // Extract complete scorecard data from both teams
        if (matchData.team_a) {
          const teamAData = {
            teamName: matchData.team_a.name,
            teamId: matchData.team_a.id,
            teamLogo: matchData.team_a.logo,
            shortName: matchData.team_a.short_name,
            summary: matchData.team_a.summary,
            inning: matchData.team_a.innings?.[0] || {},
            captain: matchData.team_a.captain_info,
            wicketKeeper: matchData.team_a.wicket_keeper_info,
            // Complete scorecard data
            batting: matchData.team_a.scorecard?.[0]?.batting || [],
            bowling: matchData.team_a.scorecard?.[0]?.bowling || [],
            extras: matchData.team_a.scorecard?.[0]?.extras || { total: 0, summary: '', data: [] },
            toBeBat: matchData.team_a.scorecard?.[0]?.to_be_bat || [],
            fallOfWicket: matchData.team_a.scorecard?.[0]?.fall_of_wicket || { summary: '', data: [] },
            partnership: matchData.team_a.scorecard?.[0]?.partnership || [],
            powerPlay: matchData.team_a.scorecard?.[0]?.power_play || [],
          };
          scorecardArray.push(teamAData);
        }

        if (matchData.team_b) {
          const teamBData = {
            teamName: matchData.team_b.name,
            teamId: matchData.team_b.id,
            teamLogo: matchData.team_b.logo,
            shortName: matchData.team_b.short_name,
            summary: matchData.team_b.summary,
            inning: matchData.team_b.innings?.[0] || {},
            captain: matchData.team_b.captain_info,
            wicketKeeper: matchData.team_b.wicket_keeper_info,
            // Complete scorecard data
            batting: matchData.team_b.scorecard?.[0]?.batting || [],
            bowling: matchData.team_b.scorecard?.[0]?.bowling || [],
            extras: matchData.team_b.scorecard?.[0]?.extras || { total: 0, summary: '', data: [] },
            toBeBat: matchData.team_b.scorecard?.[0]?.to_be_bat || [],
            fallOfWicket: matchData.team_b.scorecard?.[0]?.fall_of_wicket || { summary: '', data: [] },
            partnership: matchData.team_b.scorecard?.[0]?.partnership || [],
            powerPlay: matchData.team_b.scorecard?.[0]?.power_play || [],
          };
          scorecardArray.push(teamBData);
        }
      }

      const transformedData = {
        pageProps: {
          scorecard: scorecardArray,
          matchData: apiData.data, // Keep original match data for additional info
          // Additional match details
          matchInfo: {
            matchId: apiData.data?.match_id,
            matchType: apiData.data?.match_type,
            status: apiData.data?.status,
            overs: apiData.data?.overs,
            ballType: apiData.data?.ball_type,
            groundName: apiData.data?.ground_name,
            cityName: apiData.data?.city_name,
            startDateTime: apiData.data?.start_datetime,
            tournamentName: apiData.data?.tournament_name,
            tournamentRound: apiData.data?.tournament_round_name,
            tossDetails: apiData.data?.toss_details,
            matchSummary: apiData.data?.match_summary,
            winBy: apiData.data?.win_by,
            winningTeam: apiData.data?.winning_team,
            matchResult: apiData.data?.match_result,
            currentInning: apiData.data?.current_inning,
            matchInning: apiData.data?.match_inning,
            isSuperOver: apiData.data?.is_super_over,
            isDl: apiData.data?.is_dl,
          }
        },
      };

      const result = {
        success: true,
        data: transformedData,
        status: response.status,
      };

      // Cache the response
      this.setCachedResponse(cacheKey, result);

      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to fetch match scorecard:', error.message);
        return {
          success: false,
          error: error.message,
          status: 500,
        };
      } else {
        console.error('Unknown error fetching match scorecard:', error);
        return {
          success: false,
          error: 'Unknown error occurred while fetching match scorecard',
          status: 500,
        };
      }
    }
  }

  /**
   * Fetch player matches from CricHeroes API
   * @param {string} playerId - Player ID (default: 33835174)
   * @param {number} pageSize - Number of matches per page (default: 12)
   * @returns {Promise} - API response with player matches
   */
  async getPlayerMatches(pageNo = 1, pageSize = 60, datetime = null): Promise<MatchResponse> {
    const datetimeParam = datetime || Date.now();
    const result = await this._getMatchesUnified(pageNo, pageSize, datetimeParam);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch matches');
    }

    return {
      matches: result.data.data || [],
      page: result.data.page || null,
      status: result.data.status || 'success',
      config: result.data.config || {}
    };
  }

  /**
   * Fetch matches using provided next/previous URL
   * @param {string} pageUrl - Full URL path (e.g., "/match/get-my-web-Matches?pagesize=20&pageno=4&datetime=1750531179447")
   * @returns {Promise<Object>} API response with matches and page info
   */
  async fetchMatchesFromUrl(pageUrl: string): Promise<MatchResponse> {
    if (!pageUrl) {
      throw new Error('No URL provided');
    }

    // Handle both relative and absolute URLs
    let fullUrl: string;
    if (pageUrl.startsWith('http')) {
      // Already a full URL
      fullUrl = pageUrl;
    } else {
      // Relative URL - construct full URL
      const cleanUrl = pageUrl.startsWith('/') ? pageUrl.substring(1) : pageUrl;
      fullUrl = `${this.baseApiUrl}/${cleanUrl}`;
    }

    const cacheKey = `matches_url_${encodeURIComponent(pageUrl)}`;
    const result = await this._fetchAndCache(
      fullUrl,
      cacheKey,
      (data) => ({
        matches: data?.data || [],
        page: data?.page || null,
        status: data?.status || 'success',
        config: data?.config || {}
      }),
      15000,
      {
        method: 'GET',
        headers: this.cricHeroesHeaders,
      }
    );

    if (!result.data) {
      throw new Error('Failed to fetch matches from URL: No data returned from API');
    }

    return result.data;
  }

  /**
   * Unified method to get upcoming and live matches with shared caching
   * This prevents duplicate API calls when switching between Upcoming and Live tabs
   * @param {number} pageNo - Page number (1-based)
   * @param {number} pageSize - Number of matches per page
   * @returns {Promise} - API response with both upcoming and live matches
   */
  async getUpcomingAndLiveMatches(pageNo = 1, pageSize = 60) {
    const datetime = Date.now();
    const result = await this._getMatchesUnified(pageNo, pageSize, datetime);

    if (!result.success) {
      return result;
    }

    // Map the API response to our expected format
    const allMatches = (result.data.data || []).map((match: any) => ({
      id: match.match_id,
      match_id: match.match_id,
      tournament_name: match.tournament_name || '',
      tournament_round_name: match.tournament_round_name,
      round_name: match.tournament_round_name,
      status: match.status,
      team_a: match.team_a,
      team_b: match.team_b,
      team1_name: match.team_a,
      team2_name: match.team_b,
      match_summary: match.match_summary,
      match_type: match.match_type,
      match_format: match.match_type,
      overs: match.overs,
      ground_name: match.ground_name,
      ground_id: match.ground_id,
      match_start_time: match.match_start_time,
      start_time: match.match_start_time,
      match_result: match.match_result,
      team1: match.team_a_id ? {
        id: match.team_a_id,
        name: match.team_a,
        short_name: match.team_a
      } : undefined,
      team2: match.team_b_id ? {
        id: match.team_b_id,
        name: match.team_b,
        short_name: match.team_b
      } : undefined,
      // Add score data for live and past matches
      team1_score: (match.status === 'live' || match.status === 'past') && (match.team_a_score || match.team1_score || match.team_a_runs !== undefined) ? {
        runs: match.team_a_runs || match.team1_runs || match.team_a_score?.runs || 0,
        wickets: match.team_a_wickets || match.team1_wickets || match.team_a_score?.wickets || 0,
        overs: match.team_a_overs || match.team1_overs || match.team_a_score?.overs || match.overs || '20.0',
        summary: match.team_a_score_summary || match.team1_score_summary || match.team_a_score?.summary
      } : undefined,
      team2_score: (match.status === 'live' || match.status === 'past') && (match.team_b_score || match.team2_score || match.team_b_runs !== undefined) ? {
        runs: match.team_b_runs || match.team2_runs || match.team_b_score?.runs || 0,
        wickets: match.team_b_wickets || match.team2_wickets || match.team_b_score?.wickets || 0,
        overs: match.team_b_overs || match.team2_overs || match.team_b_score?.overs || match.overs || '20.0',
        summary: match.team_b_score_summary || match.team2_score_summary || match.team_b_score?.summary
      } : undefined,
    }));

    // Separate upcoming and live matches
    const upcomingMatches = allMatches.filter((match: any) => match.status === 'upcoming');
    const liveMatches = allMatches.filter((match: any) => match.status === 'live');

    return {
      success: true,
      data: {
        allMatches,
        upcomingMatches,
        liveMatches,
        page: result.data.page || null,
        status: result.data.status || 'success',
        config: result.data.config || {}
      },
      status: result.status
    };
  }

  /**
   * Get upcoming matches from cached data
   * @param {number} pageNo - Page number (1-based)  
   * @param {number} pageSize - Number of matches per page
   * @returns {Promise} - API response with upcoming matches only
   */
  async getUpcomingMatches(pageNo = 1, pageSize = 60) {
    const result = await this.getUpcomingAndLiveMatches(pageNo, pageSize);
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          matches: result.data.upcomingMatches,
          page: result.data.page
        },
        status: result.status
      };
    }
    return { success: false, error: result.error || 'Failed to load upcoming matches', status: 500 };
  }

  /**
   * Get live matches from cached data
   * @param {number} pageNo - Page number (1-based)
   * @param {number} pageSize - Number of matches per page  
   * @returns {Promise} - API response with live matches only
   */
  async getLiveMatches(pageNo = 1, pageSize = 60) {
    const result = await this.getUpcomingAndLiveMatches(pageNo, pageSize);
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          matches: result.data.liveMatches,
          page: result.data.page
        },
        status: result.status
      };
    }
    return { success: false, error: result.error || 'Failed to load live matches', status: 500 };
  }

  /**
   * Clear the cache for upcoming and live matches
   * Useful for manual refresh or when encountering errors
   */
  clearUpcomingLiveCache() {
    const keysToDelete = Array.from(this.requestCache.keys()).filter(key => 
      key.startsWith('upcoming_live_matches_') || key.startsWith('unified_matches_')
    );
    keysToDelete.forEach(key => this.requestCache.delete(key));
    console.log('🗑️ Cleared upcoming/live matches cache and unified matches cache');
  }

  /**
   * Convert cURL command to request config
   * This is a helper method for when you provide cURL examples
   * @param {string} curlCommand - cURL command string
   * @returns {Object} - Request configuration object
   */
  parseCurlCommand(curlCommand: string): RequestOptions {
    // This is a basic parser - will be enhanced based on your cURL examples
    const config: RequestOptions = {
      method: 'GET',
      headers: {},
      body: undefined,
    };

    // Extract URL (not part of RequestOptions, so just ignore or handle externally)
    // const urlMatch = curlCommand.match(/curl\s+['"]?([^'"\s]+)['"]?/);
    // if (urlMatch) {
    //   // Handle URL extraction externally if needed
    // }

    // Extract method
    const methodMatch = curlCommand.match(/-X\s+(\w+)/);
    if (methodMatch) {
      config.method = methodMatch[1];
    }

    // Extract headers
    if (!config.headers) config.headers = {};
    const headerMatches = curlCommand.matchAll(/-H\s+['"]([^'"]+)['"]/g);
    for (const match of headerMatches) {
      const [key, value] = match[1].split(':').map(s => s.trim());
      if (key && value) {
        config.headers[key] = value;
      }
    }

    // Extract data/body
    const dataMatch = curlCommand.match(/-d\s+['"]([^'"]+)['"]/);
    if (dataMatch) {
      try {
        config.body = JSON.parse(dataMatch[1]);
      } catch {
        config.body = dataMatch[1];
      }
    }

    return config;
  }

  /**
   * Get player past matches using the player-specific endpoint
   * @param pageNo - Page number (default: 1)
   * @param pageSize - Number of matches per page (default: 60)
   * @param datetime - Timestamp for consistency (default: current time)
   * @returns Promise with past matches data
   */
  public async getPlayerPastMatches(
    pageNo: number = 1,
    pageSize: number = 60,
    datetime: number = Date.now()
  ): Promise<MatchResponse> {
    const playerId = '33835174'; // Default player ID from memory
    const url = `${this.baseApiUrl}/player/get-player-match/${playerId}?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetime}`;
    const cacheKey = `player_past_matches_${playerId}_${pageNo}_${pageSize}_${datetime}`;

    const result = await this._fetchAndCache(
      url,
      cacheKey,
      (data: any) => data, // Return raw data for processing
      15000,
      {
        method: 'GET',
        headers: this.cricHeroesHeaders,
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch player past matches');
    }

    // Map the API response to our expected format with score data
    const rawMatches = result.data?.data || [];
    const pastMatches = rawMatches
      .filter((match: any) => match.status === 'past')
      .map((match: any) => ({
        id: match.match_id,
        match_id: match.match_id,
        tournament_name: match.tournament_name || '',
        tournament_round_name: match.tournament_round_name,
        round_name: match.tournament_round_name,
        status: match.status,
        team_a: match.team_a,
        team_b: match.team_b,
        team1_name: match.team_a,
        team2_name: match.team_b,
        match_summary: match.match_summary,
        match_type: match.match_type,
        match_format: match.match_type,
        overs: match.overs,
        ground_name: match.ground_name,
        ground_id: match.ground_id,
        match_start_time: match.match_start_time,
        start_time: match.match_start_time,
        match_result: match.match_result,
        team1: match.team_a_id ? {
          id: match.team_a_id,
          name: match.team_a,
          short_name: match.team_a
        } : undefined,
        team2: match.team_b_id ? {
          id: match.team_b_id,
          name: match.team_b,
          short_name: match.team_b
        } : undefined,
        // Add score data for past matches
        team1_score: (match.team_a_score || match.team1_score || match.team_a_runs !== undefined) ? {
          runs: match.team_a_runs || match.team1_runs || match.team_a_score?.runs || 0,
          wickets: match.team_a_wickets || match.team1_wickets || match.team_a_score?.wickets || 0,
          overs: match.team_a_overs || match.team1_overs || match.team_a_score?.overs || match.overs || '20.0',
          summary: match.team_a_score_summary || match.team1_score_summary || match.team_a_score?.summary
        } : undefined,
        team2_score: (match.team_b_score || match.team2_score || match.team_b_runs !== undefined) ? {
          runs: match.team_b_runs || match.team2_runs || match.team_b_score?.runs || 0,
          wickets: match.team_b_wickets || match.team2_wickets || match.team_b_score?.wickets || 0,
          overs: match.team_b_overs || match.team2_overs || match.team_b_score?.overs || match.overs || '20.0',
          summary: match.team_b_score_summary || match.team2_score_summary || match.team_b_score?.summary
        } : undefined,
      }));

    return {
      matches: pastMatches,
      page: result.data?.page || null,
      status: result.data?.status || 'success',
      config: result.data?.config || {}
    };
  }

  /**
   * Get team matches by team ID
   * @param {string} teamId - Team ID to fetch matches for (default: 5179117)
   * @param {number} pageNo - Page number (default: 1)
   * @param {number} pageSize - Number of matches per page (default: 12)
   * @param {number} datetime - Timestamp for consistency (default: current time)
   * @returns {Promise<TeamMatchResponse>} - API response with team matches
   */
  async getTeamMatches(
    teamId: string = '5179117',
    pageNo: number = 1,
    pageSize: number = 12,
    datetime: number = Date.now()
  ): Promise<TeamMatchResponse> {
    const url = `${this.baseApiUrl}/team/get-team-match/${teamId}?pagesize=${pageSize}&teamId=${teamId}&pageno=${pageNo}&datetime=${datetime}`;
    const cacheKey = `team_matches_${teamId}_${pageNo}_${pageSize}_${Math.floor(datetime / 30000)}`;

    const result = await this._fetchAndCache(
      url,
      cacheKey,
      (data: any) => data, // Return raw data for processing
      30000, // 30 second cache
      {
        method: 'GET',
        headers: this.cricHeroesHeaders,
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch team matches');
    }

    // Map the API response to our expected format with complete field mapping
    const rawMatches = result.data?.data || [];
    const matches: Match[] = rawMatches.map((match: any) => ({
      // Basic match identification
      match_id: match.match_id,
      id: match.match_id, // Alternative naming

      // Match type and format
      match_type: match.match_type,
      match_format: match.match_type, // Alternative naming for match_type
      match_type_id: match.match_type_id,
      is_super_over: match.is_super_over,
      match_event_type: match.match_event_type || '',
      match_event: match.match_event || '',
      match_inning: match.match_inning,
      ball_type: match.ball_type,
      current_inning: match.current_inning,

      // Match timing
      match_start_time: match.match_start_time,
      start_time: match.match_start_time, // Alternative naming for match_start_time
      match_end_time: match.match_end_time || '',
      created_date: match.created_date,
      created_by: match.created_by,

      // Location details
      city_id: match.city_id,
      city_name: match.city_name,
      ground_id: match.ground_id,
      ground_name: match.ground_name,
      latitude: match.latitude,
      longitude: match.longitude,

      // Match format details
      overs: match.overs,
      balls: match.balls,
      over_reduce: match.over_reduce || '',
      is_dl: match.is_dl,
      is_vjd: match.is_vjd,
      type: match.type,

      // Match status and result
      status: match.status,
      winning_team_id: match.winning_team_id || '',
      winning_team: match.winning_team || '',
      match_result: match.match_result || '',
      win_by: match.win_by || '',

      // Team A details
      team_a_id: match.team_a_id,
      team_a: match.team_a,
      team1_name: match.team_a, // Alternative naming convention
      team_a_logo: match.team_a_logo || '',
      is_a_home_team: match.is_a_home_team,

      // Team B details
      team_b_id: match.team_b_id,
      team_b: match.team_b,
      team2_name: match.team_b, // Alternative naming convention
      team_b_logo: match.team_b_logo || '',
      is_b_home_team: match.is_b_home_team,

      // Player awards
      pom_player_id: match.pom_player_id, // Player of the Match
      bba_player_id: match.bba_player_id, // Best Batsman
      bbo_player_id: match.bbo_player_id, // Best Bowler

      // Tournament details
      tournament_id: match.tournament_id || '',
      tournament_name: match.tournament_name || '',
      tournament_round_name: match.tournament_round_name,
      round_name: match.tournament_round_name, // Alternative naming
      tournament_category_id: match.tournament_category_id || '',
      tournament_round_id: match.tournament_round_id || '',

      // Association details
      association_id: match.association_id,
      association_year_id: match.association_year_id,
      association_name: match.association_name || '',
      association_logo: match.association_logo || '',

      // Streaming and media
      steaming_url: match.steaming_url || '',
      is_ticker: match.is_ticker,
      is_enable_tournament_streaming: match.is_enable_tournament_streaming,
      is_enable_match_streaming: match.is_enable_match_streaming,
      is_video_analyst: match.is_video_analyst,
      is_backend_match: match.is_backend_match,

      // Match settings
      is_fake_match: match.is_fake_match,
      is_live_match_enable_in_web: match.is_live_match_enable_in_web,
      is_live_match_enable_in_app: match.is_live_match_enable_in_app,
      match_category_name: match.match_category_name || '',
      is_having_ai_commentary: match.is_having_ai_commentary,
      index: match.index,

      // Match summary and scores
      match_summary: match.match_summary || {
        team_id: -1,
        summary: '',
        short_summary: '',
        full_summary: '',
        rrr: '0.00',
        target: '-'
      },
      team_a_summary: match.team_a_summary || '',
      team_a_innings: match.team_a_innings || [],
      team_b_summary: match.team_b_summary || '',
      team_b_innings: match.team_b_innings || [],
      toss_details: match.toss_details || '',

      // Legacy support for existing code
      team1: match.team_a_id ? {
        id: match.team_a_id,
        name: match.team_a,
        short_name: match.team_a
      } : undefined,
      team2: match.team_b_id ? {
        id: match.team_b_id,
        name: match.team_b,
        short_name: match.team_b
      } : undefined,
      // Mini score information for live and past matches
      team1_score: (match.status === 'live' || match.status === 'past') && (match.team_a_score || match.team1_score || match.team_a_runs !== undefined) ? {
        runs: match.team_a_runs || match.team1_runs || match.team_a_score?.runs || 0,
        wickets: match.team_a_wickets || match.team1_wickets || match.team_a_score?.wickets || 0,
        overs: match.team_a_overs || match.team1_overs || match.team_a_score?.overs || match.overs || '20.0',
        summary: match.team_a_score_summary || match.team1_score_summary || match.team_a_score?.summary
      } : undefined,
      team2_score: (match.status === 'live' || match.status === 'past') && (match.team_b_score || match.team2_score || match.team_b_runs !== undefined) ? {
        runs: match.team_b_runs || match.team2_runs || match.team_b_score?.runs || 0,
        wickets: match.team_b_wickets || match.team2_wickets || match.team_b_score?.wickets || 0,
        overs: match.team_b_overs || match.team2_overs || match.team_b_score?.overs || match.overs || '20.0',
        summary: match.team_b_score_summary || match.team2_score_summary || match.team_b_score?.summary
      } : undefined,
    }));

    return {
      status: result.data?.status || false,
      page: result.data?.page || { next: '' },
      data: matches,
      config: result.data?.config || { sponsor_data: [] }
    };
  }

  /**
   * Get ground details by ground ID
   * @param {number} groundId - Ground ID to fetch details for
   * @returns {Promise<ApiResponse<Ground>>} - API response with ground details
   */
  async getGroundDetail(groundId: number): Promise<ApiResponse<Ground>> {
    const url = `${this.baseApiUrl}/booking/get-ground-detail/${groundId}`;
    const cacheKey = `ground_detail_${groundId}`;

    return this._fetchAndCache(
      url,
      cacheKey,
      (data: GroundDetailResponse) => data.data, // Extract the ground data from the response
      300000, // 5 minute cache for ground details
      {
        method: 'GET',
        headers: this.cricHeroesHeaders,
      }
    );
  }
}

export default new ApiService();
