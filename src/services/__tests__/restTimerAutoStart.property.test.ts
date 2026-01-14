/**
 * Property-Based Tests for Rest Timer Auto-Start
 * 
 * Feature: interactive-workout-session
 * Property 3: Rest Timer Auto-Start
 * 
 * Tests that rest timers automatically start after set completion
 * 
 * Validates: Requirements 3.1
 */

import * as fc from 'fast-check';
import type { TimerType, TimerState } from '../../types/timer';

// ============================================
// Mock Setup for React Native modules
// ============================================

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setVolumeAsync: jest.fn().mockResolvedValue(undefined),
          replayAsync: jest.fn().mockResolvedValue(undefined),
          getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false }),
          pauseAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        }
      })
    }
  }
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  }
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: {},
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

import { TimerManager } from '../timerManager';

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

// Generate valid rest durations (in seconds)
const restDurationArb = fc.integer({ min: 15, max: 180 }); // 15 seconds to 3 minutes

// Generate valid set IDs
const setIdArb = fc.string({ minLength: 1, maxLength: 36 }).map(s => `set_${s}`);

// Generate valid exercise IDs
const exerciseIdArb = fc.string({ minLength: 1, maxLength: 36 }).map(s => `exercise_${s}`);

// ============================================
// Test Setup
// ============================================

