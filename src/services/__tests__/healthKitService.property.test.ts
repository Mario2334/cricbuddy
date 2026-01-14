/**
 * Property-Based Tests for HealthKitService
 * 
 * Feature: watch-healthkit-integration
 * Tests correctness properties for HealthKit workout persistence
 */

import * as fc from 'fast-check';
import type {
  HealthKitWorkout,
  HeartRateSample,
  HKWorkoutActivityType,
} from '../../types/health';

// ============================================
// Mock Setup for React Native modules
// ============================================

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  NativeModules: {
    HealthKitModule: {
      saveWorkout: jest.fn(),
      deleteWorkout: jest.fn(),
      requestAuthorization: jest.fn(),
      getAuthorizationStatus: jest.fn(),
      startHeartRateObserver: jest.fn(),
      stopHeartRateObserver: jest.fn(),
      getActiveCalories: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

import { NativeModules } from 'react-native';
import { HealthKitService } from '../healthKitService';


// ============================================
// Test Data Generators (Arbitraries)
// ============================================

const workoutActivityTypeArb = fc.constantFrom<HKWorkoutActivityType>(
  'traditionalStrengthTraining',
  'functionalStrengthTraining',
  'coreTraining',
  'flexibility'
);

const heartRateSourceArb = fc.constantFrom<'watch' | 'phone'>('watch', 'phone');

const heartRateSampleArb: fc.Arbitrary<HeartRateSample> = fc.record({
  value: fc.integer({ min: 40, max: 220 }), // Realistic BPM range
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  source: heartRateSourceArb,
});

// Generate a valid HealthKitWorkout with consistent dates
const healthKitWorkoutArb: fc.Arbitrary<HealthKitWorkout> = fc
  .record({
    workoutType: workoutActivityTypeArb,
    duration: fc.integer({ min: 60, max: 7200 }), // 1 minute to 2 hours
    totalEnergyBurned: fc.float({ min: 0, max: 2000, noNaN: true }),
    heartRateSampleCount: fc.integer({ min: 0, max: 50 }),
    metadata: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ maxLength: 50 })
      ),
      { nil: undefined }
    ),
  })
  .map(({ workoutType, duration, totalEnergyBurned, heartRateSampleCount, metadata }) => {
    // Use fixed base date to avoid invalid date issues
    const startDate = new Date('2024-06-15T10:00:00.000Z');
    const endDate = new Date(startDate.getTime() + duration * 1000);
    
    // Generate heart rate samples with valid timestamps within workout duration
    const heartRateSamples: HeartRateSample[] = Array.from({ length: heartRateSampleCount }, (_, index) => ({
      value: 60 + Math.floor(Math.random() * 120), // 60-180 BPM
      timestamp: new Date(
        startDate.getTime() + (index * duration * 1000) / Math.max(heartRateSampleCount, 1)
      ),
      source: index % 2 === 0 ? 'watch' : 'phone' as const,
    }));

    return {
      workoutType,
      startDate,
      endDate,
      duration,
      totalEnergyBurned,
      heartRateSamples,
      metadata,
    };
  });


// ============================================
// Test Setup
// ============================================

