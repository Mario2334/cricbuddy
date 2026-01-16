/**
 * Health Types for HealthKit & Apple Watch Integration
 * 
 * These types define the data structures for health metrics tracking,
 * workout health data, and HealthKit integration.
 */

/**
 * Source of the heart rate measurement
 */
export type HeartRateSource = 'watch' | 'phone';

/**
 * Represents a single heart rate measurement captured during a workout
 */
export interface HeartRateSample {
  value: number;        // BPM (beats per minute)
  timestamp: Date;
  source: HeartRateSource;
}

/**
 * Health metrics for a single exercise within a workout
 */
export interface ExerciseHealthMetrics {
  averageHeartRate?: number;
  maxHeartRate?: number;
  caloriesBurned?: number;
  heartRateSamples?: HeartRateSample[];
}

/**
 * Aggregated health metrics for an entire workout session
 */
export interface WorkoutHealthMetrics {
  averageHeartRate: number;
  maxHeartRate: number;
  totalCalories: number;
  duration: number;     // in seconds
}

/**
 * HealthKit workout activity types supported by the app
 */
export type HKWorkoutActivityType = 
  | 'traditionalStrengthTraining'
  | 'functionalStrengthTraining'
  | 'coreTraining'
  | 'flexibility';

/**
 * Represents a workout to be saved to HealthKit
 */
export interface HealthKitWorkout {
  id?: string;
  workoutType: HKWorkoutActivityType;
  startDate: Date;
  endDate: Date;
  duration: number;           // in seconds
  totalEnergyBurned: number;  // in calories
  heartRateSamples: HeartRateSample[];
  metadata?: Record<string, string>;
}

/**
 * Authorization status for individual health data types
 */
export type AuthorizationState = 'authorized' | 'denied' | 'notDetermined';

/**
 * Health data types that require authorization
 */
export type HealthDataType = 'heartRate' | 'activeEnergy' | 'workout';

/**
 * Authorization status for all health data types
 */
export interface AuthorizationStatus {
  heartRate: AuthorizationState;
  activeEnergy: AuthorizationState;
  workout: AuthorizationState;
}

/**
 * Result of an authorization request
 */
export interface AuthorizationResult {
  granted: boolean;
  deniedTypes: HealthDataType[];
}

/**
 * Real-time metrics displayed during an active workout
 */
export interface RealTimeMetrics {
  heartRate: number | null;
  heartRateTimestamp: Date | null;
  activeCalories: number;
  elapsedSeconds: number;
  vo2Max: number | null;
  currentExerciseMetrics?: ExerciseHealthMetrics;
}

/**
 * Summary generated at the end of a workout session
 */
export interface WorkoutSummary {
  duration: number;           // in seconds
  averageHeartRate: number;
  maxHeartRate: number;
  totalCalories: number;
  exerciseMetrics: ExerciseHealthMetrics[];
}

/**
 * State of a workout session
 */
export type SessionState = 'idle' | 'active' | 'paused' | 'ending';

/**
 * Watch connection state information
 */
export interface WatchConnectionState {
  isPaired: boolean;
  isReachable: boolean;
  isWatchAppInstalled: boolean;
}

/**
 * Workout context shared between iOS and Watch apps
 */
export interface WorkoutContext {
  isWorkoutActive: boolean;
  currentExercise?: string;
  currentSet?: number;
  totalSets?: number;
  elapsedSeconds: number;
  heartRate?: number;
  calories?: number;
}

// ============================================
// Timer-Correlated Health Data Types
// ============================================

/**
 * Health metrics correlated with a specific timer period
 * Used to associate health data with exercise or rest timers
 */
export interface TimerHealthMetrics {
  timerId: string;
  timerType: 'exercise' | 'rest' | 'workout';
  exerciseId?: string;
  setId?: string;
  startTime: Date;
  endTime: Date;
  duration: number;           // in seconds
  heartRateSamples: HeartRateSample[];
  averageHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  caloriesBurned?: number;
}

/**
 * Exercise-level health data with timer correlation
 * Provides granular health metrics for each exercise
 */
export interface ExerciseTimerHealthData {
  exerciseId: string;
  exerciseName: string;
  timerPeriods: TimerHealthMetrics[];
  totalDuration: number;
  totalRestDuration: number;
  aggregatedMetrics: ExerciseHealthMetrics;
}

/**
 * Complete workout health data with timer correlation
 * Comprehensive health data for the entire workout session
 */
export interface WorkoutTimerHealthData {
  workoutId: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  exercises: ExerciseTimerHealthData[];
  overallMetrics: WorkoutHealthMetrics;
  timerPeriods: TimerHealthMetrics[];
}

/**
 * Heart rate zone classification
 */
export type HeartRateZone = 'rest' | 'warmup' | 'fatBurn' | 'cardio' | 'peak';

/**
 * Heart rate zone distribution during a timer period
 */
export interface HeartRateZoneDistribution {
  rest: number;       // percentage of time in rest zone
  warmup: number;     // percentage of time in warmup zone
  fatBurn: number;    // percentage of time in fat burn zone
  cardio: number;     // percentage of time in cardio zone
  peak: number;       // percentage of time in peak zone
}

/**
 * Extended timer health metrics with zone analysis
 */
export interface ExtendedTimerHealthMetrics extends TimerHealthMetrics {
  heartRateZoneDistribution?: HeartRateZoneDistribution;
  recoveryRate?: number;      // BPM decrease per minute during rest
  peakHeartRateTime?: Date;   // when max heart rate was reached
}
