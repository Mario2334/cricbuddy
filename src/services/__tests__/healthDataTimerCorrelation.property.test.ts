/**
 * Property-Based Tests for Health Data Timer Correlation
 * 
 * Feature: interactive-workout-session
 * Property 9: Health Data Timer Correlation
 * 
 * *For any* exercise with an active timer, health metrics collected during that timer period
 * SHALL be associated with the correct exercise in the final workout data.
 * 
 * **Validates: Requirements 7.3**
 */

import * as fc from 'fast-check';
import type { HeartRateSample, TimerHealthMetrics } from '../../types/health';

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
    HealthKitModule: {
      requestAuthorization: jest.fn(() => Promise.resolve({
        heartRate: 'authorized',
        activeEnergy: 'authorized',
        workout: 'authorized',
      })),
      getAuthorizationStatus: jest.fn(() => Promise.resolve({
        heartRate: 'authorized',
        activeEnergy: 'authorized',
        workout: 'authorized',
      })),
      startHeartRateObserver: jest.fn(),
      stopHeartRateObserver: jest.fn(),
      getActiveCalories: jest.fn(() => Promise.resolve(0)),
      saveWorkout: jest.fn(() => Promise.resolve('workout_123')),
      deleteWorkout: jest.fn(() => Promise.resolve()),
    },
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
}));

import { HealthKitService } from '../healthKitService';

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

// Generate a valid timestamp within a range
const timestampInRangeArb = (startMs: number, endMs: number): fc.Arbitrary<Date> =>
  fc.integer({ min: startMs, max: endMs }).map(ts => new Date(ts));

// Generate a heart rate sample
const heartRateSampleArb = (startMs: number, endMs: number): fc.Arbitrary<HeartRateSample> =>
  fc.record({
    value: fc.integer({ min: 40, max: 220 }),
    timestamp: timestampInRangeArb(startMs, endMs),
    source: fc.constantFrom<'watch' | 'phone'>('watch', 'phone'),
  });

// Generate an array of heart rate samples within a time range
const heartRateSamplesArb = (startMs: number, endMs: number, count: number): fc.Arbitrary<HeartRateSample[]> =>
  fc.array(heartRateSampleArb(startMs, endMs), { minLength: count, maxLength: count });

// Generate timer type
const timerTypeArb: fc.Arbitrary<'exercise' | 'rest' | 'workout'> = 
  fc.constantFrom('exercise', 'rest', 'workout');

// ============================================
// Test Setup
// ============================================

