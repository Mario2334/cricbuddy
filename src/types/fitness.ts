/**
 * Fitness Types for Gym Diary & Fitness Tracker Module
 * 
 * These types define the data structures for workout logging,
 * exercise tracking, and fitness scheduling.
 */

// Muscle groups targeted by exercises
export type MuscleGroup = 
  | 'LEGS' 
  | 'SHOULDERS' 
  | 'CHEST' 
  | 'TRICEPS' 
  | 'BACK' 
  | 'BICEPS' 
  | 'CORE' 
  | 'CARDIO';

// Types of cardiovascular exercises
export type CardioType = 'RUNNING' | 'SWIMMING' | 'CYCLING';

// Intensity levels for cardio workouts
export type IntensityLevel = 'LOW' | 'MODERATE' | 'HIGH';

// Types of workout days
export type WorkoutType = 'GYM' | 'PRACTICE' | 'MATCH' | 'REST';

/**
 * Represents a single set within an exercise
 * Contains weight, reps, and completion status
 */
export interface ExerciseSet {
  id: string;
  weight: number;      // in kg
  reps: number;
  completed: boolean;
}

/**
 * Represents a logged exercise with all its sets
 * Used for strength training exercises
 */
export interface ExerciseLog {
  id: string;
  exerciseName: string;
  targetGroup: MuscleGroup;
  sets: ExerciseSet[];
  notes?: string;
}

/**
 * Represents a cardio session log
 * Captures duration, distance, and intensity
 */
export interface CardioLog {
  type: CardioType;
  durationMinutes: number;
  distanceKm?: number;
  intensity: IntensityLevel;
}

/**
 * Represents a complete daily workout record
 * Contains cardio, strength exercises, and core work
 */
export interface DailyWorkout {
  id: string;
  date: string;           // ISO Date "YYYY-MM-DD"
  type: WorkoutType;
  focusAreas?: MuscleGroup[];
  cardio?: CardioLog;
  exercises: ExerciseLog[];
  coreCompleted?: string[];  // IDs of completed core exercises
  isRestDay: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Storage structure for workout data in AsyncStorage
 * Maps ISO date strings to DailyWorkout records
 */
export interface WorkoutStorage {
  [date: string]: DailyWorkout;
}
