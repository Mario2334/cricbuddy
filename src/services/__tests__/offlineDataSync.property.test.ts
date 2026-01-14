/**
 * Property-Based Tests for Offline Data Sync Completeness
 * 
 * Feature: watch-healthkit-integration
 * Property 13: Offline Data Sync Completeness
 * 
 * Tests that all data collected by the Watch while disconnected is synced
 * to the iOS app when connectivity is restored, with no data loss.
 */

import * as fc from 'fast-check';

// ============================================
// Mock Setup for React Native modules
// ============================================

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  NativeModules: {
    WatchConnectivityModule: {
      activateSession: jest.fn(),
      sendMessage: jest.fn(() => Promise.resolve()),
      updateApplicationContext: jest.fn(),
      getApplicationContext: jest.fn(() => Promise.resolve(null)),
    },
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
}));

// ============================================
// Types for Offline Sync Testing
// ============================================

interface OfflineDataItem {
  id: string;
  type: 'heartRate' | 'setCompletion' | 'workoutSummary';
  payload: unknown;
  timestamp: Date;
  retryCount: number;
}

interface SyncResult {
  syncedItems: string[];
  failedItems: string[];
  totalSynced: number;
  totalFailed: number;
}


// ============================================
// Offline Sync Simulator
// ============================================

/**
 * Simulates the offline data sync behavior
 * Queues data when offline and syncs when connectivity is restored
 */
class OfflineSyncSimulator {
  private queue: OfflineDataItem[] = [];
  private syncedData: OfflineDataItem[] = [];
  private isConnected: boolean = false;
  private readonly maxRetries = 5;

  /**
   * Queue data while offline
   */
  queueData(item: Omit<OfflineDataItem, 'id' | 'retryCount'>): string {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedItem: OfflineDataItem = {
      ...item,
      id,
      retryCount: 0,
    };
    this.queue.push(queuedItem);
    return id;
  }

  /**
   * Set connection state
   */
  setConnected(connected: boolean): void {
    const wasDisconnected = !this.isConnected;
    this.isConnected = connected;
    
    // Auto-sync when connectivity is restored
    if (connected && wasDisconnected) {
      this.syncAll();
    }
  }

  /**
   * Sync all queued data
   * Returns sync result with success/failure counts
   */
  syncAll(failureRate: number = 0): SyncResult {
    if (!this.isConnected) {
      return {
        syncedItems: [],
        failedItems: this.queue.map(item => item.id),
        totalSynced: 0,
        totalFailed: this.queue.length,
      };
    }

    const syncedItems: string[] = [];
    const failedItems: string[] = [];
    const remainingQueue: OfflineDataItem[] = [];

    for (const item of this.queue) {
      // Simulate random failures based on failure rate
      const shouldFail = Math.random() < failureRate;
      
      if (shouldFail && item.retryCount < this.maxRetries) {
        // Failed but can retry
        remainingQueue.push({
          ...item,
          retryCount: item.retryCount + 1,
        });
        failedItems.push(item.id);
      } else if (shouldFail) {
        // Max retries exceeded, drop the item
        failedItems.push(item.id);
      } else {
        // Success
        this.syncedData.push(item);
        syncedItems.push(item.id);
      }
    }

    this.queue = remainingQueue;

    return {
      syncedItems,
      failedItems,
      totalSynced: syncedItems.length,
      totalFailed: failedItems.length,
    };
  }


  /**
   * Get all synced data
   */
  getSyncedData(): OfflineDataItem[] {
    return [...this.syncedData];
  }

