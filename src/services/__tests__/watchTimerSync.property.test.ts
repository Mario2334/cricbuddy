/**
 * Property-Based Tests for Watch Timer Synchronization
 * 
 * Feature: interactive-workout-session
 * Property 10: Watch Timer Synchronization
 * 
 * *For any* timer state change on iPhone, the Apple Watch SHALL receive and reflect
 * the same state change within 2 seconds when connected.
 * 
 * **Validates: Requirements 7.5**
 */

import * as fc from 'fast-check';
import type { TimerType, TimerState, WorkoutPhase, WorkoutTheme } from '../../types/timer';
import type { 
  TimerStatePayload, 
  SessionStatePayload,
  WatchTimerState 
} from '../watchConnectivityService';

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

import { WatchConnectivityService } from '../watchConnectivityService';

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

const timerTypeArb: fc.Arbitrary<TimerType> = fc.constantFrom('exercise', 'rest', 'workout');

const timerStateArb: fc.Arbitrary<TimerState> = fc.constantFrom(
  'created', 'running', 'paused', 'completed', 'stopped'
);

const workoutPhaseArb: fc.Arbitrary<WorkoutPhase> = fc.constantFrom(
  'warmup', 'strength', 'core', 'cooldown'
);

const workoutThemeArb: fc.Arbitrary<WorkoutTheme> = fc.record({
  primaryColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.replace(/[^0-9a-fA-F]/g, '0').substring(0, 6).padEnd(6, '0')),
  secondaryColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.replace(/[^0-9a-fA-F]/g, '0').substring(0, 6).padEnd(6, '0')),
  backgroundColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.replace(/[^0-9a-fA-F]/g, '0').substring(0, 6).padEnd(6, '0')),
  textColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.replace(/[^0-9a-fA-F]/g, '0').substring(0, 6).padEnd(6, '0')),
  accentColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.replace(/[^0-9a-fA-F]/g, '0').substring(0, 6).padEnd(6, '0')),
  progressColor: fc.string({ minLength: 7, maxLength: 7 }).map(s => '#' + s.replace(/[^0-9a-fA-F]/g, '0').substring(0, 6).padEnd(6, '0')),
});

const timerIdArb = fc.string({ minLength: 5, maxLength: 30 }).filter(s => s.length > 0);

const timerStatePayloadArb: fc.Arbitrary<TimerStatePayload> = fc.record({
  timerId: timerIdArb,
  state: timerStateArb,
  remaining: fc.integer({ min: 0, max: 3600 }),
  elapsed: fc.integer({ min: 0, max: 3600 }),
  duration: fc.integer({ min: 15, max: 3600 }),
  timerType: timerTypeArb,
});

const sessionStatePayloadArb: fc.Arbitrary<SessionStatePayload> = fc.record({
  isActive: fc.boolean(),
  isPaused: fc.boolean(),
  currentPhase: workoutPhaseArb,
  currentExercise: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  currentSet: fc.integer({ min: 0, max: 10 }),
  totalSets: fc.integer({ min: 1, max: 10 }),
  overallProgress: fc.integer({ min: 0, max: 100 }),
  elapsedSeconds: fc.integer({ min: 0, max: 7200 }),
  activeTimers: fc.array(timerStatePayloadArb, { minLength: 0, maxLength: 5 }),
});

const watchTimerStateArb: fc.Arbitrary<WatchTimerState> = fc.record({
  activeTimers: fc.array(timerStatePayloadArb, { minLength: 0, maxLength: 5 }),
  currentExercise: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  currentPhase: workoutPhaseArb,
  sessionElapsed: fc.integer({ min: 0, max: 7200 }),
  heartRate: fc.option(fc.integer({ min: 40, max: 220 }), { nil: null }),
  calories: fc.integer({ min: 0, max: 2000 }),
});

// ============================================
// Test Setup
// ============================================