describe('Health Data Timer Correlation - Property Tests', () => {
  let service: HealthKitService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthKitService();
  });

  // ============================================
  // Property 9: Health Data Timer Correlation
  // ============================================
  describe('Property 9: Health Data Timer Correlation', () => {
    /**
     * Feature: interactive-workout-session, Property 9: Health Data Timer Correlation
     * 
     * *For any* exercise with an active timer, health metrics collected during that timer period
     * SHALL be associated with the correct exercise in the final workout data.
     * 
     * **Validates: Requirements 7.3**
     */

    it('should correlate heart rate samples within timer period only', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') }),
          fc.integer({ min: 30, max: 300 }), // duration in seconds
          fc.integer({ min: 5, max: 50 }), // number of samples
          (startTime, durationSec, sampleCount) => {
            const startMs = startTime.getTime();
            const endMs = startMs + durationSec * 1000;
            const endTime = new Date(endMs);
            
            // Generate samples: some inside, some outside the timer period
            const insideSamples: HeartRateSample[] = [];
            const outsideSamples: HeartRateSample[] = [];
            
            for (let i = 0; i < sampleCount; i++) {
              const isInside = i % 2 === 0;
              const timestamp = isInside
                ? new Date(startMs + Math.random() * (endMs - startMs))
                : new Date(startMs - 60000 - Math.random() * 60000); // 1-2 minutes before
              
              const sample: HeartRateSample = {
                value: 60 + Math.floor(Math.random() * 100),
                timestamp,
                source: 'watch',
              };
              
              if (isInside) {
                insideSamples.push(sample);
              } else {
                outsideSamples.push(sample);
              }
            }
            
            const allSamples = [...insideSamples, ...outsideSamples];
            
            // Correlate samples
            const correlatedSamples = service.correlateHeartRateSamplesWithTimer(
              allSamples,
              startTime,
              endTime
            );
            
            // All correlated samples should be within the timer period
            for (const sample of correlatedSamples) {
              const sampleTime = sample.timestamp.getTime();
              expect(sampleTime).toBeGreaterThanOrEqual(startMs);
              expect(sampleTime).toBeLessThanOrEqual(endMs);
            }
            
            // No outside samples should be included
            for (const sample of outsideSamples) {
              const isIncluded = correlatedSamples.some(
                s => s.timestamp.getTime() === sample.timestamp.getTime()
              );
              expect(isIncluded).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct average heart rate for timer period', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 40, max: 220 }), { minLength: 1, maxLength: 50 }),
          (heartRates) => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T10:05:00Z');
            
            // Create samples with the given heart rates
            const samples: HeartRateSample[] = heartRates.map((value, index) => ({
              value,
              timestamp: new Date(startTime.getTime() + index * 1000),
              source: 'watch' as const,
            }));
            
            const metrics = service.calculateTimerHealthMetrics(
              samples,
              'timer_1',
              'exercise',
              startTime,
              endTime
            );
            
            // Calculate expected average
            const expectedAverage = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
            
            expect(metrics.averageHeartRate).toBeCloseTo(expectedAverage, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct max heart rate for timer period', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 40, max: 220 }), { minLength: 1, maxLength: 50 }),
          (heartRates) => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T10:05:00Z');
            
            const samples: HeartRateSample[] = heartRates.map((value, index) => ({
              value,
              timestamp: new Date(startTime.getTime() + index * 1000),
              source: 'watch' as const,
            }));
            
            const metrics = service.calculateTimerHealthMetrics(
              samples,
              'timer_1',
              'exercise',
              startTime,
              endTime
            );
            
            const expectedMax = Math.max(...heartRates);
            
            expect(metrics.maxHeartRate).toBe(expectedMax);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct min heart rate for timer period', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 40, max: 220 }), { minLength: 1, maxLength: 50 }),
          (heartRates) => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T10:05:00Z');
            
            const samples: HeartRateSample[] = heartRates.map((value, index) => ({
              value,
              timestamp: new Date(startTime.getTime() + index * 1000),
              source: 'watch' as const,
            }));
            
            const metrics = service.calculateTimerHealthMetrics(
              samples,
              'timer_1',
              'exercise',
              startTime,
              endTime
            );
            
            const expectedMin = Math.min(...heartRates);
            
            expect(metrics.minHeartRate).toBe(expectedMin);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve timer metadata in health metrics', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }),
          timerTypeArb,
          fc.string({ minLength: 3, maxLength: 15 }),
          fc.string({ minLength: 3, maxLength: 15 }),
          (timerId, timerType, exerciseId, setId) => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T10:05:00Z');
            
            const samples: HeartRateSample[] = [
              { value: 100, timestamp: new Date('2024-01-01T10:02:00Z'), source: 'watch' },
            ];
            
            const metrics = service.calculateTimerHealthMetrics(
              samples,
              timerId,
              timerType,
              startTime,
              endTime,
              exerciseId,
              setId
            );
            
            expect(metrics.timerId).toBe(timerId);
            expect(metrics.timerType).toBe(timerType);
            expect(metrics.exerciseId).toBe(exerciseId);
            expect(metrics.setId).toBe(setId);
            expect(metrics.startTime).toEqual(startTime);
            expect(metrics.endTime).toEqual(endTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct duration for timer period', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1704067200000, max: 1717200000000 }), // timestamps for 2024
          fc.integer({ min: 15, max: 600 }), // duration in seconds
          (startMs, durationSec) => {
            const startTime = new Date(startMs);
            const endTime = new Date(startMs + durationSec * 1000);
            
            // Skip if dates are invalid
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
              return;
            }
            
            const metrics = service.calculateTimerHealthMetrics(
              [],
              'timer_1',
              'exercise',
              startTime,
              endTime
            );
            
            expect(metrics.duration).toBe(durationSec);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should aggregate exercise health data correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 15 }),
          fc.string({ minLength: 3, maxLength: 30 }),
          fc.integer({ min: 1, max: 5 }), // number of exercise periods
          fc.integer({ min: 0, max: 4 }), // number of rest periods
          (exerciseId, exerciseName, exercisePeriodCount, restPeriodCount) => {
            const timerPeriods: TimerHealthMetrics[] = [];
            let currentTime = new Date('2024-01-01T10:00:00Z').getTime();
            
            // Create exercise periods
            for (let i = 0; i < exercisePeriodCount; i++) {
              const startTime = new Date(currentTime);
              const duration = 30 + Math.floor(Math.random() * 60);
              const endTime = new Date(currentTime + duration * 1000);
              
              timerPeriods.push({
                timerId: `exercise_timer_${i}`,
                timerType: 'exercise',
                exerciseId,
                startTime,
                endTime,
                duration,
                heartRateSamples: [
                  { value: 120 + i * 5, timestamp: startTime, source: 'watch' },
                ],
              });
              
              currentTime = endTime.getTime();
            }
            
            // Create rest periods
            for (let i = 0; i < restPeriodCount; i++) {
              const startTime = new Date(currentTime);
              const duration = 30 + Math.floor(Math.random() * 30);
              const endTime = new Date(currentTime + duration * 1000);
              
              timerPeriods.push({
                timerId: `rest_timer_${i}`,
                timerType: 'rest',
                exerciseId,
                startTime,
                endTime,
                duration,
                heartRateSamples: [
                  { value: 80 + i * 3, timestamp: startTime, source: 'watch' },
                ],
              });
              
              currentTime = endTime.getTime();
            }
            
            const aggregated = service.aggregateExerciseHealthData(
              timerPeriods,
              exerciseId,
              exerciseName
            );
            
            expect(aggregated.exerciseId).toBe(exerciseId);
            expect(aggregated.exerciseName).toBe(exerciseName);
            expect(aggregated.timerPeriods.length).toBe(exercisePeriodCount + restPeriodCount);
            
            // Total duration should be sum of exercise periods only
            const expectedExerciseDuration = timerPeriods
              .filter(p => p.timerType === 'exercise')
              .reduce((sum, p) => sum + p.duration, 0);
            expect(aggregated.totalDuration).toBe(expectedExerciseDuration);
            
            // Total rest duration should be sum of rest periods only
            const expectedRestDuration = timerPeriods
              .filter(p => p.timerType === 'rest')
              .reduce((sum, p) => sum + p.duration, 0);
            expect(aggregated.totalRestDuration).toBe(expectedRestDuration);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create complete workout health data with all timer periods', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 5 }), // number of exercises
          (workoutId, exerciseCount) => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            let currentTime = startTime.getTime();
            
            const allTimerPeriods: TimerHealthMetrics[] = [];
            const exercises = [];
            
            for (let e = 0; e < exerciseCount; e++) {
              const exerciseId = `exercise_${e}`;
              const exerciseName = `Exercise ${e}`;
              const exercisePeriods: TimerHealthMetrics[] = [];
              
              // Add 2 timer periods per exercise
              for (let t = 0; t < 2; t++) {
                const periodStart = new Date(currentTime);
                const duration = 45;
                const periodEnd = new Date(currentTime + duration * 1000);
                
                const period: TimerHealthMetrics = {
                  timerId: `timer_${e}_${t}`,
                  timerType: 'exercise',
                  exerciseId,
                  startTime: periodStart,
                  endTime: periodEnd,
                  duration,
                  heartRateSamples: [
                    { value: 100 + e * 10 + t * 5, timestamp: periodStart, source: 'watch' },
                  ],
                };
                
                exercisePeriods.push(period);
                allTimerPeriods.push(period);
                currentTime = periodEnd.getTime() + 30000; // 30s gap
              }
              
              exercises.push(service.aggregateExerciseHealthData(
                exercisePeriods,
                exerciseId,
                exerciseName
              ));
            }
            
            const endTime = new Date(currentTime);
            
            const workoutData = service.createWorkoutTimerHealthData(
              workoutId,
              startTime,
              endTime,
              exercises,
              allTimerPeriods
            );
            
            expect(workoutData.workoutId).toBe(workoutId);
            expect(workoutData.exercises.length).toBe(exerciseCount);
            expect(workoutData.timerPeriods.length).toBe(exerciseCount * 2);
            expect(workoutData.startTime).toEqual(startTime);
            expect(workoutData.endTime).toEqual(endTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty samples gracefully', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2024-06-01') }),
          fc.integer({ min: 30, max: 300 }),
          (startTime, durationSec) => {
            const endTime = new Date(startTime.getTime() + durationSec * 1000);
            
            const metrics = service.calculateTimerHealthMetrics(
              [],
              'timer_1',
              'exercise',
              startTime,
              endTime
            );
            
            expect(metrics.heartRateSamples).toEqual([]);
            expect(metrics.averageHeartRate).toBeUndefined();
            expect(metrics.maxHeartRate).toBeUndefined();
            expect(metrics.minHeartRate).toBeUndefined();
            expect(metrics.duration).toBe(durationSec);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
