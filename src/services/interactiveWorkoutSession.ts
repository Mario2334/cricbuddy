/**
 * InteractiveWorkoutSession Service
 * 
 * Main orchestrator for interactive workout sessions that provides:
 * - Session lifecycle management (start/pause/resume/end)
 * - Exercise flow management and timer coordination
 * - Integration with TimerManager, VisualFeedbackManager, and AudioFeedbackManager
 * - Progress tracking and milestone detection
 * 
 * Requirements: 1.1, 1.2, 1.4, 4.3, 4.5
 */

import type { DailyWorkout, ExerciseLog } from '../types/fitness';
import type {
  Timer,
  ActiveTimer,
  WorkoutPhase,
  InteractiveSessionState,
  InteractiveSessionConfig,
  WorkoutMilestone,
  AdaptiveSettings,
  TimerAdjustment,
  InteractiveSessionData,
  TimerStatistics,
  AdaptiveAdjustment,
} from '../types/timer';
import type { WorkoutSummary } from '../types/health';
import { TimerManager, Subscription as TimerSubscription } from './timerManager';
import { VisualFeedbackManager, visualFeedbackManager } from './visualFeedbackManager';
import { AudioFeedbackManager, audioFeedbackManager } from './audioFeedbackManager';
import { workoutSessionManager } from './workoutSessionManager';

/**
 * Subscription interface for session updates
 */
export interface Subscription {
  unsubscribe: () => void;
}

/**
 * Session state change callback
 */
export type SessionStateCallback = (state: InteractiveSessionState) => void;

/**
 * Timer update callback
 */
export type TimerUpdateCallback = (timers: ActiveTimer[]) => void;

/**
 * Default configuration for interactive sessions
 */
const DEFAULT_CONFIG: InteractiveSessionConfig = {
  enableAutoRest: true,
  defaultRestDuration: 60,
  enableAudio: true,
  enableHaptics: true,
  enableAdaptiveSuggestions: true,
  backgroundMode: true,
};

/**
 * Default rest durations by exercise type (in seconds)
 */
const DEFAULT_REST_DURATIONS: Record<string, number> = {
  strength: 60,
  cardio: 30,
  core: 45,
  warmup: 30,
  cooldown: 30,
};

/**
 * Milestone thresholds for progress tracking
 */
const MILESTONE_THRESHOLDS = {
  quarter: 25,
  half: 50,
  three_quarters: 75,
  complete: 100,
};

/**
 * InteractiveWorkoutSession class orchestrates the interactive workout experience
 * Coordinates timers, visual feedback, audio feedback, and exercise flow
 */
export class InteractiveWorkoutSession {
  // Core managers
  private timerManager: TimerManager;
  private visualFeedbackManager: VisualFeedbackManager;
  private audioFeedbackManager: AudioFeedbackManager;

  // Session state
  private sessionState: InteractiveSessionState;
  private config: InteractiveSessionConfig;
  private workout: DailyWorkout | null = null;
  private workoutTimerId: string | null = null;

  // Exercise tracking
  private exerciseIndex: number = 0;
  private currentExerciseTimerId: string | null = null;
  private currentRestTimerId: string | null = null;

  // Adaptive settings
  private adaptiveSettings: AdaptiveSettings;

  // Timer statistics
  private timerStats: TimerStatistics;
  private adaptiveAdjustments: AdaptiveAdjustment[] = [];
  private triggeredMilestones: Set<string> = new Set();

  // Subscriptions
  private stateSubscribers: Set<SessionStateCallback> = new Set();
  private timerSubscribers: Set<TimerUpdateCallback> = new Set();
  private timerSubscription: TimerSubscription | null = null;

  constructor(
    timerMgr?: TimerManager,
    visualMgr?: VisualFeedbackManager,
    audioMgr?: AudioFeedbackManager
  ) {
    // Use provided managers or defaults
    this.timerManager = timerMgr || new TimerManager();
    this.visualFeedbackManager = visualMgr || visualFeedbackManager;
    this.audioFeedbackManager = audioMgr || audioFeedbackManager;

    // Initialize default state
    this.sessionState = this.createInitialState();
    this.config = { ...DEFAULT_CONFIG };
    this.adaptiveSettings = this.createInitialAdaptiveSettings();
    this.timerStats = this.createInitialTimerStats();
  }