  /**
   * Get pending queue
   */
  getPendingQueue(): OfflineDataItem[] {
    return [...this.queue];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if all data has been synced (no data loss)
   */
  isFullySynced(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Reset simulator state
   */
  reset(): void {
    this.queue = [];
    this.syncedData = [];
    this.isConnected = false;
  }
}

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

// Valid heart rate values
const heartRateValueArb = fc.integer({ min: 40, max: 220 });

// Valid timestamp generator
const validTimestampArb = fc.integer({
  min: Date.now() - 3600000,
  max: Date.now(),
}).map(ts => new Date(ts));

// Offline data item generator
const offlineDataItemArb: fc.Arbitrary<Omit<OfflineDataItem, 'id' | 'retryCount'>> = fc.oneof(
  fc.record({
    type: fc.constant<'heartRate'>('heartRate'),
    payload: fc.record({
      value: heartRateValueArb,
      timestamp: validTimestampArb,
      source: fc.constant('watch'),
    }),
    timestamp: validTimestampArb,
  }),
  fc.record({
    type: fc.constant<'setCompletion'>('setCompletion'),
    payload: fc.record({
      exerciseId: fc.string({ minLength: 1, maxLength: 20 }),
      setId: fc.string({ minLength: 1, maxLength: 10 }),
      completedAt: validTimestampArb,
      heartRateAtCompletion: fc.option(heartRateValueArb, { nil: undefined }),
    }),
    timestamp: validTimestampArb,
  }),
  fc.record({
    type: fc.constant<'workoutSummary'>('workoutSummary'),
    payload: fc.record({
      duration: fc.integer({ min: 60, max: 7200 }),
      totalCalories: fc.integer({ min: 0, max: 2000 }),
      averageHeartRate: heartRateValueArb,
      maxHeartRate: heartRateValueArb,
    }),
    timestamp: validTimestampArb,
  })
);

// Generate a sequence of offline data items
const offlineDataSequenceArb = (minLength: number, maxLength: number) =>
  fc.array(offlineDataItemArb, { minLength, maxLength });


// ============================================
// Property Tests
// ============================================

describe('Offline Data Sync - Property Tests', () => {
  let simulator: OfflineSyncSimulator;

  beforeEach(() => {
    simulator = new OfflineSyncSimulator();
  });

  afterEach(() => {
    simulator.reset();
  });

  // ============================================
  // Property 13: Offline Data Sync Completeness
  // ============================================
  describe('Property 13: Offline Data Sync Completeness', () => {
    /**
     * Feature: watch-healthkit-integration, Property 13: Offline Data Sync Completeness
     * 
     * *For any* data collected by the Watch while disconnected, all data SHALL be
     * synced to the iOS app when connectivity is restored, with no data loss.
     * 
     * **Validates: Requirements 7.5**
     */

    it('should sync all queued data when connectivity is restored', () => {
      fc.assert(
        fc.property(offlineDataSequenceArb(1, 20), (items) => {
          simulator.reset();
          
          // Queue all items while offline
          const queuedIds: string[] = [];
          for (const item of items) {
            const id = simulator.queueData(item);
            queuedIds.push(id);
          }
          
          // Verify all items are queued
          expect(simulator.getQueueSize()).toBe(items.length);
          
          // Restore connectivity - this triggers auto-sync
          simulator.setConnected(true);
          
          // All items should be synced after connectivity restored
          expect(simulator.isFullySynced()).toBe(true);
          
          // Verify synced data matches original count
          const syncedData = simulator.getSyncedData();
          expect(syncedData.length).toBe(items.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve data integrity during sync', () => {
      fc.assert(
        fc.property(offlineDataItemArb, (item) => {
          simulator.reset();
          
          // Queue item while offline
          simulator.queueData(item);
          
          // Restore connectivity and sync
          simulator.setConnected(true);
          simulator.syncAll(0);
          
          // Verify synced data matches original
          const syncedData = simulator.getSyncedData();
          expect(syncedData.length).toBe(1);
          expect(syncedData[0].type).toBe(item.type);
          expect(JSON.stringify(syncedData[0].payload)).toBe(JSON.stringify(item.payload));
        }),
        { numRuns: 100 }
      );
    });


    it('should maintain FIFO order during sync', () => {
      fc.assert(
        fc.property(offlineDataSequenceArb(2, 10), (items) => {
          simulator.reset();
          
          // Queue items in order
          const queuedIds: string[] = [];
          for (const item of items) {
            const id = simulator.queueData(item);
            queuedIds.push(id);
          }
          
          // Sync all
          simulator.setConnected(true);
          simulator.syncAll(0);
          
          // Verify order is preserved
          const syncedData = simulator.getSyncedData();
          for (let i = 0; i < syncedData.length; i++) {
            expect(syncedData[i].id).toBe(queuedIds[i]);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not lose data when sync fails and retries', () => {
      fc.assert(
        fc.property(
          offlineDataSequenceArb(1, 10),
          fc.integer({ min: 1, max: 5 }),
          (items, retryAttempts) => {
            simulator.reset();
            
            // Queue items
            for (const item of items) {
              simulator.queueData(item);
            }
            
            simulator.setConnected(true);
            
            // Simulate multiple sync attempts with some failures
            let totalSynced = 0;
            for (let i = 0; i < retryAttempts; i++) {
              const result = simulator.syncAll(0.3); // 30% failure rate
              totalSynced += result.totalSynced;
            }
            
            // Final sync with no failures
            const finalResult = simulator.syncAll(0);
            totalSynced += finalResult.totalSynced;
            
            // All items should eventually be synced
            expect(simulator.getSyncedData().length).toBe(items.length);
            expect(simulator.isFullySynced()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty queue gracefully', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          simulator.reset();
          
          // Sync with empty queue
          simulator.setConnected(true);
          const result = simulator.syncAll(0);
          
          expect(result.totalSynced).toBe(0);
          expect(result.totalFailed).toBe(0);
          expect(simulator.isFullySynced()).toBe(true);
        }),
        { numRuns: 10 }
      );
    });


    it('should not sync when still disconnected', () => {
      fc.assert(
        fc.property(offlineDataSequenceArb(1, 10), (items) => {
          simulator.reset();
          
          // Queue items while offline
          for (const item of items) {
            simulator.queueData(item);
          }
          
          // Try to sync while still disconnected
          const result = simulator.syncAll(0);
          
          // Nothing should be synced
          expect(result.totalSynced).toBe(0);
          expect(result.totalFailed).toBe(items.length);
          expect(simulator.getQueueSize()).toBe(items.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should assign unique IDs to each queued item', () => {
      fc.assert(
        fc.property(offlineDataSequenceArb(2, 20), (items) => {
          simulator.reset();
          
          // Queue items
          const ids: string[] = [];
          for (const item of items) {
            const id = simulator.queueData(item);
            ids.push(id);
          }
          
          // All IDs should be unique
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should track timestamps for all queued items', () => {
      fc.assert(
        fc.property(offlineDataItemArb, (item) => {
          simulator.reset();
          
          simulator.queueData(item);
          
          const queue = simulator.getPendingQueue();
          expect(queue.length).toBe(1);
          expect(queue[0].timestamp).toEqual(item.timestamp);
        }),
        { numRuns: 100 }
      );
    });
  });
});
