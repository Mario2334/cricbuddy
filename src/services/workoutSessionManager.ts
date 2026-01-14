/**
 * Workout Session Manager Module
 * 
 * This module orchestrates workout tracking, combining local state with health metrics.
 * It manages session lifecycle, real-time metrics collection, and exercise-level tracking.
 * It also handles background workout tracking and session recovery.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.4, 5.1, 5.2, 8.1, 8.2, 8.4
 */

import type { DailyWorkout, ExerciseLog } from '../types/fitness';
import type {
  HeartRateSample,
  ExerciseHealthMetrics,
  WorkoutSummary,
  RealTimeMetrics,
  SessionState,
  WorkoutContext,
  HealthKitWorkout,
  HKWorkoutActivityType,
} from '../types/health';
import { healthKitService, Subscription as HKSubscription } from './healthKitService';
import { watchConnectivityService } from './watchConnectivityService';
import { fitnessService } from './fitnessService';
import { 
  backgroundWorkoutService, 
  BackgroundStateChange,
  PersistedSessionState,
  Subscription as BGSubscription 
} from './backgroundWorkoutService';
import { workoutNotificationService } from './workoutNotificationService';

/**
 * Subscription handle for metrics updates
 */
export interface Subscription {
  remove: () => void;
}

/**
 * Active session information
 */
export interface ActiveSession {
  id: string;
  startTime: Date;
  workout: DailyWorkout;
  healthKitWorkoutId?: string;
}

/**
 * Internal exercise tracking state
 */
interface ExerciseTrackingState {
  exerciseId: string;
  startTime: Date;
  heartRateSamples: HeartRateSample[];
  caloriesAtStart: number;
}

// Heart rate collection interval in milliseconds (5 seconds)
const HEART_RATE_COLLECTION_INTERVAL_MS = 5000;

/**
 * WorkoutSessionManager class orchestrates workout tracking
 */
class WorkoutSessionManager {
  // Session state
  private sessionState: SessionState = 'idle';
  private activeSession: ActiveSession | null = null;
  private sessionStartTime: Date | null = null;
  private pausedDuration: number = 0; // Total paused time in ms
  private pauseStartTime: Date | null = null;

  // Metrics tracking
  private allHeartRateSamples: HeartRateSample[] = [];
  private currentHeartRate: number | null = null;
  private currentHeartRateTimestamp: Date | null = null;
  private cumulativeCalories: number = 0;
  private caloriesAtSessionStart: number = 0;

  // Exercise tracking
  private currentExerciseState: ExerciseTrackingState | null = null;
  private completedExerciseMetrics: Map<string, ExerciseHealthMetrics> = new Map();

  // Subscriptions
  private heartRateSubscription: HKSubscription | null = null;
  private metricsSubscribers: Map<string, (metrics: RealTimeMetrics) => void> = new Map();
  private metricsUpdateInterval: ReturnType<typeof setInterval> | null = null;

  // Background tracking (Task 9)
  private backgroundStateSubscription: BGSubscription | null = null;
  private isInBackground: boolean = false;
  private backgroundSamplesCollected: number = 0;

  constructor() {
    // Constructor is lightweight - initialization happens in startSession
  }

  // ============================================
  // Background Tracking Integration (Task 9.2)
  // ============================================

  /**
   * Initialize background tracking support
   * 
   * Requirements: 8.1, 8.2, 8.4
   */
  private initializeBackgroundTracking(): void {
    // Subscribe to app state changes
    this.backgroundStateSubscription = backgroundWorkoutService.subscribeToStateChanges(
      (change: BackgroundStateChange) => {
        this.handleBackgroundStateChange(change);
      }
    );

    // Start background collection
    backgroundWorkoutService.startBackgroundCollection();

    // Register termination handler (Task 9.5)
    backgroundWorkoutService.registerTerminationHandler(async () => {
      await this.savePartialWorkout();
    });
  }

  /**
   * Handle app state changes for background tracking
   * 
   * @param change - BackgroundStateChange event
   * 
   * Requirements: 8.1, 8.2
   */
  private handleBackgroundStateChange(change: BackgroundStateChange): void {
    const wasInBackground = this.isInBackground;
    this.isInBackground = change.currentState === 'background';

    // Entering background
    if (!wasInBackground && this.isInBackground) {
      this.onEnterBackground();
    }

    // Returning to foreground
    if (wasInBackground && !this.isInBackground) {
      this.onReturnToForeground();
    }
  }

  /**
   * Called when app enters background during active workout
   * 
   * Requirements: 8.1, 8.3
   */
  private onEnterBackground(): void {
    if (this.sessionState !== 'active' && this.sessionState !== 'paused') {
      return;
    }

    // Show persistent notification (Task 9.2)
    this.showBackgroundNotification();

    // Persist session state for recovery
    this.persistSessionState();
  }

  /**
   * Show persistent notification for background workout
   * 
   * Requirements: 8.3
   */
  private showBackgroundNotification(): void {
    if (!this.activeSession) {
      return;
    }

    const workoutName = this.activeSession.workout.focusAreas?.join(', ') || 'Workout';
    const content = workoutNotificationService.buildNotificationContent(
      workoutName,
      this.currentHeartRate,
      this.cumulativeCalories,
      this.calculateElapsedSeconds()
    );

    workoutNotificationService.showWorkoutNotification(content);
  }

