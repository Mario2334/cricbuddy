/**
 * Property-Based Tests for WatchConnectivityService
 * 
 * Feature: watch-healthkit-integration
 * Tests correctness properties for Watch Connectivity
 */

import * as fc from 'fast-check';
import type { WatchConnectionState } from '../../types/health';
import type { WatchMessage } from '../watchConnectivityService';

// ============================================
// Mock Setup for React Native modules
// ============================================

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock Platform
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

import { WatchConnectivityService } from '../watchConnectivityService';

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

const watchConnectionStateArb: fc.Arbitrary<WatchConnectionState> = fc.record({
  isPaired: fc.boolean(),
  isReachable: fc.boolean(),
  isWatchAppInstalled: fc.boolean(),
});


// Generate a sequence of distinct state changes
const stateSequenceArb = (minLength: number, maxLength: number): fc.Arbitrary<WatchConnectionState[]> =>
  fc.array(watchConnectionStateArb, { minLength, maxLength }).filter(states => {
    if (states.length <= 1) return true;
    for (let i = 1; i < states.length; i++) {
      const prev = states[i - 1];
      const curr = states[i];
      if (
        prev.isPaired !== curr.isPaired ||
        prev.isReachable !== curr.isReachable ||
        prev.isWatchAppInstalled !== curr.isWatchAppInstalled
      ) {
        return true;
      }
    }
    return false;
  });

// Valid date generator with constrained range - using integer timestamps to avoid invalid date issues
const validDateArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(ts => new Date(ts));

// Generator for WatchMessage
const watchMessageArb: fc.Arbitrary<WatchMessage> = fc.oneof(
  fc.record({
    type: fc.constant('START_WORKOUT' as const),
    payload: fc.record({
      workoutId: fc.string({ minLength: 1, maxLength: 20 }),
      workoutName: fc.string({ minLength: 1, maxLength: 50 }),
      exercises: fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 30 }),
          sets: fc.integer({ min: 1, max: 10 }),
        }),
        { minLength: 0, maxLength: 5 }
      ),
    }),
  }),
  fc.record({
    type: fc.constant('END_WORKOUT' as const),
    payload: fc.record({
      workoutId: fc.string({ minLength: 1, maxLength: 20 }),
      duration: fc.integer({ min: 0, max: 7200 }),
      totalCalories: fc.integer({ min: 0, max: 2000 }),
    }),
  }),
  fc.record({
    type: fc.constant('SET_COMPLETED' as const),
    payload: fc.record({
      workoutId: fc.string({ minLength: 1, maxLength: 20 }),
      exerciseId: fc.string({ minLength: 1, maxLength: 10 }),
      setId: fc.string({ minLength: 1, maxLength: 10 }),
      completedAt: validDateArb.map(d => d.toISOString()),
      heartRateAtCompletion: fc.option(fc.integer({ min: 40, max: 220 }), { nil: undefined }),
    }),
  }),
  fc.record({
    type: fc.constant('HEART_RATE_UPDATE' as const),
    payload: fc.record({
      value: fc.integer({ min: 40, max: 220 }),
      timestamp: validDateArb.map(d => d.toISOString()),
      source: fc.constantFrom<'watch' | 'phone'>('watch', 'phone'),
    }),
  }),
  fc.record({
    type: fc.constant('SYNC_REQUEST' as const),
    payload: fc.record({
      lastSyncTimestamp: validDateArb.map(d => d.toISOString()),
    }),
  })
);


// ============================================
// Test Setup
// ============================================

