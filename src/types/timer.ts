/**
 * Timer Types for Interactive Workout Session
 * 
 * These types define the data structures for timer management,
 * interactive workout sessions, and timer-related UI states.
 */

// Timer types for different workout contexts
export type TimerType = 'exercise' | 'rest' | 'workout';

// Timer states throughout its lifecycle
export type TimerState = 'created' | 'running' | 'paused' | 'completed' | 'stopped';

// Workout phases for visual theming and progress tracking
export type WorkoutPhase = 'warmup' | 'strength' | 'core' | 'cooldown';

/**
 * Core timer interface representing a single timer instance
 * Contains all timing data and metadata for timer management
 */
export interface Timer {
  id: string;
  type: TimerType;
  state: TimerState;
  duration: number;        // total duration in seconds
  remaining: number;       // remaining seconds
  elapsed: number;         // elapsed seconds
  exerciseId?: string;     // associated exercise ID
  setId?: string;          // associated set ID
  createdAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
}

/**
 * Enhanced timer interface for active UI display
 * Includes computed properties for real-time display
 */
export interface ActiveTimer extends Timer {
  progress: number;        // 0-1 progress ratio
  displayTime: string;     // formatted time string (MM:SS)
  isCountdown: boolean;    // true for exercise/rest, false for workout
}

/**
 * Overall interactive workout session state
 * Tracks current exercise, progress, and session metadata
 */
export interface InteractiveSessionState {
  isActive: boolean;
  isPaused: boolean;
  currentPhase: WorkoutPhase;
  currentExercise: ExerciseLog | null;
  currentSet: number;
  totalSets: number;
  completedExercises: string[];
  overallProgress: number;           // 0-100 percentage
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
}

/**
 * Timer adjustment record for tracking user preferences
 * Used for adaptive timer learning and user behavior analysis
 */
export interface TimerAdjustment {
  timerId: string;
  originalDuration: number;
  adjustedDuration: number;
  adjustmentReason: 'user_preference' | 'heart_rate' | 'fatigue_level';
  timestamp: Date;
}

/**
 * Timer statistics for workout session analysis
 * Provides insights into timer usage and accuracy
 */
export interface TimerStatistics {
  totalTimers: number;
  completedTimers: number;
  skippedTimers: number;
  averageTimerAccuracy: number;    // how close to suggested times
  totalRestTime: number;
  totalExerciseTime: number;
}

/**
 * Timer record for historical tracking
 * Captures actual timer performance vs planned duration
 */
export interface TimerRecord {
  duration: number;
  actualDuration: number;
  completedEarly: boolean;
  skipped: boolean;
  timestamp: Date;
}

/**
 * Exercise timer history for adaptive learning
 * Tracks timer performance across workout sessions
 */
export interface ExerciseTimerHistory {
  exerciseTimers: TimerRecord[];
  restTimers: TimerRecord[];
  totalExerciseTime: number;
  totalRestTime: number;
}

/**
 * Visual state for exercise progress tracking
 * Used by UI components for real-time visual feedback
 */
export interface ExerciseVisualState {
  isActive: boolean;
  isCompleted: boolean;
  currentSet: number;
  progress: number;        // 0-1 progress ratio
  theme: WorkoutTheme;
}

/**
 * Workout theme configuration for phase-based visual feedback
 * Defines colors and styling for different workout phases
 */
export interface WorkoutTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  progressColor: string;
}

/**
 * Workout milestone for celebration and motivation
 * Triggered at key progress points during workout
 */
export interface WorkoutMilestone {
  type: 'quarter' | 'half' | 'three_quarters' | 'complete';
  message: string;
  celebrationLevel: 'small' | 'medium' | 'large';
}

/**
 * Adaptive settings for personalized timer suggestions
 * Learns from user behavior to improve timer recommendations
 */
export interface AdaptiveSettings {
  preferredRestDurations: Record<string, number>;  // exerciseId -> duration
  averageHeartRateRecovery: number;                // seconds to return to baseline
  workoutIntensityLevel: 'low' | 'moderate' | 'high';
  timerAdjustmentHistory: TimerAdjustment[];
}

/**
 * Interactive session configuration options
 * Controls behavior and features of the interactive workout session
 */
export interface InteractiveSessionConfig {
  enableAutoRest: boolean;
  defaultRestDuration: number;
  enableAudio: boolean;
  enableHaptics: boolean;
  enableAdaptiveSuggestions: boolean;
  backgroundMode: boolean;
}

/**
 * Adaptive adjustment record for learning system
 * Tracks automatic adjustments made by the system
 */
export interface AdaptiveAdjustment {
  type: 'rest_duration' | 'exercise_duration';
  originalValue: number;
  adjustedValue: number;
  reason: string;
  heartRateContext?: number;
  timestamp: Date;
}

/**
 * Interactive session data for workout analysis
 * Comprehensive data about timer usage and session performance
 */
export interface InteractiveSessionData {
  totalDuration: number;
  phaseDurations: Record<WorkoutPhase, number>;
  timerStats: TimerStatistics;
  adaptiveAdjustments: AdaptiveAdjustment[];
  milestones: WorkoutMilestone[];
}

// Phase-based theme constants
export const PHASE_THEMES: Record<WorkoutPhase, WorkoutTheme> = {
  warmup: {
    primaryColor: '#F97316',     // Orange
    secondaryColor: '#FED7AA',
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
    accentColor: '#FB923C',
    progressColor: '#F97316',
  },
  strength: {
    primaryColor: '#3B82F6',     // Blue
    secondaryColor: '#BFDBFE',
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
    accentColor: '#60A5FA',
    progressColor: '#3B82F6',
  },
  core: {
    primaryColor: '#10B981',     // Green
    secondaryColor: '#A7F3D0',
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
    accentColor: '#34D399',
    progressColor: '#10B981',
  },
  cooldown: {
    primaryColor: '#8B5CF6',     // Purple
    secondaryColor: '#C4B5FD',
    backgroundColor: '#1F2937',
    textColor: '#F9FAFB',
    accentColor: '#A78BFA',
    progressColor: '#8B5CF6',
  },
};

// Import ExerciseLog from fitness types to avoid circular dependency
import type { ExerciseLog } from './fitness';