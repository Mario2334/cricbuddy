/**
 * API Service Module
 * 
 * This module provides methods to make API calls that replicate cURL requests
 * with the same parameters, headers, and cookies.
 */

class ApiService {
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
  getCachedResponse(cacheKey, maxAge = 30000) { // 30 seconds default cache
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
  setCachedResponse(cacheKey, data) {
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Generate equivalent cURL command for debugging
   */
  generateCurlCommand(url, options) {
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
  async makeRequestWithRetry(url, options, retryCount = 0) {
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
  updateRateLimitInfo(headers) {
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
   * Fetch matches with pagination and caching
   * @param {number} pageNo - Page number (1-based)
   * @param {number} pageSize - Number of matches per page
   * @returns {Promise} - API response with matches data
   */
  async getMatches(pageNo = 1, pageSize = 60) {
    const datetime = Date.now();
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetime}`;
    
    // Create cache key (exclude datetime for caching similar requests)
    const cacheKey = `matches_${pageNo}_${pageSize}`;
    
    // Check cache first (only for first page to get fresh data)
    if (pageNo === 1) {
      const cached = this.getCachedResponse(cacheKey, 15000); // 15 seconds for page 1
      if (cached) {
        return cached;
      }
    }
    
    const requestOptions = {
      method: 'GET',
      headers: {
        ...this.cricHeroesHeaders,
        'cookie': this.cookies,
      },
    };

    try {
      console.log('Fetching matches:', { pageNo, pageSize, url });
      
      const response = await this.makeRequestWithRetry(url, requestOptions);
      const data = await response.json();
      
      const result = {
        success: true,
        data,
        status: response.status,
      };
      
      // Cache the response
      this.setCachedResponse(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      return {
        success: false,
        error: error.message,
        status: error.status || 500,
      };
    }
  }

  /**
   * Fetch player statistics from CricHeroes API
   * @param {string} playerId - Player ID (default: 33835174)
   * @param {number} pageSize - Number of stats per page (default: 12)
   * @returns {Promise} - API response with player statistics
   */
  async getPlayerStats(playerId = '33835174', pageSize = 12) {
    const url = `${this.baseApiUrl}/player/get-player-statistic/${playerId}?pagesize=${pageSize}`;
    
    // Create cache key
    const cacheKey = `player_stats_${playerId}_${pageSize}`;
    
    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
    
    const statsHeaders = {
      ...this.cricHeroesHeaders,
    };
    
    try {
      console.log('Fetching player stats:', { playerId, pageSize, url });
      
      const response = await this.makeRequestWithRetry(url, {
        method: 'GET',
        headers: statsHeaders,
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
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
      return {
        success: false,
        error: error.message,
        status: error.status || 500,
      };
    }
  }

  /**
   * Fetch match scorecard from CricHeroes website
   * @param {string} matchId - Match ID
   * @param {string} tournamentName - Tournament name (URL encoded)
   * @param {string} teamNames - Team names (URL encoded)
   * @returns {Promise} - API response with match scorecard
   */
  async getMatchScorecard(matchId, tournamentName, teamNames) {
    // Path parameters: preserve parentheses, spaces to dashes
    const pathTournamentName = tournamentName;
    const pathTeamNames = teamNames;
    
    // Query parameters: URL encode parentheses and special characters
    const queryTournamentName = encodeURIComponent(tournamentName);
    const queryTeamNames = encodeURIComponent(teamNames);
    
    const url = `${this.baseSiteUrl}/_next/data/OVUTzmAU3pe49ZN74kvoz/scorecard/${matchId}/${pathTournamentName}/${pathTeamNames}/scorecard.json?matchId=${matchId}&tournamentName=${queryTournamentName}&teamNames=${queryTeamNames}&tab=scorecard`;
    
    // Create cache key
    const cacheKey = `match_scorecard_${matchId}_${tournamentName}_${teamNames}`;
    
    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
    
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

    // Add cookies - using exact values from the provided cURL
    const cookies = [
      '__gads=ID=4dde36bfd39898ae:T=1747037706:RT=1747038115:S=ALNI_MbN6ramj9aFRgeOFXfskUwTCLlHRQ',
      '__gpi=UID=000010be5c799e2c:T=1747037706:RT=1747038115:S=ALNI_MZ7mbKy55Ytj9zpWLu6gUVX79dB5g',
      '__eoi=ID=38a21732c874f103:T=1747037706:RT=1747038115:S=AA-AfjYewt6QzaJX6vyXF0Bn5WgT',
      'udid=b06d1d63f90cf3493b39e534c59b6935',
      '_ga=GA1.1.2096582932.1750061171',
      '_gcl_au=1.1.1375876877.1750061171',
      '_fbp=fb.1.1750061172193.742802603316790326',
      '_cc_id=f35faad3c98bbd52bf3417d0d099fcfc',
      '_clck=1ghor2m%7C2%7Cfwy%7C0%7C1993',
      'panoramaId_expiry=1750611944420',
      'panoramaId=46b0e43a6507bdf4d5a079e12945a9fb927ae1b9ec035b03a2220869a3baa5d2',
      'panoramaIdType=panoDevice',
      'cto_bundle=N8Nc6l95VW1yM1glMkYyMWExNSUyQkZHRkpESmVza3ZjVXJQc2V5elNDdTJpN0VNaDFXdWhmZkh1VU1KV1A3aEpZWnZhU1FHemxHbWNMM2NQTEFXUjRqdEVNVm9sYllRMXFTOVhFJTJGY1pUVEJWJTJCODFacDRNeFhQd1hieHRpcVI1dmVNaFIlMkZweDhsM2psRm50NlRsRmZiNHVBSjhLaHpnTEtjRjlUSE9DZyUyRnZJN043QjRkWWFVMiUyRjhNZ2Q1TmJDSG5aeGVpMnQlMkZHNGNQa1Q1YmphVkRCUFIlMkZldjl5VFVBJTNEJTNE',
      'cf_clearance=92zJAXsNRhom4caBiCEDtJmek05Ahh7h8O0Vn1A4x_8-1750530252-1.2.1.1-W2JT7UMDlq7q.XHq_NZaSUYUehSvvvOrC3DtXQ0XnMJJMPFq5TtNairPnbZfcX7NveRJIHHjPZPTQ_taU1l_m65lRKEVieK3dqrkltle06RMtvOpccRrtA7f9cz9hh708iGs0c0iU3.X.YPNlzk4cEe_nxBodjnjC7MzpW.PfOA5v_czbgbjCqIh0J1_fdPQ9BNBGUnAepBa64DCLTrXUWW_RAWqcfhnCF5LpNCy0qS4l5BOynab.ANZISk4crgJthpJOADFG6fI2BC.dWWQ4QXAfJ7ubE81u3p2SUZxVy2.hRqwEKsUsA6fzxpPXEnkDjOozKI_Yq8J1UsGIk06Sx_CXfawl673t27ekQipr8r58TnjEAS5yRIgpT9HvSxk',
      'SSO_ID=b06d1d63f90cf3493b39e534c59b6935',
      'Authorization=167a0e60-4ecf-11f0-9aaf-65c0aaccdb8b',
      'current_user=%7B%22user_id%22%3A33835174%2C%22country_id%22%3A1%2C%22country_code%22%3A%22%2B91%22%2C%22mobile%22%3A%228484996704%22%2C%22name%22%3A%22Sanket%20Mokashi%22%2C%22email%22%3A%22%22%2C%22dob%22%3A%221995-02-02%22%2C%22gender%22%3A0%2C%22city_id%22%3A1798%2C%22state_id%22%3A18%2C%22city_name%22%3A%22Bengaluru%20(Bangalore)%22%2C%22player_skill%22%3A%22%22%2C%22player_role%22%3A%22%22%2C%22playing_role_id%22%3A%22%22%2C%22bowling_type%22%3A%22Right-arm%20Off%20Break%22%2C%22bowling_type_id%22%3A%2213%22%2C%22bowling_type_code%22%3A%22ROB%22%2C%22batting_hand%22%3A%22LHB%22%2C%22profile_photo%22%3A%22https%3A%2F%2Fmedia.cricheroes.in%2Fuser_profile%2F1737692532056_Nd3PQTvS88mu.jpeg%22%2C%22is_verified%22%3A1%2C%22promo_code%22%3A%228A8AD%22%2C%22counter%22%3A0%2C%22registered_date%22%3A%222024-11-16%2007%3A42%3A31%22%2C%22is_pro%22%3A1%2C%22is_primary_login%22%3A0%2C%22created_date%22%3A%222024-11-16T07%3A41%3A51.000Z%22%2C%22is_valid_device%22%3A0%2C%22can_switch_association%22%3A0%2C%22has_association_admin%22%3A0%2C%22association_id%22%3A0%2C%22is_web_insights_access%22%3A0%2C%22has_ticker_admin%22%3A0%2C%22only_ticker_admin%22%3A0%2C%22has_fantasy_admin%22%3A0%2C%22has_officials_management_admin_access%22%3A0%2C%22has_officials_management_official_access%22%3A0%2C%22league_admin_user_type%22%3A0%2C%22is_cricheroes_admin%22%3A0%2C%22has_my_club_access%22%3A0%2C%22is_new%22%3Afalse%2C%22is_pin%22%3Afalse%2C%22is_campaign_start%22%3A0%7D',
      'city=%7B%22id%22%3A1798%2C%22name%22%3A%22Bengaluru%20(Bangalore)%22%7D',
      'isNew=0',
      'FCNEC=%5B%5B%22AKsRol8rsMIdI_n93e9cS8TQlUcBKWGaK0MJTzq5Zzs8GMale-sePVjQgyeWj2bWAAJxBH7RnV66FO6B39Xmrhn-cNyRnVYBipACE21y3P3LlqtNNlJu-g0EKl_WOXjWPNuQfZmoYDBrOBS7vELgFh_zUMIpNp8i0w%3D%3D%22%5D%5D',
      '__cf_bm=gIt5IeGQ5wmhk6pKfihTJabCjq.AOaLjcJ8DFXBnBDs-1750534169-1.0.1.1-t9C_IzNdVN6D9whfvs0fj66dSKe3fNjdqXpHrCUo.fp0KqoUvlRBAapx9yGU5icU6A1V1PYDKNNHNN6iu54bqQPGvPraqRY6RRJ94e2wxdQ',
      '_clsk=cvyf0%7C1750534380811%7C65%7C1%7Cv.clarity.ms%2Fcollect',
      '_ga_RHRT76MSXD=GS2.1.s1750525428$o2$g1$t1750534381$j40$l0$h0'
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
    } catch (error) {
      console.error('Failed to fetch match scorecard:', error);
      return {
        success: false,
        error: error.message,
        status: error.status || 500,
      };
    }
  }

  /**
   * Fetch player matches from CricHeroes API
   * @param {string} playerId - Player ID (default: 33835174)
   * @param {number} pageSize - Number of matches per page (default: 12)
   * @returns {Promise} - API response with player matches
   */
  async getPlayerMatches(pageNo = 1, pageSize = 60, datetime = null) {
    const datetimeParam = datetime || Date.now();
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetimeParam}`;
    
    try {
      const response = await this.makeRequestWithRetry(url, {
        method: 'GET',
        headers: this.cricHeroesHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Return both data and page info
      return {
        matches: data.data || [],
        page: data.page || null,
        status: data.status,
        config: data.config
      };
    } catch (error) {
      console.error('Error fetching matches:', error);
      throw error;
    }
  }

  /**
   * Fetch matches using provided next/previous URL
   * @param {string} pageUrl - Full URL path (e.g., "/match/get-my-web-Matches?pagesize=20&pageno=4&datetime=1750531179447")
   * @returns {Promise<Object>} API response with matches and page info
   */
  async fetchMatchesFromUrl(pageUrl) {
    if (!pageUrl) {
      throw new Error('No URL provided');
    }

    // Remove leading slash if present and construct full URL
    const cleanUrl = pageUrl.startsWith('/') ? pageUrl.substring(1) : pageUrl;
    const fullUrl = `${this.baseApiUrl}/${cleanUrl}`;
    
    console.log('🔄 Fetching matches from URL:', fullUrl);

    try {
      const response = await this.makeRequestWithRetry(fullUrl, {
        method: 'GET',
        headers: this.cricHeroesHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Return both data and page info
      return {
        matches: data.data || [],
        page: data.page || null,
        status: data.status,
        config: data.config
      };
    } catch (error) {
      console.error('Error fetching matches from URL:', error);
      throw error;
    }
  }

  /**
   * Convert cURL command to request config
   * This is a helper method for when you provide cURL examples
   * @param {string} curlCommand - cURL command string
   * @returns {Object} - Request configuration object
   */
  parseCurlCommand(curlCommand) {
    // This is a basic parser - will be enhanced based on your cURL examples
    const config = {
      method: 'GET',
      headers: {},
      cookies: {},
      params: {},
    };

    // Extract URL
    const urlMatch = curlCommand.match(/curl\s+['"]?([^'"\s]+)['"]?/);
    if (urlMatch) {
      config.url = urlMatch[1];
    }

    // Extract method
    const methodMatch = curlCommand.match(/-X\s+(\w+)/);
    if (methodMatch) {
      config.method = methodMatch[1];
    }

    // Extract headers
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
   * @param {number} pageNo - Page number (default: 1)
   * @param {number} pageSize - Number of matches per page (default: 12)
   * @param {number} datetime - Timestamp for consistency (default: current time)
   * @returns {Promise<Object>} API response with past matches and page info
   */
  async getPlayerPastMatches(pageNo = 1, pageSize = 12, datetime = null) {
    const datetimeParam = datetime || Date.now();
    const playerId = '33835174'; // Player ID from the cURL
    const url = `${this.baseApiUrl}/player/get-player-match/${playerId}?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetimeParam}`;
    
    console.log('🔍 Fetching past matches from player endpoint:', url);

    try {
      const response = await this.makeRequestWithRetry(url, {
        method: 'GET',
        headers: this.cricHeroesHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter for past matches only (status === 'past')
      const pastMatches = data.data ? data.data.filter(match => match.status === 'past') : [];
      
      // Return both data and page info
      return {
        matches: pastMatches,
        page: data.page || null,
        status: data.status,
        config: data.config,
        totalCount: pastMatches.length
      };
    } catch (error) {
      console.error('Error fetching past matches:', error);
      throw error;
    }
  }

  /**
   * Fetch player matches from CricHeroes API
   * @param {string} playerId - Player ID (default: 33835174)
   * @param {number} pageSize - Number of matches per page (default: 12)
   * @returns {Promise} - API response with player matches
   */
  async getPlayerMatches(pageNo = 1, pageSize = 60, datetime = null) {
    const datetimeParam = datetime || Date.now();
    const url = `${this.baseApiUrl}/match/get-my-web-Matches?pagesize=${pageSize}&pageno=${pageNo}&datetime=${datetimeParam}`;
    
    try {
      const response = await this.makeRequestWithRetry(url, {
        method: 'GET',
        headers: this.cricHeroesHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Return both data and page info
      return {
        matches: data.data || [],
        page: data.page || null,
        status: data.status,
        config: data.config
      };
    } catch (error) {
      console.error('Error fetching matches:', error);
      throw error;
    }
  }

  /**
   * Fetch matches using provided next/previous URL
   * @param {string} pageUrl - Full URL path (e.g., "/match/get-my-web-Matches?pagesize=20&pageno=4&datetime=1750531179447")
   * @returns {Promise<Object>} API response with matches and page info
   */
  async fetchMatchesFromUrl(pageUrl) {
    if (!pageUrl) {
      throw new Error('No URL provided');
    }

    // Remove leading slash if present and construct full URL
    const cleanUrl = pageUrl.startsWith('/') ? pageUrl.substring(1) : pageUrl;
    const fullUrl = `${this.baseApiUrl}/${cleanUrl}`;
    
    console.log('🔄 Fetching matches from URL:', fullUrl);

    try {
      const response = await this.makeRequestWithRetry(fullUrl, {
        method: 'GET',
        headers: this.cricHeroesHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Return both data and page info
      return {
        matches: data.data || [],
        page: data.page || null,
        status: data.status,
        config: data.config
      };
    } catch (error) {
      console.error('Error fetching matches from URL:', error);
      throw error;
    }
  }

  /**
   * Convert cURL command to request config
   * This is a helper method for when you provide cURL examples
   * @param {string} curlCommand - cURL command string
   * @returns {Object} - Request configuration object
   */
  parseCurlCommand(curlCommand) {
    // This is a basic parser - will be enhanced based on your cURL examples
    const config = {
      method: 'GET',
      headers: {},
      cookies: {},
      params: {},
    };

    // Extract URL
    const urlMatch = curlCommand.match(/curl\s+['"]?([^'"\s]+)['"]?/);
    if (urlMatch) {
      config.url = urlMatch[1];
    }

    // Extract method
    const methodMatch = curlCommand.match(/-X\s+(\w+)/);
    if (methodMatch) {
      config.method = methodMatch[1];
    }

    // Extract headers
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
}

export default new ApiService();