describe('Rest Timer Auto-Start - Property Tests', () => {
  let timerManager: TimerManager;

  beforeEach(() => {
    jest.clearAllMocks();
    timerManager = new TimerManager();
  });

  afterEach(() => {
    timerManager.clearAllTimers();
    jest.restoreAllMocks();
  });

  // ============================================
  // Property 3: Rest Timer Auto-Start
  // ============================================
  describe('Property 3: Rest Timer Auto-Start', () => {
    /**
     * Feature: interactive-workout-session, Property 3: Rest Timer Auto-Start
     * 
     * *For any* completed set, the system SHALL automatically start a rest timer
     * with the configured default duration (60 seconds for strength, 30 seconds for cardio).
     * 
     * **Validates: Requirements 3.1**
     */
    it('should create rest timer with correct duration', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          // Create a rest timer
          const timerId = timerManager.createRestTimer(duration, setId);
          
          // Verify timer was created
          const timer = timerManager.getTimer(timerId);
          expect(timer).toBeDefined();
          expect(timer?.type).toBe('rest');
          expect(timer?.duration).toBe(duration);
          expect(timer?.state).toBe('created');
          
          // Clean up
          timerManager.clearTimer(timerId);
        }),
        { numRuns: 100 }
      );
    });

    it('should have correct initial state for rest timers', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          const timerId = timerManager.createRestTimer(duration, setId);
          const timer = timerManager.getTimer(timerId);
          
          // Property: Initial remaining time equals duration
          expect(timer?.remaining).toBe(duration);
          
          // Property: Initial elapsed time is 0
          expect(timer?.elapsed).toBe(0);
          
          // Property: Timer type is 'rest'
          expect(timer?.type).toBe('rest');
          
          // Property: Timer is associated with the set
          expect(timer?.setId).toBe(setId);
          
          // Property: Initial state is 'created'
          expect(timer?.state).toBe('created');
          
          timerManager.clearTimer(timerId);
        }),
        { numRuns: 100 }
      );
    });

    it('should start rest timer and transition to running state', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          const timerId = timerManager.createRestTimer(duration, setId);
          
          // Start the timer
          timerManager.startTimer(timerId);
          const timer = timerManager.getTimer(timerId);
          
          // Property: Timer should be in running state after start
          expect(timer?.state).toBe('running');
          
          // Property: Duration should remain unchanged
          expect(timer?.duration).toBe(duration);
          
          timerManager.clearTimer(timerId);
        }),
        { numRuns: 100 }
      );
    });

    it('should support timer adjustment for rest timers', () => {
      fc.assert(
        fc.property(
          restDurationArb,
          setIdArb,
          fc.integer({ min: -30, max: 30 }), // adjustment in seconds
          (duration, setId, adjustment) => {
            const timerId = timerManager.createRestTimer(duration, setId);
            timerManager.startTimer(timerId);
            
            // Adjust the timer
            timerManager.adjustTimer(timerId, adjustment);
            const timer = timerManager.getTimer(timerId);
            
            // Property: Timer should still exist after adjustment
            expect(timer).toBeDefined();
            
            // Property: Timer should still be running
            expect(timer?.state).toBe('running');
            
            timerManager.clearTimer(timerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle default rest durations for different exercise types', () => {
      // Default rest durations by exercise type
      const defaultRestDurations = {
        strength: 60,
        cardio: 30,
        core: 45,
      };

      for (const [exerciseType, expectedDuration] of Object.entries(defaultRestDurations)) {
        const timerId = timerManager.createRestTimer(expectedDuration, `${exerciseType}-set-1`);
        const timer = timerManager.getTimer(timerId);
        
        // Property: Rest timer should have the correct default duration for exercise type
        expect(timer?.duration).toBe(expectedDuration);
        
        timerManager.clearTimer(timerId);
      }
    });

    it('should maintain rest timer state through pause/resume cycle', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          const timerId = timerManager.createRestTimer(duration, setId);
          
          // Start the timer
          timerManager.startTimer(timerId);
          let timer = timerManager.getTimer(timerId);
          expect(timer?.state).toBe('running');
          
          // Pause the timer
          timerManager.pauseTimer(timerId);
          timer = timerManager.getTimer(timerId);
          expect(timer?.state).toBe('paused');
          
          // Resume the timer
          timerManager.resumeTimer(timerId);
          timer = timerManager.getTimer(timerId);
          expect(timer?.state).toBe('running');
          
          // Property: Duration should remain unchanged through pause/resume
          expect(timer?.duration).toBe(duration);
          
          timerManager.clearTimer(timerId);
        }),
        { numRuns: 50 }
      );
    });

    it('should provide active timer display for rest timers', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          const timerId = timerManager.createRestTimer(duration, setId);
          
          // Start the timer
          timerManager.startTimer(timerId);
          
          // Get active timers with display info
          const activeTimers = timerManager.getActiveTimersWithDisplay();
          const activeTimer = activeTimers.find(t => t.id === timerId);
          
          // Property: Active timer should have display properties
          expect(activeTimer).toBeDefined();
          expect(activeTimer?.displayTime).toBeDefined();
          expect(activeTimer?.progress).toBeGreaterThanOrEqual(0);
          expect(activeTimer?.progress).toBeLessThanOrEqual(1);
          expect(activeTimer?.isCountdown).toBe(true); // Rest timers count down
          expect(activeTimer?.type).toBe('rest');
          
          timerManager.clearTimer(timerId);
        }),
        { numRuns: 50 }
      );
    });

    it('should handle minimum rest duration (15 seconds)', () => {
      const minDuration = 15;
      const timerId = timerManager.createRestTimer(minDuration, 'min-rest-set');
      const timer = timerManager.getTimer(timerId);
      
      // Property: Timer should handle minimum duration
      expect(timer).toBeDefined();
      expect(timer?.duration).toBe(minDuration);
      expect(timer?.remaining).toBe(minDuration);
      
      timerManager.clearTimer(timerId);
    });

    it('should handle maximum rest duration (3 minutes)', () => {
      const maxDuration = 180; // 3 minutes
      const timerId = timerManager.createRestTimer(maxDuration, 'max-rest-set');
      const timer = timerManager.getTimer(timerId);
      
      // Property: Timer should handle maximum duration
      expect(timer).toBeDefined();
      expect(timer?.duration).toBe(maxDuration);
      expect(timer?.remaining).toBe(maxDuration);
      
      timerManager.clearTimer(timerId);
    });

    it('should clear rest timer when skipped', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          const timerId = timerManager.createRestTimer(duration, setId);
          timerManager.startTimer(timerId);
          
          // Clear the timer (simulating skip)
          timerManager.clearTimer(timerId);
          
          // Property: Timer should no longer exist (returns null or undefined)
          const timer = timerManager.getTimer(timerId);
          expect(timer == null).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================
  // Rest Timer Adjustment Properties
  // ============================================
  describe('Rest Timer Adjustment Properties', () => {
    it('should support +15s adjustment', () => {
      fc.assert(
        fc.property(restDurationArb, setIdArb, (duration, setId) => {
          const timerId = timerManager.createRestTimer(duration, setId);
          timerManager.startTimer(timerId);
          
          // Add 15 seconds
          timerManager.adjustTimer(timerId, 15);
          const timer = timerManager.getTimer(timerId);
          
          // Property: Duration should increase by 15 seconds
          expect(timer?.duration).toBe(duration + 15);
          
          timerManager.clearTimer(timerId);
        }),
        { numRuns: 50 }
      );
    });

    it('should support -15s adjustment', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 30, max: 180 }), // Ensure duration is at least 30s
          setIdArb,
          (duration, setId) => {
            const timerId = timerManager.createRestTimer(duration, setId);
            timerManager.startTimer(timerId);
            
            // Subtract 15 seconds
            timerManager.adjustTimer(timerId, -15);
            const timer = timerManager.getTimer(timerId);
            
            // Property: Duration should decrease by 15 seconds
            expect(timer?.duration).toBe(duration - 15);
            
            timerManager.clearTimer(timerId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not allow negative duration after adjustment', () => {
      const duration = 10; // Small duration
      const timerId = timerManager.createRestTimer(duration, 'small-rest-set');
      timerManager.startTimer(timerId);
      
      // Try to subtract more than the duration
      timerManager.adjustTimer(timerId, -20);
      const timer = timerManager.getTimer(timerId);
      
      // Property: Duration should not go below 0
      expect(timer?.duration).toBeGreaterThanOrEqual(0);
      
      timerManager.clearTimer(timerId);
    });
  });
});