describe('HealthKitService - Property Tests', () => {
  let service: HealthKitService;
  let mockSaveWorkout: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthKitService();
    mockSaveWorkout = NativeModules.HealthKitModule.saveWorkout as jest.Mock;
  });

  // ============================================
  // Property 10: HealthKit Workout Persistence
  // ============================================
  describe('Property 10: HealthKit Workout Persistence', () => {
    /**
     * Feature: watch-healthkit-integration, Property 10: HealthKit Workout Persistence
     * 
     * *For any* completed workout with M heart rate samples, saving to HealthKit 
     * SHALL persist the workout with all M samples, and the saved duration and 
     * calories SHALL match the input values.
     * 
     * **Validates: Requirements 6.1, 6.2**
     */
    it('should persist workout with all heart rate samples and matching duration/calories', async () => {
      await fc.assert(
        fc.asyncProperty(healthKitWorkoutArb, async (workout) => {
          // Clear mock before each iteration
          mockSaveWorkout.mockClear();
          
          // Setup: Mock successful save returning a workout ID
          const expectedWorkoutId = `workout_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          mockSaveWorkout.mockResolvedValueOnce(expectedWorkoutId);

          // Execute with minimal retry config to avoid timeouts
          const resultId = await service.saveWorkoutToHealthKit(workout, {
            baseDelayMs: 1,
            maxDelayMs: 10,
            maxRetries: 0,
          });

          // Verify: The workout ID is returned
          expect(resultId).toBe(expectedWorkoutId);

          // Verify: saveWorkout was called exactly once
          expect(mockSaveWorkout).toHaveBeenCalledTimes(1);

          // Get the data that was passed to the native module
          const savedData = mockSaveWorkout.mock.calls[0][0];

          // Property: All M heart rate samples are persisted
          expect(savedData.heartRateSamples.length).toBe(workout.heartRateSamples.length);

          // Property: Duration matches input
          expect(savedData.duration).toBe(workout.duration);

          // Property: Total energy burned matches input
          expect(savedData.totalEnergyBurned).toBe(workout.totalEnergyBurned);

          // Property: Workout type matches input
          expect(savedData.workoutType).toBe(workout.workoutType);

          // Property: Start and end dates are preserved (as ISO strings)
          expect(savedData.startDate).toBe(workout.startDate.toISOString());
          expect(savedData.endDate).toBe(workout.endDate.toISOString());

          // Property: Each heart rate sample value is preserved
          workout.heartRateSamples.forEach((sample, index) => {
            expect(savedData.heartRateSamples[index].value).toBe(sample.value);
            expect(savedData.heartRateSamples[index].source).toBe(sample.source);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve heart rate sample count for workouts with varying sample sizes', async () => {
      // Test specifically with different sample counts to ensure M samples are always preserved
      const sampleCountArb = fc.integer({ min: 0, max: 100 });
      
      await fc.assert(
        fc.asyncProperty(sampleCountArb, async (sampleCount) => {
          // Clear mock before each iteration
          mockSaveWorkout.mockClear();
          
          // Generate workout with exact sample count
          const samples: HeartRateSample[] = Array.from({ length: sampleCount }, (_, i) => ({
            value: 60 + Math.floor(Math.random() * 100),
            timestamp: new Date(Date.now() - (sampleCount - i) * 5000),
            source: i % 2 === 0 ? 'watch' : 'phone' as const,
          }));

          const workout: HealthKitWorkout = {
            workoutType: 'traditionalStrengthTraining',
            startDate: new Date(Date.now() - 3600000),
            endDate: new Date(),
            duration: 3600,
            totalEnergyBurned: 500,
            heartRateSamples: samples,
          };

          const expectedWorkoutId = `workout_${sampleCount}`;
          mockSaveWorkout.mockResolvedValueOnce(expectedWorkoutId);

          // Execute with minimal retry config to avoid timeouts
          await service.saveWorkoutToHealthKit(workout, {
            baseDelayMs: 1,
            maxDelayMs: 10,
            maxRetries: 0,
          });

          // Verify: Exactly M samples are saved
          const savedData = mockSaveWorkout.mock.calls[0][0];
          expect(savedData.heartRateSamples.length).toBe(sampleCount);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve exact calorie values including decimals', async () => {
      const calorieArb = fc.float({ min: 0, max: 5000, noNaN: true });
      
      await fc.assert(
        fc.asyncProperty(calorieArb, async (calories) => {
          // Clear mock before each iteration
          mockSaveWorkout.mockClear();
          
          const workout: HealthKitWorkout = {
            workoutType: 'functionalStrengthTraining',
            startDate: new Date(Date.now() - 1800000),
            endDate: new Date(),
            duration: 1800,
            totalEnergyBurned: calories,
            heartRateSamples: [],
          };

          mockSaveWorkout.mockResolvedValueOnce('workout_id');

          // Execute with minimal retry config to avoid timeouts
          await service.saveWorkoutToHealthKit(workout, {
            baseDelayMs: 1,
            maxDelayMs: 10,
            maxRetries: 0,
          });

          // Verify: Calories match exactly
          const savedData = mockSaveWorkout.mock.calls[0][0];
          expect(savedData.totalEnergyBurned).toBe(calories);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 11: Retry Backoff Progression
  // ============================================
  describe('Property 11: Retry Backoff Progression', () => {
    /**
     * Feature: watch-healthkit-integration, Property 11: Retry Backoff Progression
     * 
     * *For any* sequence of N consecutive HealthKit save failures, the retry delays 
     * SHALL follow exponential backoff: delay(n) = baseDelay * 2^n, capped at maxDelay.
     * 
     * **Validates: Requirements 6.3**
     */
    it('should calculate exponential backoff delays correctly', () => {
      // Arbitrary for retry configuration
      const retryConfigArb = fc.record({
        baseDelayMs: fc.integer({ min: 100, max: 5000 }),
        maxDelayMs: fc.integer({ min: 5000, max: 60000 }),
        maxRetries: fc.integer({ min: 1, max: 10 }),
      }).filter(config => config.maxDelayMs >= config.baseDelayMs);

      fc.assert(
        fc.property(retryConfigArb, (config) => {
          // Test each attempt from 0 to maxRetries
          for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            const delay = service.calculateBackoffDelay(attempt, config);
            
            // Property 1: Delay follows exponential formula
            const expectedUncapped = config.baseDelayMs * Math.pow(2, attempt);
            const expectedDelay = Math.min(expectedUncapped, config.maxDelayMs);
            
            expect(delay).toBe(expectedDelay);
            
            // Property 2: Delay is never negative
            expect(delay).toBeGreaterThanOrEqual(0);
            
            // Property 3: Delay is capped at maxDelay
            expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
            
            // Property 4: First attempt (n=0) uses baseDelay
            if (attempt === 0) {
              expect(delay).toBe(config.baseDelayMs);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should produce monotonically non-decreasing delays until cap is reached', () => {
      const retryConfigArb = fc.record({
        baseDelayMs: fc.integer({ min: 100, max: 2000 }),
        maxDelayMs: fc.integer({ min: 2000, max: 30000 }),
        maxRetries: fc.integer({ min: 2, max: 10 }),
      }).filter(config => config.maxDelayMs >= config.baseDelayMs);

      fc.assert(
        fc.property(retryConfigArb, (config) => {
          let previousDelay = 0;
          
          for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            const currentDelay = service.calculateBackoffDelay(attempt, config);
            
            // Property: Each delay is >= previous delay (monotonically non-decreasing)
            expect(currentDelay).toBeGreaterThanOrEqual(previousDelay);
            
            previousDelay = currentDelay;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should double delay on each attempt until cap is reached', () => {
      const retryConfigArb = fc.record({
        baseDelayMs: fc.integer({ min: 100, max: 1000 }),
        maxDelayMs: fc.integer({ min: 10000, max: 60000 }),
        maxRetries: fc.integer({ min: 3, max: 8 }),
      }).filter(config => config.maxDelayMs >= config.baseDelayMs * 4); // Ensure room for doubling

      fc.assert(
        fc.property(retryConfigArb, (config) => {
          for (let attempt = 0; attempt < config.maxRetries; attempt++) {
            const currentDelay = service.calculateBackoffDelay(attempt, config);
            const nextDelay = service.calculateBackoffDelay(attempt + 1, config);
            
            // If current delay hasn't hit the cap, next delay should be double
            if (currentDelay < config.maxDelayMs) {
              const expectedNext = Math.min(currentDelay * 2, config.maxDelayMs);
              expect(nextDelay).toBe(expectedNext);
            } else {
              // Once capped, delay stays at maxDelay
              expect(nextDelay).toBe(config.maxDelayMs);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle edge case where baseDelay equals maxDelay', () => {
      const equalDelayArb = fc.integer({ min: 1000, max: 10000 });

      fc.assert(
        fc.property(equalDelayArb, fc.integer({ min: 0, max: 10 }), (delay, attempt) => {
          const config = {
            baseDelayMs: delay,
            maxDelayMs: delay,
            maxRetries: 5,
          };
          
          const calculatedDelay = service.calculateBackoffDelay(attempt, config);
          
          // When base equals max, all delays should equal that value
          expect(calculatedDelay).toBe(delay);
        }),
        { numRuns: 100 }
      );
    });
  });
});
