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

// ============================================
// WORKOUT TEMPLATE TYPES
// ============================================

/**
 * Muscle group category for organizing workout templates
 * Groups related muscle groups for structured training
 */
export type MuscleGroupCategory = 
  | 'BACK_BICEPS'
  | 'CHEST_TRICEPS'
  | 'LEGS'
  | 'SHOULDERS';

/**
 * Represents a predefined exercise within a workout template
 * Contains exercise details and default set/rep configurations
 */
export interface ExerciseDefinition {
  name: string;
  targetGroup: MuscleGroup;
  defaultSets: number;
  defaultReps?: number[];      // Array of reps per set (e.g., [12, 10, 8])
  defaultWeight?: number[];    // Array of weights per set in kg
}

/**
 * Represents a warm-up or stretch exercise (time or rep based)
 * Used for cardio warm-ups and stretching routines
 */
export interface WarmUpExercise {
  name: string;
  durationSecs?: number;       // Duration in seconds
  durationMins?: number;       // Duration in minutes (for cardio)
  reps?: number;               // Number of reps
}

/**
 * Represents a core exercise within a workout template
 * Can be time-based (planks) or rep-based (crunches)
 */
export interface CoreExercise {
  name: string;
  defaultSets: number;
  durationSecs?: number;       // For timed exercises like planks
  defaultReps?: number[];      // For rep-based exercises
}

/**
 * Warm-up section with cardio and circuit exercises
 * Defines the structure for pre-workout preparation
 */
export interface WarmUpSection {
  cardio: WarmUpExercise;
  circuit: WarmUpExercise[];
}

/**
 * Represents a preloaded workout template with full structure
 * Contains all sections: warm-up, main exercises, core, and stretches
 */
export interface WorkoutTemplate {
  id: string;
  name: string;
  category: MuscleGroupCategory;
  focusAreas: MuscleGroup[];
  warmUp: WarmUpSection;
  exercises: ExerciseDefinition[];
  core?: CoreExercise[];
  stretch: WarmUpExercise[];
}
