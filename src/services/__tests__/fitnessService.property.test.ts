/**
 * Property-Based Tests for FitnessService Analytics Functions
 * 
 * Feature: gym-diary
 * Tests correctness properties for analytics methods
 */

import * as fc from 'fast-check';
import { FitnessService } from '../fitnessService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyWorkout, ExerciseLog, ExerciseSet, MuscleGroup, WorkoutType } from '../../types/fitness';

// Get mock helpers
const mockAsyncStorage = AsyncStorage as typeof AsyncStorage & {
  __resetStore: () => void;
  __setStore: (data: Record<string, string>) => void;
  __getStore: () => Record<string, string>;
};

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

const muscleGroupArb = fc.constantFrom<MuscleGroup>(
  'LEGS', 'SHOULDERS', 'CHEST', 'TRICEPS', 'BACK', 'BICEPS', 'CORE', 'CARDIO'
);

const exerciseSetArb: fc.Arbitrary<ExerciseSet> = fc.record({
  id: fc.uuid(),
  weight: fc.integer({ min: 0, max: 500 }),
  reps: fc.integer({ min: 1, max: 100 }),
  completed: fc.boolean(),
});

const exerciseLogArb: fc.Arbitrary<ExerciseLog> = fc.record({
  id: fc.uuid(),
  exerciseName: fc.string({ minLength: 1, maxLength: 30 }),
  targetGroup: muscleGroupArb,
  sets: fc.array(exerciseSetArb, { minLength: 0, maxLength: 5 }),
  notes: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
});

// Generate valid ISO date strings (YYYY-MM-DD) using integer-based approach
const dateStringArb = fc.integer({ min: 2020, max: 2030 }).chain(year =>
  fc.integer({ min: 1, max: 12 }).chain(month =>
    fc.integer({ min: 1, max: 28 }).map(day => 
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    )
  )
);

// Generate valid ISO datetime strings
const dateTimeArb = dateStringArb.map(date => `${date}T12:00:00.000Z`);

const dailyWorkoutArb: fc.Arbitrary<DailyWorkout> = fc.record({
  id: fc.uuid(),
  date: dateStringArb,
  type: fc.constant<WorkoutType>('GYM'),
  focusAreas: fc.array(muscleGroupArb, { minLength: 1, maxLength: 3 }),
  cardio: fc.constant(undefined),
  exercises: fc.array(exerciseLogArb, { minLength: 0, maxLength: 5 }),
  coreCompleted: fc.array(fc.string({ maxLength: 20 }), { minLength: 0, maxLength: 3 }),
  isRestDay: fc.constant(false),
  createdAt: dateTimeArb,
  updatedAt: dateTimeArb,
});