  // ============================================
  // SESSION LIFECYCLE MANAGEMENT
  // ============================================

  /**
   * Start an interactive workout session
   * 
   * @param workout - The DailyWorkout to track
   * @param config - Optional session configuration
   * @returns Promise that resolves when session starts
   * 
   * Requirements: 1.1, 4.5
   */
  async startInteractiveSession(
    workout: DailyWorkout,
    config?: Partial<InteractiveSessionConfig>
  ): Promise<void> {
    if (this.sessionState.isActive) {
      throw new Error('Cannot start session: A session is already active');
    }

    // Store workout and config
    this.workout = workout;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Reset state
    this.exerciseIndex = 0;
    this.triggeredMilestones.clear();
    this.adaptiveAdjustments = [];
    this.timerStats = this.createInitialTimerStats();

    // Determine initial phase based on workout structure
    const initialPhase = this.determinePhase(0);

    // Update session state
    this.sessionState = {
      isActive: true,
      isPaused: false,
      currentPhase: initialPhase,
      currentExercise: workout.exercises[0] || null,
      currentSet: 1,
      totalSets: workout.exercises[0]?.sets.length || 0,
      completedExercises: [],
      overallProgress: 0,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: this.estimateRemainingTime(workout),
    };

    // Set initial visual theme
    this.visualFeedbackManager.setPhaseTheme(initialPhase);

    // Create and start workout timer
    this.workoutTimerId = this.timerManager.createWorkoutTimer();
    this.timerManager.startTimer(this.workoutTimerId);

    // Subscribe to timer updates
    this.subscribeToTimerUpdates();

    // Start the underlying workout session manager
    await workoutSessionManager.startSession(workout);

    // Notify subscribers
    this.notifyStateSubscribers();
    this.notifyTimerSubscribers();

    // Play start audio if enabled
    if (this.config.enableAudio) {
      await this.audioFeedbackManager.playMotivationalCue('start_exercise');
    }
  }

  /**
   * Pause the current session
   * 
   * Requirements: 1.4
   */
  pauseSession(): void {
    if (!this.sessionState.isActive || this.sessionState.isPaused) {
      return;
    }

    // Pause all active timers
    if (this.workoutTimerId) {
      this.timerManager.pauseTimer(this.workoutTimerId);
    }
    if (this.currentExerciseTimerId) {
      this.timerManager.pauseTimer(this.currentExerciseTimerId);
    }
    if (this.currentRestTimerId) {
      this.timerManager.pauseTimer(this.currentRestTimerId);
    }

    // Update state
    this.sessionState = {
      ...this.sessionState,
      isPaused: true,
    };

    // Pause underlying session
    workoutSessionManager.pauseSession();

    // Notify subscribers
    this.notifyStateSubscribers();
  }

  /**
   * Resume a paused session
   * 
   * Requirements: 1.4
   */
  resumeSession(): void {
    if (!this.sessionState.isActive || !this.sessionState.isPaused) {
      return;
    }

    // Resume all paused timers
    if (this.workoutTimerId) {
      this.timerManager.resumeTimer(this.workoutTimerId);
    }
    if (this.currentExerciseTimerId) {
      this.timerManager.resumeTimer(this.currentExerciseTimerId);
    }
    if (this.currentRestTimerId) {
      this.timerManager.resumeTimer(this.currentRestTimerId);
    }

    // Update state
    this.sessionState = {
      ...this.sessionState,
      isPaused: false,
    };

    // Resume underlying session
    workoutSessionManager.resumeSession();

    // Notify subscribers
    this.notifyStateSubscribers();
  }

  /**
   * End the current session
   * 
   * @returns WorkoutSummary with session data
   * 
   * Requirements: 1.4
   */
  async endSession(): Promise<WorkoutSummary> {
    if (!this.sessionState.isActive) {
      throw new Error('Cannot end session: No active session');
    }

    // Stop all timers
    this.timerManager.clearAllTimers();
    this.workoutTimerId = null;
    this.currentExerciseTimerId = null;
    this.currentRestTimerId = null;

    // Unsubscribe from timer updates
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }

