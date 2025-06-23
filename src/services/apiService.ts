/**
 * API Service Module
 * 
 * This module provides methods to make API calls that replicate cURL requests
 * with the same parameters, headers, and cookies.
 */

import type { Match } from '../types/Match';

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

interface PlayerStats {
  batting?: PlayerStatItem[];
  bowling?: PlayerStatItem[];
  fielding?: PlayerStatItem[];
  captain?: PlayerStatItem[];
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
  async makeRequestWithRetry(url: string, options: RequestOptions, retryCount = 0): Promise<Response> {
    try {
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
    } catch (error) {
      // No automatic retries - let user manually refresh
      throw error;
    }
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
   * Fetch matches with pagination and caching
   * @param {number} pageNo - Page number (1-based)
   * @param {number} pageSize - Number of matches per page
   * @returns {Promise} - API response with matches data
   */
  async getMatches(pageNo = 1, pageSize = 60) {
    const datetime = Date.now();
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetime}`;
    const cacheKey = `matches_${pageNo}_${pageSize}`;
    
    return this._fetchAndCache(
      url,
      cacheKey,
      (data) => {
        // Map the API response to our expected format
        const matches = (data.data || []).map((match: any) => ({
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
        }));
        
        return {
          matches,
          page: data.page || null
        };
      },
      15000,
      {
        method: 'GET',
        headers: { ...this.cricHeroesHeaders, 'cookie': this.cookies },
      }
    );
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
   * Fetch match scorecard from CricHeroes website
   * @param matchId - Match ID
   * @param tournamentName - Tournament name
   * @param teamNames - Team names in format "Team A vs Team B"
   * @returns Promise with match scorecard data
   */
  public async getMatchScorecard(
    matchId: string | number,
    tournamentName: string,
    teamNames: string
  ): Promise<ApiResponse<unknown>> {
    // Convert team names to URL-friendly format (lowercase, replace spaces with hyphens)
    const pathTournamentName = tournamentName.toLowerCase().replace(/\s+/g, '-');
    const pathTeamNames = teamNames
      .toLowerCase()
      .replace(/\(/g, '%28')  // Encode parentheses
      .replace(/\)/g, '%29')
      .replace(/\s+/g, '-');

    // Construct the URL with the latest build ID from the cURL
    const buildId = '3lZSsO4Y198VrvIsAf8dt'; // From the latest cURL
    const queryParams = new URLSearchParams({
      matchId: matchId.toString(),
      tournamentName: tournamentName,
      teamNames: teamNames,
      tab: 'scorecard'
    });

    const url = `${this.baseSiteUrl}/_next/data/${buildId}/scorecard/${matchId}/${pathTournamentName}/${pathTeamNames}/scorecard.json?${queryParams}`;
    const cacheKey = `match_scorecard_${matchId}_${tournamentName}_${teamNames}`;
    
    // Headers from the latest cURL
    const scorecardHeaders = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,gu;q=0.8,ja;q=0.7',
      'dnt': '1',
      'priority': 'u=1, i',
      'referer': `${this.baseSiteUrl}/scorecard/${matchId}/${pathTournamentName}/${pathTeamNames}/summary`,
      'sec-ch-ua': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      'sec-ch-ua-arch': '"arm"',
      'sec-ch-ua-bitness': '"64"',
      'sec-ch-ua-full-version': '"137.0.7151.120"',
      'sec-ch-ua-full-version-list': '"Google Chrome";v="137.0.7151.120", "Chromium";v="137.0.7151.120", "Not/A)Brand";v="24.0.0.0"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-model': '""',
      'sec-ch-ua-platform': '"macOS"',
      'sec-ch-ua-platform-version': '"15.5.0"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'x-nextjs-data': '1',
    };

    // Essential cookies from the latest cURL
    const cookies = [
      '__gads=ID=4dde36bfd39898ae:T=1747037706:RT=1747038115:S=ALNI_MbN6ramj9aFRgeOFXfskUwTCLlHRQ',
      '__gpi=UID=000010be5c799e2c:T=1747037706:RT=1747038115:S=ALNI_MZ7mbKy55Ytj9zpWLu6gUVX79dB5g',
      '__eoi=ID=38a21732c874f103:T=1747037706:RT=1747038115:S=AA-AfjYewt6QzaJX6vyXF0Bn5WgT',
      'udid=b06d1d63f90cf3493b39e534c59b6935',
      'Authorization=167a0e60-4ecf-11f0-9aaf-65c0aaccdb8b',
      `current_user=${encodeURIComponent(JSON.stringify({
        user_id: 33835174,
        name: 'Sanket Mokashi',
        mobile: '8484996704',
        profile_photo: 'https://media.cricheroes.in/user_profile/1737692532056_Nd3PQTvS88mu.jpeg',
      }))}`,
      'city={"id":1798,"name":"Bengaluru (Bangalore)"}',
      'isNew=0',
      'cf_clearance=ZTFlyX6Q.NyMwc.6l9RjhANTKF9Zjv_uumbv8mXyIWU-1750674394-1.2.1.1-Uu9T9IVNhob3c.hIwvvpEaoXImbkkMTIPqLFuu.77lUFjCmwhi5cPam2lH4vg4B1CLdU9hbXbXadXYrHn57o.hsOSv17VA4kHhVJW12gIpzdUHVoeJPffXiKUk.wmyxGnehrYn2sQxi62NWo2HEoXa4YkAdVEU58fVVfLARiV_TRlQ8_QEeq9juVieMoI8NOWHMF9lOmq.eIMkP91bBc8L0wYdU5afEE3zHVNDhktxbPXIIJV3nRJ6y.ETX1D6EsZcBKpt1f6yId8rQdIFKV9b.fS1sTF3OAeLild.ZYdoExnswjhkLQrfVQm1_8SM3AQ9SG10zVWZyIYRgpj5kvgEI.G2dxeXRRsu2ex3WEdzUGpYKKaD69s0HiMufqH1QI',
      'panoramaId=46b0e43a6507bdf4d5a079e12945a9fb927ae1b9ec035b03a2220869a3baa5d2',
      'panoramaIdType=panoDevice',
      'FCNEC=[["AKsRol-Nztrok0btnbBKO1uxRP8PiOQThz32guxO5SGB1rysu34m6i5OmIoDQX28n8qsRg-8Mw78iIF_pfrEmnn43AU1rfFIHfl7PElxKwOX9li_657pnH_DczX7loaxxH5MtqtPzq7fyTejTQhYnqxZVW_vNrMugw=="]]',
      'cto_bundle=WD5yOV95VW1yM1glMkYyMWExNSUyQkZHRkpESmVza2p1cmo0b3R4QnkyNkp0bEVlMTZYY3ZXVHMxNDBXbGRLMmVPd2F6Y1QyelB2OHg1djQwVXhIZWhHaE1vRUdGWVoyVjN1V2JOY1FuT1ZtcjNGNVJ0OEZFc2w3NkJ0SXZCa3JQcHV0WFp5dSUyQjVMeXBtOUgzWmJ6a0FhejdQMUJxc3JMNGpvbDY4eVg4SVNqT3VzUTElMkZOcXRzc1IzVVElMkZOcXJiYzBnbnp5dktwZE40VVhFQnglMkZ3b2dXem1sZiUyRk8wN3clM0QlM0Q',
      '_clsk=lvbtf7|1750675889664|27|0|l.clarity.ms/collect'
    ].join('; ');

    try {
      console.log('Fetching match scorecard:', { matchId, tournamentName, teamNames, url });
      
      const response = await this.makeRequestWithRetry(url, {
        method: 'GET',
        headers: {
          ...scorecardHeaders,
          'cookie': cookies,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const result = {
        success: true,
        data,
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
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetimeParam}`;
    const cacheKey = `player_matches_${pageNo}_${pageSize}`;
    const result = await this._fetchAndCache(
      url,
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
      throw new Error('Failed to fetch matches: No data returned from API');
    }
    
    return result.data;
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
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetime}`;
    const cacheKey = `upcoming_live_matches_${pageNo}_${pageSize}`;
    
    return this._fetchAndCache(
      url,
      cacheKey,
      (data) => {
        // Map the API response to our expected format
        const allMatches = (data.data || []).map((match: any) => ({
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
        }));
        
        // Separate upcoming and live matches
        const upcomingMatches = allMatches.filter((match: any) => match.status === 'upcoming');
        const liveMatches = allMatches.filter((match: any) => match.status === 'live');
        
        return {
          allMatches,
          upcomingMatches,
          liveMatches,
          page: data.page || null,
          status: data.status || 'success',
          config: data.config || {}
        };
      },
      30000, // 30 second cache to avoid 429 errors
      {
        method: 'GET',
        headers: { ...this.cricHeroesHeaders, 'cookie': this.cookies },
      }
    );
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
      key.startsWith('upcoming_live_matches_')
    );
    keysToDelete.forEach(key => this.requestCache.delete(key));
    console.log('🗑️ Cleared upcoming/live matches cache');
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
      (data: any) => ({
        matches: data?.data?.filter((match: any) => match.status === 'past') || [],
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
      throw new Error('Failed to fetch player past matches: No data returned from API');
    }
    
    return result.data;
  }
}

export default new ApiService();
