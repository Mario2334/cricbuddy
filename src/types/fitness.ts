/**
 * Fitness Types for Gym Diary & Fitness Tracker Module
 * 
 * These types define the data structures for workout logging,
 * exercise tracking, and fitness scheduling.
 */

import { ExerciseHealthMetrics, WorkoutHealthMetrics } from './health';
import type { 
  ExerciseTimerHistory, 
  ExerciseVisualState, 
  InteractiveSessionData 
} from './timer';

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
  healthMetrics?: ExerciseHealthMetrics;
  // Timer-related properties for interactive sessions
  suggestedDuration?: number;        // for time-based exercises
  restDurations?: number[];          // custom rest between sets
  timerHistory?: ExerciseTimerHistory;
  visualProgress?: ExerciseVisualState;
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
  healthKitWorkoutId?: string;
  workoutMetrics?: WorkoutHealthMetrics;
  // Interactive session data for timer-driven workouts
  interactiveSession?: InteractiveSessionData;
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
  warmup?: WarmUpExercise[];    // Warmup exercises after cardio
  circuit: WarmUpExercise[];
}

/**
 * Cooldown exercise after core workout
 * Can be time-based or rep-based
 */
export interface CooldownExercise {
  name: string;
  durationSecs?: number;
  reps?: number;
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
  cooldown?: CooldownExercise[];  // Cooldown exercises after core
  stretch: WarmUpExercise[];
}


// ============================================
// SCHEDULED WORKOUT TYPES
// ============================================

/**
 * Represents a recurring pattern for scheduled workouts
 * Currently supports weekly recurring schedules
 */
export interface RecurringPattern {
  frequency: 'weekly';
  daysOfWeek: number[];          // 0=Sunday, 1=Monday, 2=Tuesday, etc.
  endDate?: string;              // Optional end date for series (ISO date string)
}

/**
 * Represents a scheduled future workout session
 * Contains all information needed to plan and sync workouts with device calendar
 */
export interface ScheduledWorkout {
  id: string;
  templateId?: string;           // Reference to workout template (optional for custom workouts)
  templateName: string;          // Display name of the workout
  focusAreas: MuscleGroup[];     // Target muscle groups
  scheduledDate: string;         // ISO date string (YYYY-MM-DD)
  scheduledTime: string;         // Time string (HH:mm)
  durationMinutes: number;       // Expected duration in minutes
  calendarEventId?: string;      // Native calendar event ID (set after sync)
  notificationId?: string;       // Local notification ID for 30-min reminder
  isRecurring: boolean;          // Whether this is part of a recurring series
  recurringPattern?: RecurringPattern;  // Pattern details if recurring
  recurringSeriesId?: string;    // Links recurring instances together
  createdAt: string;             // ISO timestamp of creation
  updatedAt: string;             // ISO timestamp of last update
}

/**
 * Result of conflict detection when scheduling a workout
 * Used to warn users about scheduling conflicts
 */
export interface ConflictResult {
  hasConflict: boolean;
  conflictType?: 'match' | 'workout';
  conflictDetails?: string;
}