describe('WatchConnectivityService - Property Tests', () => {
  let service: WatchConnectivityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WatchConnectivityService();
  });

  afterEach(() => {
    service.cleanup();
  });

  // ============================================
  // Property 2: Connection State Notification
  // ============================================
  describe('Property 2: Connection State Notification', () => {
    /**
     * Feature: watch-healthkit-integration, Property 2: Connection State Notification
     * 
     * *For any* change in Watch connection state (paired/unpaired, reachable/unreachable),
     * the WatchConnectivityService SHALL emit exactly one notification with the new state.
     * 
     * **Validates: Requirements 2.2**
     */
    it('should emit exactly one notification per state change', () => {
      fc.assert(
        fc.property(
          watchConnectionStateArb,
          watchConnectionStateArb,
          (initialState, newState) => {
            const isStateChange =
              initialState.isPaired !== newState.isPaired ||
              initialState.isReachable !== newState.isReachable ||
              initialState.isWatchAppInstalled !== newState.isWatchAppInstalled;

            const notifications: WatchConnectionState[] = [];
            
            const subscription = service.subscribeToStateChanges((state) => {
              notifications.push({ ...state });
            });

            notifications.length = 0;
            service._simulateStateChange(initialState);
            notifications.length = 0;
            service._simulateStateChange(newState);

            if (isStateChange) {
              expect(notifications.length).toBe(1);
              expect(notifications[0].isPaired).toBe(newState.isPaired);
              expect(notifications[0].isReachable).toBe(newState.isReachable);
              expect(notifications[0].isWatchAppInstalled).toBe(newState.isWatchAppInstalled);
            } else {
              expect(notifications.length).toBe(0);
            }

            subscription.remove();
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should notify all subscribers exactly once per state change', () => {
      fc.assert(
        fc.property(
          watchConnectionStateArb,
          fc.integer({ min: 1, max: 10 }),
          (newState, subscriberCount) => {
            const initialState: WatchConnectionState = {
              isPaired: !newState.isPaired,
              isReachable: !newState.isReachable,
              isWatchAppInstalled: !newState.isWatchAppInstalled,
            };
            service._simulateStateChange(initialState);

            const notificationCounts: number[] = Array(subscriberCount).fill(0);
            const subscriptions: Array<{ remove: () => void }> = [];

            for (let i = 0; i < subscriberCount; i++) {
              const index = i;
              const subscription = service.subscribeToStateChanges(() => {
                notificationCounts[index]++;
              });
              subscriptions.push(subscription);
            }

            notificationCounts.fill(0);
            service._simulateStateChange(newState);

            for (let i = 0; i < subscriberCount; i++) {
              expect(notificationCounts[i]).toBe(1);
            }

            subscriptions.forEach(sub => sub.remove());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not emit duplicate notifications for identical consecutive states', () => {
      fc.assert(
        fc.property(watchConnectionStateArb, (state) => {
          const initialState: WatchConnectionState = {
            isPaired: !state.isPaired,
            isReachable: !state.isReachable,
            isWatchAppInstalled: !state.isWatchAppInstalled,
          };
          service._simulateStateChange(initialState);

          const notifications: WatchConnectionState[] = [];
          
          const subscription = service.subscribeToStateChanges((s) => {
            notifications.push({ ...s });
          });

          notifications.length = 0;
          service._simulateStateChange(state);
          service._simulateStateChange(state);
          service._simulateStateChange(state);

          expect(notifications.length).toBe(1);
          subscription.remove();
        }),
        { numRuns: 100 }
      );
    });


    it('should emit notifications in order for sequential state changes', () => {
      fc.assert(
        fc.property(stateSequenceArb(2, 5), (states) => {
          const firstState = states[0];
          const initialState: WatchConnectionState = {
            isPaired: !firstState.isPaired,
            isReachable: !firstState.isReachable,
            isWatchAppInstalled: !firstState.isWatchAppInstalled,
          };
          service._simulateStateChange(initialState);

          const notifications: WatchConnectionState[] = [];
          
          const subscription = service.subscribeToStateChanges((state) => {
            notifications.push({ ...state });
          });

          notifications.length = 0;
          states.forEach(state => {
            service._simulateStateChange(state);
          });

          const expectedNotifications: WatchConnectionState[] = [];
          let prevState: WatchConnectionState = initialState;
          
          for (const state of states) {
            if (
              prevState.isPaired !== state.isPaired ||
              prevState.isReachable !== state.isReachable ||
              prevState.isWatchAppInstalled !== state.isWatchAppInstalled
            ) {
              expectedNotifications.push(state);
              prevState = state;
            }
          }

          expect(notifications.length).toBe(expectedNotifications.length);
          
          for (let i = 0; i < notifications.length; i++) {
            expect(notifications[i].isPaired).toBe(expectedNotifications[i].isPaired);
            expect(notifications[i].isReachable).toBe(expectedNotifications[i].isReachable);
            expect(notifications[i].isWatchAppInstalled).toBe(expectedNotifications[i].isWatchAppInstalled);
          }

          subscription.remove();
        }),
        { numRuns: 100 }
      );
    });

    it('should stop notifying after subscription is removed', () => {
      fc.assert(
        fc.property(
          watchConnectionStateArb,
          watchConnectionStateArb,
          (state1, state2) => {
            let notificationCount = 0;
            
            const subscription = service.subscribeToStateChanges(() => {
              notificationCount++;
            });

            notificationCount = 0;
            service._simulateStateChange(state1);
            const countAfterFirst = notificationCount;

            subscription.remove();
            service._simulateStateChange(state2);

            expect(notificationCount).toBe(countAfterFirst);
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should provide current state immediately upon subscription', () => {
      fc.assert(
        fc.property(watchConnectionStateArb, (initialState) => {
          service._simulateStateChange(initialState);

          let receivedState: WatchConnectionState | null = null;
          
          const subscription = service.subscribeToStateChanges((state) => {
            if (!receivedState) {
              receivedState = { ...state };
            }
          });

          expect(receivedState).not.toBeNull();
          expect(receivedState!.isPaired).toBe(initialState.isPaired);
          expect(receivedState!.isReachable).toBe(initialState.isReachable);
          expect(receivedState!.isWatchAppInstalled).toBe(initialState.isWatchAppInstalled);

          subscription.remove();
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 3: Message Queue Integrity
  // ============================================
  describe('Property 3: Message Queue Integrity', () => {
    /**
     * Feature: watch-healthkit-integration, Property 3: Message Queue Integrity
     * 
     * *For any* message sent while the Watch is unreachable, the message SHALL be
     * queued and delivered when connectivity is restored, maintaining FIFO order.
     * 
     * **Validates: Requirements 2.4**
     */

    it('should queue messages when Watch is unreachable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(watchMessageArb, { minLength: 1, maxLength: 10 }),
          async (messages) => {
            service._simulateStateChange({
              isPaired: true,
              isReachable: false,
              isWatchAppInstalled: true,
            });

            await service.clearMessageQueue();

            for (const message of messages) {
              await service.sendMessage(message);
            }

            const queue = service.getMessageQueue();
            expect(queue.length).toBe(messages.length);

            for (let i = 0; i < messages.length; i++) {
              expect(queue[i].message.type).toBe(messages[i].type);
            }
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should maintain FIFO order in the queue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(watchMessageArb, { minLength: 2, maxLength: 10 }),
          async (messages) => {
            service._simulateStateChange({
              isPaired: true,
              isReachable: false,
              isWatchAppInstalled: true,
            });

            await service.clearMessageQueue();

            for (const message of messages) {
              await service.sendMessage(message);
            }

            const queue = service.getMessageQueue();

            for (let i = 0; i < messages.length; i++) {
              expect(queue[i].message.type).toBe(messages[i].type);
              expect(JSON.stringify(queue[i].message.payload)).toBe(
                JSON.stringify(messages[i].payload)
              );
            }

            for (let i = 1; i < queue.length; i++) {
              const prevTime = new Date(queue[i - 1].queuedAt).getTime();
              const currTime = new Date(queue[i].queuedAt).getTime();
              expect(currTime).toBeGreaterThanOrEqual(prevTime);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve message content exactly when queued', async () => {
      await fc.assert(
        fc.asyncProperty(watchMessageArb, async (message) => {
          service._simulateStateChange({
            isPaired: true,
            isReachable: false,
            isWatchAppInstalled: true,
          });

          await service.clearMessageQueue();
          await service.sendMessage(message);

          const queue = service.getMessageQueue();

          expect(queue.length).toBe(1);
          expect(queue[0].message.type).toBe(message.type);
          expect(JSON.stringify(queue[0].message.payload)).toBe(
            JSON.stringify(message.payload)
          );
        }),
        { numRuns: 100 }
      );
    });


    it('should not queue messages when Watch is reachable and send succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(watchMessageArb, async (message) => {
          service._simulateStateChange({
            isPaired: true,
            isReachable: true,
            isWatchAppInstalled: true,
          });

          await service.clearMessageQueue();
          await service.sendMessage(message);

          const queue = service.getMessageQueue();
          expect(queue.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should assign unique IDs to each queued message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(watchMessageArb, { minLength: 2, maxLength: 20 }),
          async (messages) => {
            service._simulateStateChange({
              isPaired: true,
              isReachable: false,
              isWatchAppInstalled: true,
            });

            await service.clearMessageQueue();

            for (const message of messages) {
              await service.sendMessage(message);
            }

            const queue = service.getMessageQueue();

            const ids = queue.map((q: { id: string }) => q.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