describe('Watch Timer Synchronization - Property Tests', () => {
  let service: WatchConnectivityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WatchConnectivityService();
    // Set Watch as reachable for sync tests
    service._simulateStateChange({
      isPaired: true,
      isReachable: true,
      isWatchAppInstalled: true,
    });
  });

  afterEach(() => {
    service.cleanup();
  });

  // ============================================
  // Property 10: Watch Timer Synchronization
  // ============================================
  describe('Property 10: Watch Timer Synchronization', () => {
    /**
     * Feature: interactive-workout-session, Property 10: Watch Timer Synchronization
     * 
     * *For any* timer state change on iPhone, the Apple Watch SHALL receive and reflect
     * the same state change within 2 seconds when connected.
     * 
     * **Validates: Requirements 7.5**
     */

    it('should send timer start message with correct payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          timerIdArb,
          fc.integer({ min: 15, max: 300 }),
          timerTypeArb,
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          async (timerId, duration, timerType, exerciseId, setId) => {
            const { NativeModules } = require('react-native');
            NativeModules.WatchConnectivityModule.sendMessage.mockClear();

            await service.sendTimerStart(timerId, duration, timerType, exerciseId, setId);

            expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
              type: 'TIMER_START',
              payload: {
                timerId,
                duration,
                timerType,
                exerciseId,
                setId,
              },
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should send timer pause message with correct timer ID', async () => {
      await fc.assert(
        fc.asyncProperty(timerIdArb, async (timerId) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendTimerPause(timerId);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'TIMER_PAUSE',
            payload: { timerId },
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should send timer resume message with correct timer ID', async () => {
      await fc.assert(
        fc.asyncProperty(timerIdArb, async (timerId) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendTimerResume(timerId);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'TIMER_RESUME',
            payload: { timerId },
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should send timer complete message with correct timer ID', async () => {
      await fc.assert(
        fc.asyncProperty(timerIdArb, async (timerId) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendTimerComplete(timerId);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'TIMER_COMPLETE',
            payload: { timerId },
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should send timer skip message with correct timer ID', async () => {
      await fc.assert(
        fc.asyncProperty(timerIdArb, async (timerId) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendTimerSkip(timerId);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'TIMER_SKIP',
            payload: { timerId },
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should send timer state update with complete payload', async () => {
      await fc.assert(
        fc.asyncProperty(timerStatePayloadArb, async (timerState) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendTimerStateUpdate(timerState);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'TIMER_STATE_UPDATE',
            payload: timerState,
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should send phase change with correct phase and theme', async () => {
      await fc.assert(
        fc.asyncProperty(workoutPhaseArb, workoutThemeArb, async (phase, theme) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendPhaseChange(phase, theme);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'PHASE_CHANGE',
            payload: { phase, theme },
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should send full session state with all timer data', async () => {
      await fc.assert(
        fc.asyncProperty(sessionStatePayloadArb, async (sessionState) => {
          const { NativeModules } = require('react-native');
          NativeModules.WatchConnectivityModule.sendMessage.mockClear();

          await service.sendSessionState(sessionState);

          expect(NativeModules.WatchConnectivityModule.sendMessage).toHaveBeenCalledWith({
            type: 'SESSION_STATE',
            payload: sessionState,
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should update local timer state after sending timer start', async () => {
      await fc.assert(
        fc.asyncProperty(
          timerIdArb,
          fc.integer({ min: 15, max: 300 }),
          timerTypeArb,
          async (timerId, duration, timerType) => {
            await service.sendTimerStart(timerId, duration, timerType);

            const state = service.getCurrentTimerState();
            expect(state).not.toBeNull();
            
            const timer = state!.activeTimers.find(t => t.timerId === timerId);
            expect(timer).toBeDefined();
            expect(timer!.duration).toBe(duration);
            expect(timer!.timerType).toBe(timerType);
            expect(timer!.state).toBe('running');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update last sync timestamp after sending session state', async () => {
      await fc.assert(
        fc.asyncProperty(sessionStatePayloadArb, async (sessionState) => {
          const beforeTimestamp = Date.now();
          
          await service.sendSessionState(sessionState);
          
          const afterTimestamp = Date.now();
          const syncTimestamp = service.getLastTimerSyncTimestamp();
          
          expect(syncTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
          expect(syncTimestamp).toBeLessThanOrEqual(afterTimestamp);
        }),
        { numRuns: 100 }
      );
    });

    it('should notify subscribers when timer state is received from Watch', () => {
      fc.assert(
        fc.property(watchTimerStateArb, (timerState) => {
          // Create a fresh service for this test to avoid state from previous tests
          const testService = new WatchConnectivityService();
          const receivedStates: WatchTimerState[] = [];
          
          const subscription = testService.subscribeToTimerStateUpdates((state) => {
            receivedStates.push({ ...state });
          });

          // Clear any initial notifications (from subscription setup)
          receivedStates.length = 0;
          
          testService._simulateTimerStateReceived(timerState);

          expect(receivedStates.length).toBe(1);
          expect(receivedStates[0].currentPhase).toBe(timerState.currentPhase);
          expect(receivedStates[0].sessionElapsed).toBe(timerState.sessionElapsed);
          expect(receivedStates[0].activeTimers.length).toBe(timerState.activeTimers.length);

          subscription.remove();
          testService.cleanup();
        }),
        { numRuns: 100 }
      );
    });

    it('should provide current state immediately upon timer state subscription', () => {
      fc.assert(
        fc.property(watchTimerStateArb, (timerState) => {
          // Set initial state
          service._simulateTimerStateReceived(timerState);

          let receivedState: WatchTimerState | null = null;
          
          const subscription = service.subscribeToTimerStateUpdates((state) => {
            if (!receivedState) {
              receivedState = { ...state };
            }
          });

          expect(receivedState).not.toBeNull();
          expect(receivedState!.currentPhase).toBe(timerState.currentPhase);

          subscription.remove();
        }),
        { numRuns: 100 }
      );
    });

    it('should stop notifying after timer state subscription is removed', () => {
      fc.assert(
        fc.property(
          watchTimerStateArb,
          watchTimerStateArb,
          (state1, state2) => {
            let notificationCount = 0;
            
            const subscription = service.subscribeToTimerStateUpdates(() => {
              notificationCount++;
            });

            service._simulateTimerStateReceived(state1);
            const countAfterFirst = notificationCount;

            subscription.remove();
            service._simulateTimerStateReceived(state2);

            expect(notificationCount).toBe(countAfterFirst);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should queue timer messages when Watch is unreachable', async () => {
      await fc.assert(
        fc.asyncProperty(
          timerIdArb,
          fc.integer({ min: 15, max: 300 }),
          timerTypeArb,
          async (timerId, duration, timerType) => {
            // Set Watch as unreachable
            service._simulateStateChange({
              isPaired: true,
              isReachable: false,
              isWatchAppInstalled: true,
            });

            await service.clearMessageQueue();
            await service.sendTimerStart(timerId, duration, timerType);

            const queue = service.getMessageQueue();
            expect(queue.length).toBe(1);
            expect(queue[0].message.type).toBe('TIMER_START');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update current phase when phase change is sent', async () => {
      await fc.assert(
        fc.asyncProperty(workoutPhaseArb, workoutThemeArb, async (phase, theme) => {
          // Initialize timer state first
          await service.sendSessionState({
            isActive: true,
            isPaused: false,
            currentPhase: 'warmup',
            currentExercise: 'Test Exercise',
            currentSet: 0,
            totalSets: 3,
            overallProgress: 0,
            elapsedSeconds: 0,
            activeTimers: [],
          });

          await service.sendPhaseChange(phase, theme);

          const state = service.getCurrentTimerState();
          expect(state).not.toBeNull();
          expect(state!.currentPhase).toBe(phase);
        }),
        { numRuns: 100 }
      );
    });
  });
});