// Generate a workout with a specific exercise name for testing
const workoutWithExerciseArb = (exerciseName: string): fc.Arbitrary<DailyWorkout> => 
  fc.record({
    id: fc.uuid(),
    date: dateStringArb,
    type: fc.constant<WorkoutType>('GYM'),
    focusAreas: fc.array(muscleGroupArb, { minLength: 1, maxLength: 3 }),
    cardio: fc.constant(undefined),
    exercises: fc.array(
      fc.record({
        id: fc.uuid(),
        exerciseName: fc.constant(exerciseName),
        targetGroup: muscleGroupArb,
        sets: fc.array(exerciseSetArb, { minLength: 1, maxLength: 5 }),
        notes: fc.constant(undefined),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    coreCompleted: fc.constant([]),
    isRestDay: fc.constant(false),
    createdAt: dateTimeArb,
    updatedAt: dateTimeArb,
  });

// ============================================
// Test Setup
// ============================================

describe('FitnessService Analytics - Property Tests', () => {
  let service: FitnessService;

  beforeEach(() => {
    mockAsyncStorage.__resetStore();
    jest.clearAllMocks();
    service = new FitnessService();
  });

  // ============================================
  // Property 13: Next Gym Session Finder
  // ============================================
  describe('Property 13: Next Gym Session Finder', () => {
    /**
     * Feature: gym-diary, Property 13: Next Gym Session Finder
     * 
     * *For any* set of DailyWorkout records, getNextGymSession() SHALL return 
     * the workout with the earliest date that is >= today, or null if none exist.
     * 
     * **Validates: Requirements 8.2**
     */
    it('should return the earliest future gym session or null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(dailyWorkoutArb, { minLength: 0, maxLength: 10 }),
          async (workouts) => {
            // Setup: Store workouts with unique dates
            const workoutMap: Record<string, DailyWorkout> = {};
            workouts.forEach((w, i) => {
              // Ensure unique dates by appending index to avoid collisions
              const uniqueDate = `${w.date.slice(0, 8)}${String(i).padStart(2, '0')}`;
              workoutMap[uniqueDate] = { ...w, date: uniqueDate };
            });
            
            mockAsyncStorage.__setStore({
              '@gym_diary_logs': JSON.stringify(workoutMap),
            });

            // Execute
            const result = await service.getNextGymSession();
            const today = new Date().toISOString().split('T')[0];

            // Verify
            const futureGymWorkouts = Object.values(workoutMap)
              .filter(w => w.date >= today && w.type === 'GYM' && !w.isRestDay)
              .sort((a, b) => a.date.localeCompare(b.date));

            if (futureGymWorkouts.length === 0) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(result!.date).toBe(futureGymWorkouts[0].date);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 14: Exercise History Aggregation
  // ============================================
  describe('Property 14: Exercise History Aggregation', () => {
    /**
     * Feature: gym-diary, Property 14: Exercise History Aggregation
     * 
     * *For any* workout history, the exercise list SHALL contain all unique 
     * exercise names that appear in any workout's exercises array.
     * 
     * **Validates: Requirements 10.1**
     */
    it('should return all logs for a specific exercise across all workouts', async () => {
      const testExerciseName = 'Barbell Squats';
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(workoutWithExerciseArb(testExerciseName), { minLength: 1, maxLength: 5 }),
          async (workouts) => {
            // Setup: Store workouts with unique dates
            const workoutMap: Record<string, DailyWorkout> = {};
            workouts.forEach((w, i) => {
              const uniqueDate = `2025-01-${String(i + 1).padStart(2, '0')}`;
              workoutMap[uniqueDate] = { ...w, date: uniqueDate };
            });
            
            mockAsyncStorage.__setStore({
              '@gym_diary_logs': JSON.stringify(workoutMap),
            });

            // Execute
            const history = await service.getExerciseHistory(testExerciseName);

            // Verify: Count expected exercise logs
            let expectedCount = 0;
            Object.values(workoutMap).forEach(workout => {
              workout.exercises.forEach(ex => {
                if (ex.exerciseName === testExerciseName) {
                  expectedCount++;
                }
              });
            });

            expect(history.length).toBe(expectedCount);
            
            // All returned logs should have the correct exercise name
            history.forEach(log => {
              expect(log.exerciseName).toBe(testExerciseName);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 15: Weight Progression Ordering
  // ============================================
  describe('Property 15: Weight Progression Ordering', () => {
    /**
     * Feature: gym-diary, Property 15: Weight Progression Ordering
     * 
     * *For any* exercise history, the progression data SHALL be ordered 
     * chronologically by workout date.
     * 
     * **Validates: Requirements 10.2**
     */
    it('should return exercise history ordered chronologically by date', async () => {
      const testExerciseName = 'Bench Press';
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(workoutWithExerciseArb(testExerciseName), { minLength: 2, maxLength: 10 }),
          async (workouts) => {
            // Setup: Store workouts with random but unique dates
            const workoutMap: Record<string, DailyWorkout> = {};
            const dates = workouts.map((_, i) => {
              const day = Math.floor(Math.random() * 28) + 1;
              const month = Math.floor(Math.random() * 12) + 1;
              return `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            });
            
            // Ensure unique dates
            const uniqueDates = [...new Set(dates)];
            workouts.slice(0, uniqueDates.length).forEach((w, i) => {
              workoutMap[uniqueDates[i]] = { ...w, date: uniqueDates[i] };
            });
            
            mockAsyncStorage.__setStore({
              '@gym_diary_logs': JSON.stringify(workoutMap),
            });

            // Execute
            const history = await service.getExerciseHistory(testExerciseName);

            // Verify: Results should be sorted chronologically
            for (let i = 1; i < history.length; i++) {
              expect(history[i].workoutDate >= history[i - 1].workoutDate).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // Property 16: Personal Record Calculation
  // ============================================
  describe('Property 16: Personal Record Calculation', () => {
    /**
     * Feature: gym-diary, Property 16: Personal Record Calculation
     * 
     * *For any* exercise with history, the personal record SHALL equal the 
     * maximum weight value across all sets of that exercise.
     * 
     * **Validates: Requirements 10.3**
     */
    it('should return the maximum weight across all sets as personal record', async () => {
      const testExerciseName = 'Deadlift';
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(workoutWithExerciseArb(testExerciseName), { minLength: 1, maxLength: 5 }),
          async (workouts) => {
            // Setup: Store workouts with unique dates
            const workoutMap: Record<string, DailyWorkout> = {};
            workouts.forEach((w, i) => {
              const uniqueDate = `2025-02-${String(i + 1).padStart(2, '0')}`;
              workoutMap[uniqueDate] = { ...w, date: uniqueDate };
            });
            
            mockAsyncStorage.__setStore({
              '@gym_diary_logs': JSON.stringify(workoutMap),
            });

            // Execute
            const pr = await service.getPersonalRecord(testExerciseName);

            // Calculate expected max weight
            let expectedMax = 0;
            Object.values(workoutMap).forEach(workout => {
              workout.exercises.forEach(ex => {
                if (ex.exerciseName === testExerciseName) {
                  ex.sets.forEach(set => {
                    if (set.weight > expectedMax) {
                      expectedMax = set.weight;
                    }
                  });
                }
              });
            });

            expect(pr).toBe(expectedMax);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when no history exists for the exercise', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }),
          async (exerciseName: string) => {
            // Setup: Empty storage
            mockAsyncStorage.__setStore({
              '@gym_diary_logs': JSON.stringify({}),
            });

            // Execute
            const pr = await service.getPersonalRecord(exerciseName);

            // Verify
            expect(pr).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