    // End underlying session and get summary
    const summary = await workoutSessionManager.endSession();

    // Trigger completion milestone
    await this.triggerMilestone('complete');

    // Clean up visual feedback
    this.visualFeedbackManager.cleanup();

    // Reset session state
    this.sessionState = this.createInitialState();
    this.workout = null;

    // Notify subscribers
    this.notifyStateSubscribers();

    return summary;
  }

  // ============================================
  // EXERCISE FLOW MANAGEMENT
  // ============================================

  /**
   * Start tracking a specific exercise
   * 
   * @param exercise - The exercise to start
   * 
   * Requirements: 1.2
   */
  startExercise(exercise: ExerciseLog): void {
    if (!this.sessionState.isActive || this.sessionState.isPaused) {
      return;
    }

    // Clear any existing rest timer
    if (this.currentRestTimerId) {
      this.timerManager.clearTimer(this.currentRestTimerId);
      this.currentRestTimerId = null;
    }

    // Update current exercise in state
    this.sessionState = {
      ...this.sessionState,
      currentExercise: exercise,
      currentSet: 1,
      totalSets: exercise.sets.length,
    };

    // Start exercise tracking in workout session manager
    workoutSessionManager.startExercise(exercise.id);

    // Create exercise timer if duration is specified
    if (exercise.suggestedDuration && exercise.suggestedDuration > 0) {
      this.currentExerciseTimerId = this.timerManager.createExerciseTimer(
        exercise.suggestedDuration,
        exercise.id
      );
      this.timerManager.startTimer(this.currentExerciseTimerId);
      this.timerStats.totalTimers++;
    }

    // Update visual theme based on exercise phase
    const phase = this.determinePhaseForExercise(exercise);
    if (phase !== this.sessionState.currentPhase) {
      this.transitionToPhase(phase);
    }

    // Notify subscribers
    this.notifyStateSubscribers();
    this.notifyTimerSubscribers();
  }

  /**
   * Complete the current exercise
   * 
   * @param exerciseId - ID of the exercise to complete
   * 
   * Requirements: 1.2, 4.3
   */
  completeExercise(exerciseId: string): void {
    if (!this.sessionState.isActive || !this.sessionState.currentExercise) {
      return;
    }

    if (this.sessionState.currentExercise.id !== exerciseId) {
      return;
    }

    // Clear exercise timer if exists
    if (this.currentExerciseTimerId) {
      const timer = this.timerManager.getTimer(this.currentExerciseTimerId);
      if (timer && timer.state !== 'completed') {
        this.timerStats.skippedTimers++;
      } else if (timer && timer.state === 'completed') {
        this.timerStats.completedTimers++;
      }
      this.timerManager.clearTimer(this.currentExerciseTimerId);
      this.currentExerciseTimerId = null;
    }

    // End exercise tracking
    workoutSessionManager.endExercise(exerciseId);

    // Add to completed exercises
    const completedExercises = [...this.sessionState.completedExercises, exerciseId];

    // Calculate new progress (monotonically non-decreasing)
    const newProgress = this.calculateProgress(completedExercises.length);
    const progress = Math.max(this.sessionState.overallProgress, newProgress);

    // Update state
    this.sessionState = {
      ...this.sessionState,
      completedExercises,
      overallProgress: progress,
      currentExercise: null,
    };

    // Animate exercise completion
    this.visualFeedbackManager.animateExerciseCompletion(exerciseId);
    this.visualFeedbackManager.updateOverallProgress(progress);

    // Play transition audio
    if (this.config.enableAudio) {
      this.audioFeedbackManager.playExerciseTransition();
    }

    // Check for milestones
    this.checkMilestones(progress);

    // Notify subscribers
    this.notifyStateSubscribers();
  }

  /**
   * Skip to the next exercise
   * 
   * Requirements: 1.2
   */
  skipToNextExercise(): void {
    if (!this.sessionState.isActive || !this.workout) {
      return;
    }

    // Complete current exercise if one is active
    if (this.sessionState.currentExercise) {
      this.completeExercise(this.sessionState.currentExercise.id);
    }

    // Clear any rest timer
    if (this.currentRestTimerId) {
      this.timerStats.skippedTimers++;
      this.timerManager.clearTimer(this.currentRestTimerId);
      this.currentRestTimerId = null;
    }

    // Move to next exercise
    this.exerciseIndex++;
    if (this.exerciseIndex < this.workout.exercises.length) {
      const nextExercise = this.workout.exercises[this.exerciseIndex];
      this.startExercise(nextExercise);
    }
  }

  /**
   * Complete a set and start rest timer
   * 
   * @param setIndex - Index of the completed set
   * 
   * Requirements: 1.2
   */
  completeSet(setIndex: number): void {
    if (!this.sessionState.isActive || !this.sessionState.currentExercise) {
      return;
    }

    const exercise = this.sessionState.currentExercise;

    // Record set completion in workout session manager
    const setId = exercise.sets[setIndex]?.id;
    if (setId) {
      workoutSessionManager.completeSet(exercise.id, setId);
    }

    // Animate set completion
    this.visualFeedbackManager.animateSetCompletion(setId || `set-${setIndex}`);

    // Update current set
    const nextSet = setIndex + 2; // setIndex is 0-based, currentSet is 1-based
    this.sessionState = {
      ...this.sessionState,
      currentSet: Math.min(nextSet, this.sessionState.totalSets),
    };

    // Start rest timer if auto-rest is enabled and not the last set
    if (this.config.enableAutoRest && nextSet <= this.sessionState.totalSets) {
      this.startRestTimer(exercise);
    }

    // Notify subscribers
    this.notifyStateSubscribers();
  }

  /**
   * Start a rest timer after set completion
   * 
   * @param exercise - The current exercise
   */
  private startRestTimer(exercise: ExerciseLog): void {
    // Clear any existing rest timer
    if (this.currentRestTimerId) {
      this.timerManager.clearTimer(this.currentRestTimerId);
    }

    // Determine rest duration
    const restDuration = this.getRestDuration(exercise);

    // Create and start rest timer
    const setId = `rest-${exercise.id}-${this.sessionState.currentSet}`;
    this.currentRestTimerId = this.timerManager.createRestTimer(restDuration, setId);
    this.timerManager.startTimer(this.currentRestTimerId);
    this.timerStats.totalTimers++;
    this.timerStats.totalRestTime += restDuration;

    // Notify subscribers
    this.notifyTimerSubscribers();
  }

  /**
   * Skip the current rest timer
   */
  skipRestTimer(): void {
    if (this.currentRestTimerId) {
      this.timerStats.skippedTimers++;
      this.timerManager.clearTimer(this.currentRestTimerId);
      this.currentRestTimerId = null;

      // Play rest over audio
      if (this.config.enableAudio) {
        this.audioFeedbackManager.playMotivationalCue('rest_over');
      }

      this.notifyTimerSubscribers();
    }
  }

  /**
   * Adjust the current rest timer
   * 
   * @param adjustmentSeconds - Seconds to add (positive) or subtract (negative)
   */
  adjustRestTimer(adjustmentSeconds: number): void {
    if (this.currentRestTimerId) {
      this.timerManager.adjustTimer(this.currentRestTimerId, adjustmentSeconds);

      // Record adjustment for adaptive learning
      const timer = this.timerManager.getTimer(this.currentRestTimerId);
      if (timer) {
        const adjustment: TimerAdjustment = {
          timerId: this.currentRestTimerId,
          originalDuration: timer.duration - adjustmentSeconds,
          adjustedDuration: timer.duration,
          adjustmentReason: 'user_preference',
          timestamp: new Date(),
        };
        this.adaptiveSettings.timerAdjustmentHistory.push(adjustment);
      }

      this.notifyTimerSubscribers();
    }
  }

  // ============================================
  // TIMER MANAGEMENT
  // ============================================

  /**
   * Get all active timers
   * 
   * @returns Array of ActiveTimer objects
   */
  getActiveTimers(): ActiveTimer[] {
    return this.timerManager.getActiveTimersWithDisplay();
  }

  /**
   * Subscribe to timer updates (public API)
   * 
   * @param callback - Function called with timer updates
   * @returns Subscription handle
   */
  subscribeToTimerUpdatesPublic(callback: TimerUpdateCallback): Subscription {
    this.timerSubscribers.add(callback);

    // Immediately notify with current timers
    callback(this.getActiveTimers());

    return {
      unsubscribe: () => {
        this.timerSubscribers.delete(callback);
      },
    };
  }

  /**
   * Internal subscription to timer manager updates
   */
  private subscribeToTimerUpdates(): void {
    this.timerSubscription = this.timerManager.subscribeToAllTimers((timers) => {
      this.handleTimerUpdates(timers);
    });
  }

  /**
   * Handle timer updates from timer manager
   * 
   * @param timers - Array of updated timers
   */
  private handleTimerUpdates(timers: Timer[]): void {
    // Update elapsed seconds from workout timer
    const workoutTimer = timers.find(t => t.id === this.workoutTimerId);
    if (workoutTimer) {
      this.sessionState = {
        ...this.sessionState,
        elapsedSeconds: workoutTimer.elapsed,
      };
    }

    // Check for timer completions
    for (const timer of timers) {
      if (timer.state === 'completed') {
        this.handleTimerCompletion(timer);
      }
    }

    // Update visual progress for active timers
    for (const timer of timers) {
      if (timer.state === 'running' && timer.type !== 'workout') {
        const progress = timer.duration > 0 
          ? (timer.duration - timer.remaining) / timer.duration 
          : 0;
        this.visualFeedbackManager.updateTimerProgress(timer.id, progress);
      }
    }

    // Notify subscribers
    this.notifyTimerSubscribers();
    this.notifyStateSubscribers();
  }

  /**
   * Handle timer completion events
   * 
   * @param timer - The completed timer
   */
  private async handleTimerCompletion(timer: Timer): Promise<void> {
    this.timerStats.completedTimers++;

    // Play completion audio
    if (this.config.enableAudio) {
      await this.audioFeedbackManager.playTimerCompletion(timer.type);
    }

    // Show visual completion
    await this.visualFeedbackManager.showTimerCompletion(timer.id);

    // Handle specific timer types
    if (timer.type === 'exercise' && timer.id === this.currentExerciseTimerId) {
      this.timerStats.totalExerciseTime += timer.duration;
      // Exercise timer completed - could auto-complete exercise or wait for user
    } else if (timer.type === 'rest' && timer.id === this.currentRestTimerId) {
      // Rest timer completed - play motivational cue
      if (this.config.enableAudio) {
        await this.audioFeedbackManager.playMotivationalCue('rest_over');
      }
      this.currentRestTimerId = null;
    }
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * Get current session state
   * 
   * @returns Current InteractiveSessionState
   */
  getSessionState(): InteractiveSessionState {
    return { ...this.sessionState };
  }

  /**
   * Subscribe to session state changes
   * 
   * @param callback - Function called with state updates
   * @returns Subscription handle
   */
  subscribeToStateChanges(callback: SessionStateCallback): Subscription {
    this.stateSubscribers.add(callback);

    // Immediately notify with current state
    callback(this.getSessionState());

    return {
      unsubscribe: () => {
        this.stateSubscribers.delete(callback);
      },
    };
  }

  /**
   * Notify all state subscribers
   */
  private notifyStateSubscribers(): void {
    const state = this.getSessionState();
    this.stateSubscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('InteractiveWorkoutSession: Error in state subscriber:', error);
      }
    });
  }

  /**
   * Notify all timer subscribers
   */
  private notifyTimerSubscribers(): void {
    const timers = this.getActiveTimers();
    this.timerSubscribers.forEach(callback => {
      try {
        callback(timers);
      } catch (error) {
        console.error('InteractiveWorkoutSession: Error in timer subscriber:', error);
      }
    });
  }

  // ============================================
  // PHASE AND PROGRESS MANAGEMENT
  // ============================================

  /**
   * Transition to a new workout phase
   * 
   * @param newPhase - The phase to transition to
   */
  private async transitionToPhase(newPhase: WorkoutPhase): Promise<void> {
    const oldPhase = this.sessionState.currentPhase;

    // Animate phase transition
    await this.visualFeedbackManager.animatePhaseTransition(oldPhase, newPhase);

    // Update state
    this.sessionState = {
      ...this.sessionState,
      currentPhase: newPhase,
    };

    this.notifyStateSubscribers();
  }

  /**
   * Determine workout phase based on exercise index
   * 
   * @param index - Exercise index
   * @returns WorkoutPhase
   */
  private determinePhase(index: number): WorkoutPhase {
    if (!this.workout) return 'warmup';

    const totalExercises = this.workout.exercises.length;
    if (totalExercises === 0) return 'warmup';

    const progress = index / totalExercises;

    if (progress < 0.15) return 'warmup';
    if (progress < 0.75) return 'strength';
    if (progress < 0.9) return 'core';
    return 'cooldown';
  }

  /**
   * Determine phase for a specific exercise
   * 
   * @param exercise - The exercise to check
   * @returns WorkoutPhase
   */
  private determinePhaseForExercise(exercise: ExerciseLog): WorkoutPhase {
    const targetGroup = exercise.targetGroup.toLowerCase();

    if (targetGroup === 'core') return 'core';
    if (targetGroup === 'cardio') return 'warmup';
    return 'strength';
  }

  /**
   * Calculate overall progress percentage
   * 
   * @param completedCount - Number of completed exercises
   * @returns Progress percentage (0-100)
   * 
   * Requirements: 4.3
   */
  private calculateProgress(completedCount: number): number {
    if (!this.workout || this.workout.exercises.length === 0) {
      return 0;
    }

    const progress = (completedCount / this.workout.exercises.length) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  /**
   * Check and trigger milestones based on progress
   * 
   * @param progress - Current progress percentage
   * 
   * Requirements: 4.3
   */
  private checkMilestones(progress: number): void {
    const milestoneTypes: Array<'quarter' | 'half' | 'three_quarters'> = [
      'quarter',
      'half',
      'three_quarters',
    ];

    for (const type of milestoneTypes) {
      const threshold = MILESTONE_THRESHOLDS[type];
      if (progress >= threshold && !this.triggeredMilestones.has(type)) {
        this.triggerMilestone(type);
      }
    }
  }

  /**
   * Trigger a milestone celebration
   * 
   * @param type - Milestone type
   */
  private async triggerMilestone(
    type: 'quarter' | 'half' | 'three_quarters' | 'complete'
  ): Promise<void> {
    if (this.triggeredMilestones.has(type)) {
      return;
    }

    this.triggeredMilestones.add(type);

    const milestone = this.createMilestone(type);

    // Animate milestone
    await this.visualFeedbackManager.animateMilestone(milestone);

    // Play milestone sound
    if (this.config.enableAudio) {
      await this.audioFeedbackManager.playMilestoneSound(milestone);
    }
  }

  /**
   * Create a milestone object
   * 
   * @param type - Milestone type
   * @returns WorkoutMilestone
   */
  private createMilestone(
    type: 'quarter' | 'half' | 'three_quarters' | 'complete'
  ): WorkoutMilestone {
    const milestones: Record<typeof type, WorkoutMilestone> = {
      quarter: {
        type: 'quarter',
        message: 'Great start! 25% complete!',
        celebrationLevel: 'small',
      },
      half: {
        type: 'half',
        message: 'Halfway there! Keep it up!',
        celebrationLevel: 'medium',
      },
      three_quarters: {
        type: 'three_quarters',
        message: 'Almost done! Final push!',
        celebrationLevel: 'medium',
      },
      complete: {
        type: 'complete',
        message: 'Workout Complete! Amazing job!',
        celebrationLevel: 'large',
      },
    };

    return milestones[type];
  }

  // ============================================
  // ADAPTIVE TIMER SUGGESTIONS
  // ============================================

  /**
   * Get rest duration for an exercise
   * 
   * @param exercise - The exercise
   * @returns Rest duration in seconds
   */
  private getRestDuration(exercise: ExerciseLog): number {
    // Check for custom rest duration in exercise
    if (exercise.restDurations && exercise.restDurations.length > 0) {
      const setIndex = this.sessionState.currentSet - 1;
      if (setIndex < exercise.restDurations.length) {
        return exercise.restDurations[setIndex];
      }
    }

    // Check adaptive settings for preferred duration
    if (this.config.enableAdaptiveSuggestions) {
      const preferred = this.adaptiveSettings.preferredRestDurations[exercise.id];
      if (preferred) {
        return preferred;
      }
    }

    // Use default based on target group
    const targetGroup = exercise.targetGroup.toLowerCase();
    return DEFAULT_REST_DURATIONS[targetGroup] || this.config.defaultRestDuration;
  }

  /**
   * Estimate remaining workout time
   * 
   * @param workout - The workout
   * @returns Estimated remaining seconds
   */
  private estimateRemainingTime(workout: DailyWorkout): number {
    let totalSeconds = 0;

    for (const exercise of workout.exercises) {
      // Estimate time per exercise (sets * (exercise time + rest time))
      const setsCount = exercise.sets.length;
      const exerciseTime = exercise.suggestedDuration || 45; // Default 45s per set
      const restTime = this.config.defaultRestDuration;

      totalSeconds += setsCount * (exerciseTime + restTime);
    }

    return totalSeconds;
  }

  // ============================================
  // SESSION DATA
  // ============================================

  /**
   * Get interactive session data for workout summary
   * 
   * @returns InteractiveSessionData
   */
  getSessionData(): InteractiveSessionData {
    return {
      totalDuration: this.sessionState.elapsedSeconds,
      phaseDurations: {
        warmup: 0,
        strength: 0,
        core: 0,
        cooldown: 0,
      },
      timerStats: { ...this.timerStats },
      adaptiveAdjustments: [...this.adaptiveAdjustments],
      milestones: Array.from(this.triggeredMilestones).map(type => 
        this.createMilestone(type as 'quarter' | 'half' | 'three_quarters' | 'complete')
      ),
    };
  }

  /**
   * Get adaptive settings
   * 
   * @returns AdaptiveSettings
   */
  getAdaptiveSettings(): AdaptiveSettings {
    return { ...this.adaptiveSettings };
  }

  // ============================================
  // INITIALIZATION HELPERS
  // ============================================

  /**
   * Create initial session state
   */
  private createInitialState(): InteractiveSessionState {
    return {
      isActive: false,
      isPaused: false,
      currentPhase: 'warmup',
      currentExercise: null,
      currentSet: 0,
      totalSets: 0,
      completedExercises: [],
      overallProgress: 0,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: 0,
    };
  }

  /**
   * Create initial adaptive settings
   */
  private createInitialAdaptiveSettings(): AdaptiveSettings {
    return {
      preferredRestDurations: {},
      averageHeartRateRecovery: 60,
      workoutIntensityLevel: 'moderate',
      timerAdjustmentHistory: [],
    };
  }

  /**
   * Create initial timer statistics
   */
  private createInitialTimerStats(): TimerStatistics {
    return {
      totalTimers: 0,
      completedTimers: 0,
      skippedTimers: 0,
      averageTimerAccuracy: 1.0,
      totalRestTime: 0,
      totalExerciseTime: 0,
    };
  }

  // ============================================
  // TESTING HELPERS
  // ============================================

  /**
   * Reset session for testing
   */
  _resetForTesting(): void {
    this.timerManager.clearAllTimers();
    this.sessionState = this.createInitialState();
    this.config = { ...DEFAULT_CONFIG };
    this.workout = null;
    this.workoutTimerId = null;
    this.currentExerciseTimerId = null;
    this.currentRestTimerId = null;
    this.exerciseIndex = 0;
    this.adaptiveSettings = this.createInitialAdaptiveSettings();
    this.timerStats = this.createInitialTimerStats();
    this.adaptiveAdjustments = [];
    this.triggeredMilestones.clear();
    this.stateSubscribers.clear();
    this.timerSubscribers.clear();
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

  /**
   * Get timer manager for testing
   */
  _getTimerManager(): TimerManager {
    return this.timerManager;
  }

  /**
   * Get current config for testing
   */
  _getConfig(): InteractiveSessionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const interactiveWorkoutSession = new InteractiveWorkoutSession();

// Export class for testing
export { InteractiveWorkoutSession as InteractiveWorkoutSessionClass };