  /**
   * Update the background notification with current metrics
   * 
   * Requirements: 8.3
   */
  private updateBackgroundNotification(): void {
    if (!this.activeSession || !this.isInBackground) {
      return;
    }

    const workoutName = this.activeSession.workout.focusAreas?.join(', ') || 'Workout';
    const content = workoutNotificationService.buildNotificationContent(
      workoutName,
      this.currentHeartRate,
      this.cumulativeCalories,
      this.calculateElapsedSeconds()
    );

    workoutNotificationService.updateWorkoutNotification(content);
  }

  /**
   * Called when app returns to foreground during active workout
   * 
   * Requirements: 8.2
   */
  private onReturnToForeground(): void {
    if (this.sessionState !== 'active' && this.sessionState !== 'paused') {
      return;
    }

    // Hide the background notification
    workoutNotificationService.hideWorkoutNotification();

    // Merge any samples collected during background operation
    this.mergeBackgroundSamples();
  }

  /**
   * Merge samples collected during background operation
   * 
   * Requirements: 8.2
   */
  private mergeBackgroundSamples(): void {
    const backgroundSamples = backgroundWorkoutService.getBackgroundSamples();
    
    if (backgroundSamples.length > 0) {
      // Add background samples to session collection
      for (const sample of backgroundSamples) {
        // Avoid duplicates by checking timestamp
        const isDuplicate = this.allHeartRateSamples.some(
          s => s.timestamp.getTime() === sample.timestamp.getTime()
        );
        
        if (!isDuplicate) {
          this.allHeartRateSamples.push(sample);
          this.backgroundSamplesCollected++;
          
          // Also add to current exercise if tracking
          if (this.currentExerciseState) {
            this.currentExerciseState.heartRateSamples.push(sample);
          }
        }
      }

      // Update current heart rate to most recent sample
      if (backgroundSamples.length > 0) {
        const mostRecent = backgroundSamples[backgroundSamples.length - 1];
        this.currentHeartRate = mostRecent.value;
        this.currentHeartRateTimestamp = mostRecent.timestamp;
      }

      // Clear background samples after merging
      backgroundWorkoutService.clearBackgroundSamples();

      // Notify subscribers of updated metrics
      this.notifyMetricsSubscribers();
    }
  }

  /**
   * Persist session state for recovery after termination
   * 
   * Requirements: 3.5, 8.4
   */
  private async persistSessionState(): Promise<void> {
    if (!this.activeSession || !this.sessionStartTime) {
      return;
    }

    const state: PersistedSessionState = {
      sessionId: this.activeSession.id,
      workoutId: this.activeSession.workout.id,
      startTime: this.sessionStartTime.toISOString(),
      pausedDuration: this.pausedDuration,
      workout: this.activeSession.workout,
      heartRateSamples: this.allHeartRateSamples.map(s => ({
        ...s,
        timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp),
      })),
      cumulativeCalories: this.cumulativeCalories,
      lastUpdateTime: new Date().toISOString(),
      isActive: this.sessionState === 'active' || this.sessionState === 'paused',
    };

