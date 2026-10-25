/**
 * Tests for cache service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheService } from '../services/cacheService';
import { CricHeroesRecruitmentResponse } from '../services/cricHeroesApiClient';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('CacheService', () => {
  let cacheService: CacheService;
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    cacheService = new CacheService({
      defaultTTL: 30 * 60 * 1000, // 30 minutes
      maxEntries: 10,
      version: '1.0.0',
      keyPrefix: 'test_',
    });
    jest.clearAllMocks();
  });

  describe('cacheRecruitmentPosts', () => {
    it('should cache recruitment posts successfully', async () => {
      const mockResponse: CricHeroesRecruitmentResponse = {
        status: true,
        data: [],
        page: { total: 0 },
      };

      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);

      await cacheService.cacheRecruitmentPosts('test-key', mockResponse);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'test_test-key',
        expect.stringContaining('"data":{"status":true,"data":[],"page":{"total":0}}')
      );
    });
  });

  describe('getCachedRecruitmentPosts', () => {
    it('should return cached data when valid', async () => {
      const mockResponse: CricHeroesRecruitmentResponse = {
        status: true,
        data: [],
        page: { total: 0 },
      };

      const cacheEntry = {
        data: mockResponse,
        timestamp: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
        version: '1.0.0',
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getCachedRecruitmentPosts('test-key');

      expect(result).toEqual(mockResponse);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('test_test-key');
    });

    it('should return null when cache is expired', async () => {
      const mockResponse: CricHeroesRecruitmentResponse = {
        status: true,
        data: [],
        page: { total: 0 },
      };

      const expiredCacheEntry = {
        data: mockResponse,
        timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
        expiresAt: Date.now() - 30 * 60 * 1000, // Expired 30 minutes ago
        version: '1.0.0',
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(expiredCacheEntry));
      mockAsyncStorage.removeItem.mockResolvedValue();

      const result = await cacheService.getCachedRecruitmentPosts('test-key');

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test_test-key');
    });

    it('should return null when cache version mismatch', async () => {
      const mockResponse: CricHeroesRecruitmentResponse = {
        status: true,
        data: [],
        page: { total: 0 },
      };

      const oldVersionCacheEntry = {
        data: mockResponse,
        timestamp: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
        version: '0.9.0', // Old version
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(oldVersionCacheEntry));
      mockAsyncStorage.removeItem.mockResolvedValue();

      const result = await cacheService.getCachedRecruitmentPosts('test-key');

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test_test-key');
    });

    it('should return null when no cached data exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await cacheService.getCachedRecruitmentPosts('test-key');

      expect(result).toBeNull();
    });
  });

  describe('isCacheStale', () => {
    it('should return false for fresh cache', async () => {
      const freshCacheEntry = {
        data: {},
        timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago
        expiresAt: Date.now() + 30 * 60 * 1000,
        version: '1.0.0',
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(freshCacheEntry));

      const isStale = await cacheService.isCacheStale('test-key', 5 * 60 * 1000); // 5 minute threshold

      expect(isStale).toBe(false);
    });

    it('should return true for stale cache', async () => {
      const staleCacheEntry = {
        data: {},
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        expiresAt: Date.now() + 30 * 60 * 1000,
        version: '1.0.0',
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(staleCacheEntry));

      const isStale = await cacheService.isCacheStale('test-key', 5 * 60 * 1000); // 5 minute threshold

      expect(isStale).toBe(true);
    });

    it('should return true when no cache exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const isStale = await cacheService.isCacheStale('test-key');

      expect(isStale).toBe(true);
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache entries with correct prefix', async () => {
      const allKeys = ['test_key1', 'test_key2', 'other_key', 'test_key3'];
      const cacheKeys = ['test_key1', 'test_key2', 'test_key3'];

      mockAsyncStorage.getAllKeys.mockResolvedValue(allKeys);
      mockAsyncStorage.multiRemove.mockResolvedValue();

      await cacheService.clearAllCache();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(cacheKeys);
    });

    it('should handle empty cache gracefully', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);

      await cacheService.clearAllCache();

      expect(mockAsyncStorage.multiRemove).not.toHaveBeenCalled();
    });
  });

  describe('generatePostsKey', () => {
    it('should generate consistent keys for same parameters', () => {
      const key1 = cacheService.generatePostsKey(1, 20, { cityId: 123 });
      const key2 = cacheService.generatePostsKey(1, 20, { cityId: 123 });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different parameters', () => {
      const key1 = cacheService.generatePostsKey(1, 20, { cityId: 123 });
      const key2 = cacheService.generatePostsKey(2, 20, { cityId: 123 });

      expect(key1).not.toBe(key2);
    });

    it('should handle no filters', () => {
      const key = cacheService.generatePostsKey(1, 20);

      expect(key).toContain('no_filters');
    });
  });
});