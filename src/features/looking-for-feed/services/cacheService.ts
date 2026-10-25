/**
 * Cache Service for Looking For Feed
 * 
 * Implements local storage for recruitment posts with cache invalidation
 * and staleness detection for offline support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecruitmentPost } from '../types';
import { CricHeroesRecruitmentResponse } from './cricHeroesApiClient';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
  metadata?: {
    pageNo?: number;
    pageSize?: number;
    filters?: any;
    totalCount?: number;
  };
}

export interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxEntries: number; // Maximum number of cache entries
  version: string; // Cache version for invalidation
  keyPrefix: string; // Prefix for cache keys
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number; // Approximate size in bytes
  oldestEntry?: number; // Timestamp
  newestEntry?: number; // Timestamp
  hitRate?: number; // Cache hit rate percentage
}

export class CacheService {
  private readonly config: CacheConfig;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      maxEntries: 100,
      version: '1.0.0',
      keyPrefix: 'looking_for_feed_',
      ...config,
    };
  }

  /**
   * Store recruitment posts in cache
   */
  async cacheRecruitmentPosts(
    key: string,
    response: CricHeroesRecruitmentResponse,
    ttl?: number
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const expiresAt = Date.now() + (ttl || this.config.defaultTTL);
      
      const cacheEntry: CacheEntry<CricHeroesRecruitmentResponse> = {
        data: response,
        timestamp: Date.now(),
        expiresAt,
        version: this.config.version,
        metadata: {
          totalCount: response.page?.total,
        },
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      
      // Clean up old entries if we exceed max entries
      await this.cleanupOldEntries();
      
      console.log(`[CacheService] Cached recruitment posts with key: ${key}`);
    } catch (error) {
      console.error('[CacheService] Failed to cache recruitment posts:', error);
    }
  }

  /**
   * Retrieve recruitment posts from cache
   */
  async getCachedRecruitmentPosts(key: string): Promise<CricHeroesRecruitmentResponse | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        this.missCount++;
        console.log(`[CacheService] Cache miss for key: ${key}`);
        return null;
      }

      const cacheEntry: CacheEntry<CricHeroesRecruitmentResponse> = JSON.parse(cachedData);
      
      // Check if cache entry is expired
      if (this.isCacheExpired(cacheEntry)) {
        this.missCount++;
        console.log(`[CacheService] Cache expired for key: ${key}`);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      // Check version compatibility
      if (cacheEntry.version !== this.config.version) {
        this.missCount++;
        console.log(`[CacheService] Cache version mismatch for key: ${key}`);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      this.hitCount++;
      console.log(`[CacheService] Cache hit for key: ${key}`);
      return cacheEntry.data;
    } catch (error) {
      this.missCount++;
      console.error('[CacheService] Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Cache individual recruitment post
   */
  async cachePost(post: RecruitmentPost, ttl?: number): Promise<void> {
    try {
      const key = `post_${post.id}`;
      const cacheKey = this.getCacheKey(key);
      const expiresAt = Date.now() + (ttl || this.config.defaultTTL);
      
      const cacheEntry: CacheEntry<RecruitmentPost> = {
        data: post,
        timestamp: Date.now(),
        expiresAt,
        version: this.config.version,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`[CacheService] Cached individual post: ${post.id}`);
    } catch (error) {
      console.error('[CacheService] Failed to cache individual post:', error);
    }
  }

  /**
   * Get cached individual post
   */
  async getCachedPost(postId: string): Promise<RecruitmentPost | null> {
    try {
      const key = `post_${postId}`;
      const cacheKey = this.getCacheKey(key);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const cacheEntry: CacheEntry<RecruitmentPost> = JSON.parse(cachedData);
      
      if (this.isCacheExpired(cacheEntry) || cacheEntry.version !== this.config.version) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error('[CacheService] Failed to retrieve cached post:', error);
      return null;
    }
  }

  /**
   * Check if cached data is stale (but not expired)
   */
  async isCacheStale(key: string, staleThreshold: number = 5 * 60 * 1000): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return true;
      }

      const cacheEntry: CacheEntry<any> = JSON.parse(cachedData);
      const age = Date.now() - cacheEntry.timestamp;
      
      return age > staleThreshold;
    } catch (error) {
      console.error('[CacheService] Failed to check cache staleness:', error);
      return true;
    }
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidateCache(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      await AsyncStorage.removeItem(cacheKey);
      console.log(`[CacheService] Invalidated cache for key: ${key}`);
    } catch (error) {
      console.error('[CacheService] Failed to invalidate cache:', error);
    }
  }

  /**
   * Clear all cache entries for this service
   */
  async clearAllCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.config.keyPrefix));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[CacheService] Cleared ${cacheKeys.length} cache entries`);
      }
      
      // Reset hit/miss counters
      this.hitCount = 0;
      this.missCount = 0;
    } catch (error) {
      console.error('[CacheService] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.config.keyPrefix));
      
      let totalSize = 0;
      let oldestEntry: number | undefined;
      let newestEntry: number | undefined;
      
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            totalSize += data.length;
            
            const cacheEntry: CacheEntry<any> = JSON.parse(data);
            if (!oldestEntry || cacheEntry.timestamp < oldestEntry) {
              oldestEntry = cacheEntry.timestamp;
            }
            if (!newestEntry || cacheEntry.timestamp > newestEntry) {
              newestEntry = cacheEntry.timestamp;
            }
          }
        } catch (error) {
          // Skip invalid entries
          console.warn(`[CacheService] Invalid cache entry: ${key}`);
        }
      }
      
      const totalRequests = this.hitCount + this.missCount;
      const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;
      
      return {
        totalEntries: cacheKeys.length,
        totalSize,
        oldestEntry,
        newestEntry,
        hitRate,
      };
    } catch (error) {
      console.error('[CacheService] Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(cacheEntry: CacheEntry<any>): boolean {
    return Date.now() > cacheEntry.expiresAt;
  }

  /**
   * Generate cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Clean up old cache entries when max entries exceeded
   */
  private async cleanupOldEntries(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.config.keyPrefix));
      
      if (cacheKeys.length <= this.config.maxEntries) {
        return;
      }

      // Get all cache entries with timestamps
      const entries: Array<{ key: string; timestamp: number }> = [];
      
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const cacheEntry: CacheEntry<any> = JSON.parse(data);
            entries.push({ key, timestamp: cacheEntry.timestamp });
          }
        } catch (error) {
          // Remove invalid entries
          await AsyncStorage.removeItem(key);
        }
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest entries to get back to max limit
      const entriesToRemove = entries.length - this.config.maxEntries;
      if (entriesToRemove > 0) {
        const keysToRemove = entries.slice(0, entriesToRemove).map(entry => entry.key);
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[CacheService] Cleaned up ${entriesToRemove} old cache entries`);
      }
    } catch (error) {
      console.error('[CacheService] Failed to cleanup old entries:', error);
    }
  }

  /**
   * Generate cache key for recruitment posts based on filters
   */
  generatePostsKey(
    pageNo: number = 1,
    pageSize: number = 20,
    filters?: {
      cityId?: number;
      skillLevel?: string;
      teamType?: string;
      ballType?: string;
    }
  ): string {
    const filterString = filters ? JSON.stringify(filters) : 'no_filters';
    return `posts_${pageNo}_${pageSize}_${filterString}`;
  }
}

/**
 * Default cache service instance
 */
export const defaultCacheService = new CacheService({
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  maxEntries: 100,
  version: '1.0.0',
  keyPrefix: 'looking_for_feed_',
});

/**
 * Long-term cache service for frequently accessed data
 */
export const longTermCacheService = new CacheService({
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxEntries: 50,
  version: '1.0.0',
  keyPrefix: 'looking_for_feed_long_',
});