    await backgroundWorkoutService.saveSessionState(state);
  }

  /**
   * Clean up background tracking resources
   */
  private cleanupBackgroundTracking(): void {
    if (this.backgroundStateSubscription) {
      this.backgroundStateSubscription.remove();
      this.backgroundStateSubscription = null;
    }
    backgroundWorkoutService.stopBackgroundCollection();
    backgroundWorkoutService.unregisterTerminationHandler();
    workoutNotificationService.hideWorkoutNotification();
    this.isInBackground = false;
    this.backgroundSamplesCollected = 0;
  }

  /**
   * Get count of samples collected during background operation
   * 
   * Requirements: 8.2
   */
  getBackgroundSamplesCollected(): number {
    return this.backgroundSamplesCollected;
  }

  /**
   * Check if app is currently in background
   */
  isAppInBackground(): boolean {
    return this.isInBackground;
  }

  // ============================================
  // Session Lifecycle Methods (Task 6.1)
  // ============================================

  /**
   * Start a new workout session
   * 
   * @param workout - The DailyWorkout to track
   * @returns ActiveSession with session details
   * 
   * Requirements: 3.1, 3.2, 8.1
   */
  async startSession(workout: DailyWorkout): Promise<ActiveSession> {
    if (this.sessionState !== 'idle') {
      throw new Error('Cannot start session: A session is already active');
    }

    // Generate session ID
    const sessionId = this.generateSessionId();
    const startTime = new Date();

    // Initialize session state
    this.sessionState = 'active';
    this.sessionStartTime = startTime;
    this.pausedDuration = 0;
    this.pauseStartTime = null;

    // Reset metrics
    this.allHeartRateSamples = [];
    this.currentHeartRate = null;
    this.currentHeartRateTimestamp = null;
    this.cumulativeCalories = 0;
    this.completedExerciseMetrics.clear();
    this.currentExerciseState = null;
    this.backgroundSamplesCollected = 0;

    // Get initial calorie count for delta calculation
    this.caloriesAtSessionStart = await healthKitService.getActiveCalories(
      new Date(startTime.getTime() - 60000), // 1 minute before
      startTime
    );

    // Subscribe to heart rate updates
    this.startHeartRateTracking();

    // Start metrics update interval
    this.startMetricsUpdateInterval();

    // Initialize background tracking (Task 9.2)
    this.initializeBackgroundTracking();

    // Create active session
    this.activeSession = {
      id: sessionId,
      startTime,
      workout,
    };

    // Notify Watch of workout start
    this.notifyWatchWorkoutStart(workout);

    return { ...this.activeSession };
  }

  /**
   * End the current workout session
   * 
   * @returns WorkoutSummary with aggregated metrics
   * 
   * Requirements: 3.4, 3.5, 8.4
   */
  async endSession(): Promise<WorkoutSummary> {
    if (this.sessionState !== 'active' && this.sessionState !== 'paused') {
      throw new Error('Cannot end session: No active session');
    }

    this.sessionState = 'ending';

    // If paused, account for final pause duration
    if (this.pauseStartTime) {
      this.pausedDuration += Date.now() - this.pauseStartTime.getTime();
      this.pauseStartTime = null;
    }

    // Merge any remaining background samples before ending
    this.mergeBackgroundSamples();

    // Stop heart rate tracking
    this.stopHeartRateTracking();

    // Stop metrics update interval
    this.stopMetricsUpdateInterval();

    // Clean up background tracking (Task 9.2)
    this.cleanupBackgroundTracking();

    // Clear persisted session state (Task 9.5)
    await backgroundWorkoutService.clearSessionState();

    // Generate workout summary
    const summary = this.generateWorkoutSummary();

    // Save workout to HealthKit
    if (this.activeSession) {
      try {
        const healthKitWorkoutId = await this.saveToHealthKit(summary);
        this.activeSession.healthKitWorkoutId = healthKitWorkoutId;

        // Update the workout with health metrics
        await this.updateWorkoutWithMetrics(summary, healthKitWorkoutId);
      } catch (error) {
        console.error('WorkoutSessionManager: Failed to save to HealthKit:', error);
        // Still complete the session even if HealthKit save fails
      }
    }

    // Notify Watch of workout end
    this.notifyWatchWorkoutEnd(summary);

    // Reset session state
    this.sessionState = 'idle';
    this.activeSession = null;
    this.sessionStartTime = null;

    return summary;
  }

  /**
   * Pause the current workout session
   * 
   * Requirements: 3.1
   */
  pauseSession(): void {
    if (this.sessionState !== 'active') {
      throw new Error('Cannot pause session: Session is not active');
    }

    this.sessionState = 'paused';
    this.pauseStartTime = new Date();

    // Update Watch context
    this.updateWatchContext();
  }

  /**
   * Resume a paused workout session
   * 
   * Requirements: 3.1
   */
  resumeSession(): void {
    if (this.sessionState !== 'paused') {
      throw new Error('Cannot resume session: Session is not paused');
    }

    // Calculate paused duration
    if (this.pauseStartTime) {
      this.pausedDuration += Date.now() - this.pauseStartTime.getTime();
      this.pauseStartTime = null;
    }

    this.sessionState = 'active';

    // Update Watch context
    this.updateWatchContext();
  }

  // ============================================
  // Real-time Metrics Collection (Task 6.2)
  // ============================================

  /**
   * Subscribe to real-time metrics updates
   * 
   * @param callback - Function called with updated metrics
   * @returns Subscription handle
   * 
   * Requirements: 3.3, 4.1, 4.2
   */
  subscribeToMetrics(callback: (metrics: RealTimeMetrics) => void): Subscription {
    const subscriptionId = this.generateSubscriptionId();
    this.metricsSubscribers.set(subscriptionId, callback);

    // Immediately notify with current metrics
    callback(this.getCurrentMetrics());

    return {
      remove: () => {
        this.metricsSubscribers.delete(subscriptionId);
      },
    };
  }

  /**
   * Get current real-time metrics
   * 
   * @returns Current RealTimeMetrics
   * 
   * Requirements: 4.1, 4.2
   */
  getCurrentMetrics(): RealTimeMetrics {
    const elapsedSeconds = this.calculateElapsedSeconds();

    return {
      heartRate: this.currentHeartRate,
      heartRateTimestamp: this.currentHeartRateTimestamp,
      activeCalories: this.cumulativeCalories,
      elapsedSeconds,
      currentExerciseMetrics: this.getCurrentExerciseMetrics(),
    };
  }

  /**
   * Start heart rate tracking subscription
   */
  private startHeartRateTracking(): void {
    this.heartRateSubscription = healthKitService.subscribeToHeartRate((sample) => {
      this.handleHeartRateSample(sample);
    });
  }

  /**
   * Stop heart rate tracking subscription
   */
  private stopHeartRateTracking(): void {
    if (this.heartRateSubscription) {
      this.heartRateSubscription.remove();
      this.heartRateSubscription = null;
    }
  }

  /**
   * Handle incoming heart rate sample
   * 
   * @param sample - HeartRateSample from HealthKit
   * 
   * Requirements: 3.3, 4.1, 8.1
   */
  private handleHeartRateSample(sample: HeartRateSample): void {
    // Store sample in session-wide collection
    this.allHeartRateSamples.push(sample);

    // Update current heart rate
    this.currentHeartRate = sample.value;
    this.currentHeartRateTimestamp = sample.timestamp;

    // If tracking an exercise, add to exercise samples
    if (this.currentExerciseState) {
      this.currentExerciseState.heartRateSamples.push(sample);
    }

    // Store in background service for recovery (Task 9.2)
    if (this.isInBackground) {
      backgroundWorkoutService.addBackgroundSample(sample);
    }

    // Notify subscribers
    this.notifyMetricsSubscribers();
  }

  /**
   * Start the metrics update interval
   * Updates calories and notifies subscribers every 5 seconds
   * 
   * Requirements: 4.1, 4.2, 8.3
   */
  private startMetricsUpdateInterval(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      if (this.sessionState === 'active') {
        await this.updateCalories();
        this.notifyMetricsSubscribers();
        this.updateWatchContext();
        
        // Update background notification if in background (Task 9.2)
        if (this.isInBackground) {
          this.updateBackgroundNotification();
        }
      }
    }, HEART_RATE_COLLECTION_INTERVAL_MS);
  }

  /**
   * Stop the metrics update interval
   */
  private stopMetricsUpdateInterval(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
  }

  /**
   * Update cumulative calories from HealthKit
   * 
   * Requirements: 4.2
   */
  private async updateCalories(): Promise<void> {
    if (!this.sessionStartTime) return;

    const now = new Date();
    const totalCalories = await healthKitService.getActiveCalories(
      this.sessionStartTime,
      now
    );

    // Ensure calories only increase (monotonicity)
    if (totalCalories > this.cumulativeCalories) {
      this.cumulativeCalories = totalCalories;
    }
  }

  /**
   * Notify all metrics subscribers
   */
  private notifyMetricsSubscribers(): void {
    const metrics = this.getCurrentMetrics();
    this.metricsSubscribers.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('WorkoutSessionManager: Error in metrics subscriber:', error);
      }
    });
  }

  // ============================================
  // Exercise-Level Metrics Tracking (Task 6.5)
  // ============================================

  /**
   * Start tracking metrics for a specific exercise
   * 
   * @param exerciseId - ID of the exercise to track
   * 
   * Requirements: 5.1, 5.2
   */
  startExercise(exerciseId: string): void {
    if (this.sessionState !== 'active') {
      throw new Error('Cannot start exercise: Session is not active');
    }

    // End previous exercise if one was being tracked
    if (this.currentExerciseState) {
      this.endExercise(this.currentExerciseState.exerciseId);
    }

    this.currentExerciseState = {
      exerciseId,
      startTime: new Date(),
      heartRateSamples: [],
      caloriesAtStart: this.cumulativeCalories,
    };
  }

  /**
   * Record a set completion with current heart rate
   * 
   * @param exerciseId - ID of the exercise
   * @param setId - ID of the completed set
   * 
   * Requirements: 5.1
   */
  completeSet(exerciseId: string, setId: string): void {
    if (this.sessionState !== 'active') {
      throw new Error('Cannot complete set: Session is not active');
    }

    // Record heart rate at set completion
    if (this.currentHeartRate !== null && this.currentExerciseState) {
      const sample: HeartRateSample = {
        value: this.currentHeartRate,
        timestamp: new Date(),
        source: 'phone',
      };
      this.currentExerciseState.heartRateSamples.push(sample);
      this.allHeartRateSamples.push(sample);
    }

    // Notify Watch of set completion
    watchConnectivityService.sendMessage({
      type: 'SET_COMPLETED',
      payload: {
        workoutId: this.activeSession?.id || '',
        exerciseId,
        setId,
        completedAt: new Date().toISOString(),
        heartRateAtCompletion: this.currentHeartRate ?? undefined,
      },
    });
  }

  /**
   * End tracking for a specific exercise and calculate metrics
   * 
   * @param exerciseId - ID of the exercise to end
   * @returns ExerciseHealthMetrics for the exercise
   * 
   * Requirements: 5.2
   */
  endExercise(exerciseId: string): ExerciseHealthMetrics {
    if (!this.currentExerciseState || this.currentExerciseState.exerciseId !== exerciseId) {
      // Return empty metrics if exercise wasn't being tracked
      return {
        averageHeartRate: undefined,
        maxHeartRate: undefined,
        caloriesBurned: undefined,
        heartRateSamples: [],
      };
    }

    const samples = this.currentExerciseState.heartRateSamples;
    const caloriesBurned = this.cumulativeCalories - this.currentExerciseState.caloriesAtStart;

    // Calculate metrics from samples
    const metrics: ExerciseHealthMetrics = {
      averageHeartRate: this.calculateAverageHeartRate(samples),
      maxHeartRate: this.calculateMaxHeartRate(samples),
      caloriesBurned: caloriesBurned > 0 ? caloriesBurned : undefined,
      heartRateSamples: [...samples],
    };

    // Store completed exercise metrics
    this.completedExerciseMetrics.set(exerciseId, metrics);

    // Clear current exercise state
    this.currentExerciseState = null;

    return metrics;
  }

  /**
   * Get current exercise metrics (if tracking an exercise)
   */
  private getCurrentExerciseMetrics(): ExerciseHealthMetrics | undefined {
    if (!this.currentExerciseState) {
      return undefined;
    }

    const samples = this.currentExerciseState.heartRateSamples;
    const caloriesBurned = this.cumulativeCalories - this.currentExerciseState.caloriesAtStart;

    return {
      averageHeartRate: this.calculateAverageHeartRate(samples),
      maxHeartRate: this.calculateMaxHeartRate(samples),
      caloriesBurned: caloriesBurned > 0 ? caloriesBurned : undefined,
      heartRateSamples: [...samples],
    };
  }

  // ============================================
  // Workout Summary Generation (Task 6.8)
  // ============================================

  /**
   * Generate workout summary from collected metrics
   * 
   * @returns WorkoutSummary with aggregated data
   * 
   * Requirements: 3.4, 4.4
   */
  private generateWorkoutSummary(): WorkoutSummary {
    const duration = this.calculateElapsedSeconds();
    const averageHeartRate = this.calculateAverageHeartRate(this.allHeartRateSamples);
    const maxHeartRate = this.calculateMaxHeartRate(this.allHeartRateSamples);

    // Collect all exercise metrics
    const exerciseMetrics: ExerciseHealthMetrics[] = [];
    this.completedExerciseMetrics.forEach((metrics) => {
      exerciseMetrics.push(metrics);
    });

    return {
      duration,
      averageHeartRate,
      maxHeartRate,
      totalCalories: this.cumulativeCalories,
      exerciseMetrics,
    };
  }

  /**
   * Calculate average heart rate from samples
   * 
   * @param samples - Array of HeartRateSample
   * @returns Average heart rate or 0 if no samples
   */
  private calculateAverageHeartRate(samples: HeartRateSample[]): number {
    if (samples.length === 0) return 0;
    const sum = samples.reduce((acc, sample) => acc + sample.value, 0);
    return Math.round(sum / samples.length);
  }

  /**
   * Calculate max heart rate from samples
   * 
   * @param samples - Array of HeartRateSample
   * @returns Max heart rate or 0 if no samples
   */
  private calculateMaxHeartRate(samples: HeartRateSample[]): number {
    if (samples.length === 0) return 0;
    return Math.max(...samples.map(s => s.value));
  }

  /**
   * Calculate elapsed seconds (excluding paused time)
   */
  private calculateElapsedSeconds(): number {
    if (!this.sessionStartTime) return 0;

    let elapsed = Date.now() - this.sessionStartTime.getTime();

    // Subtract paused duration
    elapsed -= this.pausedDuration;

    // If currently paused, don't count current pause time
    if (this.pauseStartTime) {
      elapsed -= (Date.now() - this.pauseStartTime.getTime());
    }

    return Math.max(0, Math.floor(elapsed / 1000));
  }

  // ============================================
  // HealthKit Integration
  // ============================================

  /**
   * Save workout to HealthKit
   * 
   * @param summary - WorkoutSummary to save
   * @returns HealthKit workout ID
   * 
   * Requirements: 6.1, 6.2
   */
  private async saveToHealthKit(summary: WorkoutSummary): Promise<string> {
    if (!this.activeSession || !this.sessionStartTime) {
      throw new Error('No active session to save');
    }

    const endTime = new Date();
    const workoutType = this.determineWorkoutType();

    const healthKitWorkout: HealthKitWorkout = {
      workoutType,
      startDate: this.sessionStartTime,
      endDate: endTime,
      duration: summary.duration,
      totalEnergyBurned: summary.totalCalories,
      heartRateSamples: this.allHeartRateSamples,
      metadata: {
        appWorkoutId: this.activeSession.id,
        workoutName: this.activeSession.workout.focusAreas?.join(', ') || 'Workout',
      },
    };

    return healthKitService.saveWorkoutToHealthKit(healthKitWorkout);
  }

  /**
   * Determine HealthKit workout type based on workout focus areas
   */
  private determineWorkoutType(): HKWorkoutActivityType {
    const focusAreas = this.activeSession?.workout.focusAreas || [];

    if (focusAreas.includes('CORE')) {
      return 'coreTraining';
    }
    if (focusAreas.includes('LEGS') || focusAreas.includes('BACK') || focusAreas.includes('CHEST')) {
      return 'traditionalStrengthTraining';
    }
    return 'functionalStrengthTraining';
  }

  /**
   * Update the workout record with health metrics
   * 
   * @param summary - WorkoutSummary
   * @param healthKitWorkoutId - HealthKit workout ID
   */
  private async updateWorkoutWithMetrics(
    summary: WorkoutSummary,
    healthKitWorkoutId: string
  ): Promise<void> {
    if (!this.activeSession) return;

    const workout = this.activeSession.workout;

    // Update workout with health metrics
    const updatedWorkout: DailyWorkout = {
      ...workout,
      healthKitWorkoutId,
      workoutMetrics: {
        averageHeartRate: summary.averageHeartRate,
        maxHeartRate: summary.maxHeartRate,
        totalCalories: summary.totalCalories,
        duration: summary.duration,
      },
      exercises: workout.exercises.map(exercise => {
        const metrics = this.completedExerciseMetrics.get(exercise.id);
        if (metrics) {
          return {
            ...exercise,
            healthMetrics: metrics,
          };
        }
        return exercise;
      }),
    };

    await fitnessService.saveWorkout(updatedWorkout);
  }

  // ============================================
  // Watch Communication
  // ============================================

  /**
   * Notify Watch of workout start
   */
  private notifyWatchWorkoutStart(workout: DailyWorkout): void {
    watchConnectivityService.sendMessage({
      type: 'START_WORKOUT',
      payload: {
        workoutId: this.activeSession?.id || '',
        workoutName: workout.focusAreas?.join(', ') || 'Workout',
        exercises: workout.exercises.map(e => ({
          id: e.id,
          name: e.exerciseName,
          sets: e.sets.length,
        })),
      },
    });

    this.updateWatchContext();
  }

  /**
   * Notify Watch of workout end
   */
  private notifyWatchWorkoutEnd(summary: WorkoutSummary): void {
    watchConnectivityService.sendMessage({
      type: 'END_WORKOUT',
      payload: {
        workoutId: this.activeSession?.id || '',
        duration: summary.duration,
        totalCalories: summary.totalCalories,
      },
    });

    // Clear Watch context
    watchConnectivityService.updateApplicationContext({
      isWorkoutActive: false,
      elapsedSeconds: 0,
    });
  }

  /**
   * Update Watch application context with current state
   */
  private updateWatchContext(): void {
    if (!this.activeSession) return;

    const currentExercise = this.currentExerciseState
      ? this.activeSession.workout.exercises.find(
          e => e.id === this.currentExerciseState?.exerciseId
        )
      : null;

    const context: WorkoutContext = {
      isWorkoutActive: this.sessionState === 'active',
      currentExercise: currentExercise?.exerciseName,
      currentSet: currentExercise?.sets.filter(s => s.completed).length,
      totalSets: currentExercise?.sets.length,
      elapsedSeconds: this.calculateElapsedSeconds(),
      heartRate: this.currentHeartRate ?? undefined,
      calories: this.cumulativeCalories,
    };

    watchConnectivityService.updateApplicationContext(context);
  }

  // ============================================
  // State Accessors
  // ============================================

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Check if a session is currently active
   */
  isSessionActive(): boolean {
    return this.sessionState === 'active' || this.sessionState === 'paused';
  }

  /**
   * Get the active session (if any)
   */
  getActiveSession(): ActiveSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ============================================
  // Session Recovery Methods (Task 9.5)
  // ============================================

  /**
   * Check if there's a recoverable session from a previous app termination
   * 
   * @returns true if there's a session to recover
   * 
   * Requirements: 3.5, 8.4
   */
  async hasRecoverableSession(): Promise<boolean> {
    return backgroundWorkoutService.hasRecoverableSession();
  }

  /**
   * Recover a session from a previous app termination
   * 
   * @returns ActiveSession if recovery successful, null otherwise
   * 
   * Requirements: 3.5, 8.4
   */
  async recoverSession(): Promise<ActiveSession | null> {
    const persistedState = await backgroundWorkoutService.loadSessionState();
    
    if (!persistedState || !persistedState.isActive) {
      return null;
    }

    try {
      // Restore session state
      this.sessionState = 'active';
      this.sessionStartTime = new Date(persistedState.startTime);
      this.pausedDuration = persistedState.pausedDuration;
      this.pauseStartTime = null;

      // Restore metrics
      this.allHeartRateSamples = persistedState.heartRateSamples.map(s => ({
        ...s,
        timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp),
      }));
      this.cumulativeCalories = persistedState.cumulativeCalories;
      
      // Set current heart rate from most recent sample
      if (this.allHeartRateSamples.length > 0) {
        const mostRecent = this.allHeartRateSamples[this.allHeartRateSamples.length - 1];
        this.currentHeartRate = mostRecent.value;
        this.currentHeartRateTimestamp = mostRecent.timestamp;
      }

      // Create active session
      this.activeSession = {
        id: persistedState.sessionId,
        startTime: this.sessionStartTime,
        workout: persistedState.workout,
      };

      // Restart tracking
      this.startHeartRateTracking();
      this.startMetricsUpdateInterval();
      this.initializeBackgroundTracking();

      return { ...this.activeSession };
    } catch (error) {
      console.error('WorkoutSessionManager: Failed to recover session:', error);
      await backgroundWorkoutService.clearSessionState();
      return null;
    }
  }

  /**
   * Save partial workout data before app termination
   * Called from AppDelegate's applicationWillTerminate
   * 
   * Requirements: 3.5, 8.4
   */
  async savePartialWorkout(): Promise<void> {
    if (this.sessionState !== 'active' && this.sessionState !== 'paused') {
      return;
    }

    // Persist current state
    await this.persistSessionState();

    // Try to save partial workout to HealthKit
    if (this.activeSession && this.allHeartRateSamples.length > 0) {
      try {
        const summary = this.generateWorkoutSummary();
        await this.saveToHealthKit(summary);
      } catch (error) {
        console.error('WorkoutSessionManager: Failed to save partial workout:', error);
        // State is already persisted, so recovery is still possible
      }
    }
  }

  // ============================================
  // Testing Helper Methods
  // ============================================

  /**
   * Simulate a heart rate sample (for testing purposes)
   */
  _simulateHeartRateSample(sample: HeartRateSample): void {
    this.handleHeartRateSample(sample);
  }

  /**
   * Get all heart rate samples (for testing purposes)
   */
  _getAllHeartRateSamples(): HeartRateSample[] {
    return [...this.allHeartRateSamples];
  }

  /**
   * Get cumulative calories (for testing purposes)
   */
  _getCumulativeCalories(): number {
    return this.cumulativeCalories;
  }

  /**
   * Set cumulative calories (for testing purposes)
   */
  _setCumulativeCalories(calories: number): void {
    this.cumulativeCalories = calories;
  }

  /**
   * Get completed exercise metrics (for testing purposes)
   */
  _getCompletedExerciseMetrics(): Map<string, ExerciseHealthMetrics> {
    return new Map(this.completedExerciseMetrics);
  }

  // ============================================
  // Interactive Session Integration (Task 5.3)
  // ============================================

  // Timer completion callbacks
  private timerCompletionCallbacks: Map<string, Set<(timerId: string) => void>> = new Map();
  private exerciseTimerCallbacks: Map<string, Set<() => void>> = new Map();
  private restTimerCallbacks: Map<string, Set<() => void>> = new Map();

  // Adaptive timer preferences
  private timerPreferences: Map<string, number> = new Map();
  private timerAdjustmentHistory: Array<{
    timerType: string;
    exerciseType: string;
    originalDuration: number;
    adjustedDuration: number;
    timestamp: Date;
  }> = [];

  /**
   * Subscribe to timer completion events
   * 
   * @param timerId - Timer ID to monitor
   * @param callback - Function called when timer completes
   * @returns Subscription handle
   * 
   * Requirements: 7.3
   */
  onTimerComplete(timerId: string, callback: (timerId: string) => void): Subscription {
    if (!this.timerCompletionCallbacks.has(timerId)) {
      this.timerCompletionCallbacks.set(timerId, new Set());
    }
    this.timerCompletionCallbacks.get(timerId)!.add(callback);

    return {
      remove: () => {
        const callbacks = this.timerCompletionCallbacks.get(timerId);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.timerCompletionCallbacks.delete(timerId);
          }
        }
      },
    };
  }

  /**
   * Subscribe to exercise timer completion events
   * 
   * @param exerciseId - Exercise ID to monitor
   * @param callback - Function called when exercise timer completes
   * @returns Subscription handle
   * 
   * Requirements: 7.3
   */
  onExerciseTimerComplete(exerciseId: string, callback: () => void): Subscription {
    if (!this.exerciseTimerCallbacks.has(exerciseId)) {
      this.exerciseTimerCallbacks.set(exerciseId, new Set());
    }
    this.exerciseTimerCallbacks.get(exerciseId)!.add(callback);

    return {
      remove: () => {
        const callbacks = this.exerciseTimerCallbacks.get(exerciseId);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.exerciseTimerCallbacks.delete(exerciseId);
          }
        }
      },
    };
  }

  /**
   * Subscribe to rest timer completion events
   * 
   * @param setId - Set ID to monitor
   * @param callback - Function called when rest timer completes
   * @returns Subscription handle
   * 
   * Requirements: 7.3
   */
  onRestTimerComplete(setId: string, callback: () => void): Subscription {
    if (!this.restTimerCallbacks.has(setId)) {
      this.restTimerCallbacks.set(setId, new Set());
    }
    this.restTimerCallbacks.get(setId)!.add(callback);

    return {
      remove: () => {
        const callbacks = this.restTimerCallbacks.get(setId);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.restTimerCallbacks.delete(setId);
          }
        }
      },
    };
  }

  /**
   * Notify timer completion callbacks
   * 
   * @param timerId - ID of the completed timer
   * @param timerType - Type of timer ('exercise' | 'rest')
   * @param associatedId - Exercise ID or Set ID
   */
  notifyTimerComplete(timerId: string, timerType: 'exercise' | 'rest', associatedId: string): void {
    // Notify general timer callbacks
    const timerCallbacks = this.timerCompletionCallbacks.get(timerId);
    if (timerCallbacks) {
      timerCallbacks.forEach(callback => {
        try {
          callback(timerId);
        } catch (error) {
          console.error('WorkoutSessionManager: Error in timer completion callback:', error);
        }
      });
    }

    // Notify type-specific callbacks
    if (timerType === 'exercise') {
      const exerciseCallbacks = this.exerciseTimerCallbacks.get(associatedId);
      if (exerciseCallbacks) {
        exerciseCallbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('WorkoutSessionManager: Error in exercise timer callback:', error);
          }
        });
      }
    } else if (timerType === 'rest') {
      const restCallbacks = this.restTimerCallbacks.get(associatedId);
      if (restCallbacks) {
        restCallbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('WorkoutSessionManager: Error in rest timer callback:', error);
          }
        });
      }
    }
  }

  // ============================================
  // Adaptive Timer Suggestions (Task 5.3)
  // ============================================

  /**
   * Suggest exercise duration based on exercise type and history
   * 
   * @param exercise - The exercise to get suggestion for
   * @returns Suggested duration in seconds
   * 
   * Requirements: 9.1, 9.2
   */
  suggestExerciseDuration(exercise: ExerciseLog): number {
    const targetGroup = exercise.targetGroup.toLowerCase();

    // Check for user preference from history
    const preferenceKey = `exercise_${exercise.exerciseName}`;
    const userPreference = this.timerPreferences.get(preferenceKey);
    if (userPreference) {
      return userPreference;
    }

    // Default suggestions based on exercise type
    const defaultDurations: Record<string, number> = {
      core: 45,      // Core exercises: 45 seconds
      cardio: 60,    // Cardio intervals: 60 seconds
      legs: 45,      // Leg exercises: 45 seconds
      chest: 45,     // Chest exercises: 45 seconds
      back: 45,      // Back exercises: 45 seconds
      shoulders: 45, // Shoulder exercises: 45 seconds
      biceps: 30,    // Bicep exercises: 30 seconds
      triceps: 30,   // Tricep exercises: 30 seconds
    };

    return defaultDurations[targetGroup] || 45;
  }

  /**
   * Suggest rest duration based on exercise type, set index, and heart rate
   * 
   * @param exercise - The current exercise
   * @param setIndex - Index of the completed set
   * @param heartRate - Optional current heart rate
   * @returns Suggested rest duration in seconds
   * 
   * Requirements: 9.1, 9.3, 9.4
   */
  suggestRestDuration(exercise: ExerciseLog, setIndex: number, heartRate?: number): number {
    const targetGroup = exercise.targetGroup.toLowerCase();

    // Check for user preference
    const preferenceKey = `rest_${exercise.exerciseName}`;
    const userPreference = this.timerPreferences.get(preferenceKey);
    if (userPreference) {
      return userPreference;
    }

    // Base rest durations by exercise type
    const baseRestDurations: Record<string, number> = {
      legs: 90,      // Legs need more rest
      back: 75,      // Back exercises: moderate rest
      chest: 75,     // Chest exercises: moderate rest
      shoulders: 60, // Shoulders: standard rest
      biceps: 45,    // Smaller muscles: shorter rest
      triceps: 45,   // Smaller muscles: shorter rest
      core: 30,      // Core: shorter rest
      cardio: 30,    // Cardio intervals: shorter rest
    };

    let restDuration = baseRestDurations[targetGroup] || 60;

    // Adjust based on set index (later sets may need more rest)
    if (setIndex >= 2) {
      restDuration += 15; // Add 15 seconds for later sets
    }

    // Adjust based on heart rate if available
    if (heartRate) {
      if (heartRate > 160) {
        restDuration += 30; // High heart rate: add 30 seconds
      } else if (heartRate > 140) {
        restDuration += 15; // Elevated heart rate: add 15 seconds
      }
    }

    // Clamp to reasonable bounds
    return Math.max(30, Math.min(180, restDuration));
  }

  /**
   * Update timer preferences based on user adjustments
   * 
   * @param timerType - Type of timer ('exercise' | 'rest')
   * @param exerciseName - Name of the exercise
   * @param duration - The adjusted duration
   * 
   * Requirements: 9.2, 9.3
   */
  updateTimerPreferences(timerType: 'exercise' | 'rest', exerciseName: string, duration: number): void {
    const preferenceKey = `${timerType}_${exerciseName}`;
    
    // Record the adjustment
    this.timerAdjustmentHistory.push({
      timerType,
      exerciseType: exerciseName,
      originalDuration: this.timerPreferences.get(preferenceKey) || duration,
      adjustedDuration: duration,
      timestamp: new Date(),
    });

    // Update preference if we have enough history (5+ adjustments)
    const recentAdjustments = this.timerAdjustmentHistory.filter(
      adj => adj.timerType === timerType && adj.exerciseType === exerciseName
    );

    if (recentAdjustments.length >= 5) {
      // Calculate average of recent adjustments
      const avgDuration = recentAdjustments
        .slice(-5)
        .reduce((sum, adj) => sum + adj.adjustedDuration, 0) / 5;
      
      this.timerPreferences.set(preferenceKey, Math.round(avgDuration));
    }
  }

  /**
   * Get quick-select timer options
   * 
   * @returns Array of common timer durations in seconds
   * 
   * Requirements: 9.5
   */
  getQuickSelectOptions(): number[] {
    return [30, 45, 60, 90, 120]; // 30s, 45s, 60s, 90s, 2min
  }

  /**
   * Get timer adjustment history for analytics
   * 
   * @returns Array of timer adjustments
   */
  getTimerAdjustmentHistory(): typeof this.timerAdjustmentHistory {
    return [...this.timerAdjustmentHistory];
  }

  /**
   * Clear timer preferences (for testing)
   */
  _clearTimerPreferences(): void {
    this.timerPreferences.clear();
    this.timerAdjustmentHistory = [];
  }

  /**
   * Reset session state (for testing purposes)
   */
  _resetForTesting(): void {
    this.sessionState = 'idle';
    this.activeSession = null;
    this.sessionStartTime = null;
    this.pausedDuration = 0;
    this.pauseStartTime = null;
    this.allHeartRateSamples = [];
    this.currentHeartRate = null;
    this.currentHeartRateTimestamp = null;
    this.cumulativeCalories = 0;
    this.caloriesAtSessionStart = 0;
    this.currentExerciseState = null;
    this.completedExerciseMetrics.clear();
    this.stopHeartRateTracking();
    this.stopMetricsUpdateInterval();
    this.metricsSubscribers.clear();
    this.cleanupBackgroundTracking();
    this.backgroundSamplesCollected = 0;
    this.isInBackground = false;
    // Clear interactive session properties
    this.timerCompletionCallbacks.clear();
    this.exerciseTimerCallbacks.clear();
    this.restTimerCallbacks.clear();
    this.timerPreferences.clear();
    this.timerAdjustmentHistory = [];
  }

  /**
   * Simulate entering background (for testing purposes)
   */
  _simulateEnterBackground(): void {
    this.handleBackgroundStateChange({
      previousState: 'active',
      currentState: 'background',
      timestamp: new Date(),
    });
  }

  /**
   * Simulate returning to foreground (for testing purposes)
   */
  _simulateReturnToForeground(): void {
    this.handleBackgroundStateChange({
      previousState: 'background',
      currentState: 'active',
      timestamp: new Date(),
    });
  }

  /**
   * Get background samples collected count (for testing purposes)
   */
  _getBackgroundSamplesCollected(): number {
    return this.backgroundSamplesCollected;
  }
}

// Export singleton instance
export const workoutSessionManager = new WorkoutSessionManager();

// Export class for testing purposes
export { WorkoutSessionManager };
