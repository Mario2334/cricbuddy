/**
 * HealthKit Service Module
 * 
 * This module provides methods to interact with Apple's HealthKit framework
 * for health data authorization, heart rate tracking, calorie queries,
 * and workout persistence.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.3, 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 6.4
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import type {
  AuthorizationResult,
  AuthorizationStatus,
  HealthDataType,
  HeartRateSample,
  HealthKitWorkout,
  TimerHealthMetrics,
  ExerciseTimerHealthData,
  WorkoutTimerHealthData,
  ExerciseHealthMetrics,
  WorkoutHealthMetrics,
} from '../types/health';

// Storage key for authorization status
const AUTH_STATUS_KEY = '@healthkit_auth_status';

// Default retry configuration for HealthKit operations
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;
const DEFAULT_MAX_RETRIES = 5;

/**
 * Subscription handle for heart rate updates
 */
export interface Subscription {
  remove: () => void;
}

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
}

/**
 * HealthKitService class handles all HealthKit interactions
 */
class HealthKitService {
  private heartRateSubscribers: Map<string, (sample: HeartRateSample) => void> = new Map();
  private eventEmitter: NativeEventEmitter | null = null;
  private heartRateListener: any = null;

  constructor() {
    this.initializeEventEmitter();
  }

  /**
   * Initialize the native event emitter for heart rate updates
   */
  private initializeEventEmitter(): void {
    if (Platform.OS === 'ios' && NativeModules.HealthKitModule) {
      this.eventEmitter = new NativeEventEmitter(NativeModules.HealthKitModule);
    }
  }

  // ============================================
  // Authorization Methods
  // ============================================

  /**
   * Check if HealthKit is available on the current device
   * 
   * @returns true if HealthKit is available, false otherwise
   * 
   * Requirements: 1.4
   */
  isHealthKitAvailable(): boolean {
    // HealthKit is only available on iOS
    if (Platform.OS !== 'ios') {
      return false;
    }

    // Check if the native module is available
    return !!NativeModules.HealthKitModule;
  }

  /**
   * Request authorization for health data types
   * Requests access to heart rate, active energy, and workout data
   * 
   * @returns AuthorizationResult indicating success and any denied types
   * 
   * Requirements: 1.1, 1.2
   */
  async requestAuthorization(): Promise<AuthorizationResult> {
    if (!this.isHealthKitAvailable()) {
      return {
        granted: false,
        deniedTypes: ['heartRate', 'activeEnergy', 'workout'],
      };
    }

    try {
      // Request authorization from native module
      const result = await NativeModules.HealthKitModule.requestAuthorization([
        'heartRate',
        'activeEnergy',
        'workout',
      ]);

      // Build authorization status from result
      const status: AuthorizationStatus = {
        heartRate: result.heartRate || 'notDetermined',
        activeEnergy: result.activeEnergy || 'notDetermined',
        workout: result.workout || 'notDetermined',
      };

      // Persist authorization status
      await this.saveAuthorizationStatus(status);

      // Determine which types were denied
      const deniedTypes: HealthDataType[] = [];
      if (status.heartRate === 'denied') deniedTypes.push('heartRate');
      if (status.activeEnergy === 'denied') deniedTypes.push('activeEnergy');
      if (status.workout === 'denied') deniedTypes.push('workout');

      return {
        granted: deniedTypes.length === 0,
        deniedTypes,
      };
    } catch (error) {
      console.error('HealthKitService: Failed to request authorization:', error);
      return {
        granted: false,
        deniedTypes: ['heartRate', 'activeEnergy', 'workout'],
      };
    }
  }

  /**
   * Get the current authorization status for all health data types
   * 
   * @returns AuthorizationStatus for heart rate, active energy, and workout
   * 
   * Requirements: 1.2, 1.3
   */
  async getAuthorizationStatus(): Promise<AuthorizationStatus> {
    // First try to get from native module for most accurate status
    if (this.isHealthKitAvailable()) {
      try {
        const nativeStatus = await NativeModules.HealthKitModule.getAuthorizationStatus();
        const status: AuthorizationStatus = {
          heartRate: nativeStatus.heartRate || 'notDetermined',
          activeEnergy: nativeStatus.activeEnergy || 'notDetermined',
          workout: nativeStatus.workout || 'notDetermined',
        };
        
        // Update persisted status
        await this.saveAuthorizationStatus(status);
        return status;
      } catch (error) {
        console.error('HealthKitService: Failed to get native auth status:', error);
      }
    }

    // Fall back to persisted status
    return this.loadAuthorizationStatus();
  }

  /**
   * Save authorization status to AsyncStorage
   * 
   * @param status - The authorization status to persist
   * 
   * Requirements: 1.2
   */
  private async saveAuthorizationStatus(status: AuthorizationStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      console.error('HealthKitService: Failed to save auth status:', error);
    }
  }

  /**
   * Load authorization status from AsyncStorage
   * 
   * @returns The persisted authorization status or default values
   * 
   * Requirements: 1.2
   */
  private async loadAuthorizationStatus(): Promise<AuthorizationStatus> {
    try {
      const data = await AsyncStorage.getItem(AUTH_STATUS_KEY);
      if (data) {
        return JSON.parse(data) as AuthorizationStatus;
      }
    } catch (error) {
      console.error('HealthKitService: Failed to load auth status:', error);
    }

    // Return default status if not found
    return {
      heartRate: 'notDetermined',
      activeEnergy: 'notDetermined',
      workout: 'notDetermined',
    };
  }


  // ============================================
  // Heart Rate Subscription Methods
  // ============================================

  /**
   * Subscribe to real-time heart rate updates
   * 
   * @param callback - Function called with each new heart rate sample
   * @returns Subscription handle to remove the subscription
   * 
   * Requirements: 3.3, 4.1
   */
  subscribeToHeartRate(callback: (sample: HeartRateSample) => void): Subscription {
    const subscriptionId = this.generateSubscriptionId();
    this.heartRateSubscribers.set(subscriptionId, callback);

    // Set up native listener if this is the first subscriber
    if (this.heartRateSubscribers.size === 1) {
      this.startHeartRateObserver();
    }

    return {
      remove: () => {
        this.heartRateSubscribers.delete(subscriptionId);
        
        // Stop native listener if no more subscribers
        if (this.heartRateSubscribers.size === 0) {
          this.stopHeartRateObserver();
        }
      },
    };
  }

  /**
   * Start the native heart rate observer
   */
  private startHeartRateObserver(): void {
    if (!this.isHealthKitAvailable() || !this.eventEmitter) {
      return;
    }

    try {
      // Listen for heart rate updates from native module
      this.heartRateListener = this.eventEmitter.addListener(
        'onHeartRateUpdate',
        (data: { value: number; timestamp: string; source: string }) => {
          const sample: HeartRateSample = {
            value: data.value,
            timestamp: new Date(data.timestamp),
            source: data.source as 'watch' | 'phone',
          };
          
          // Notify all subscribers
          this.heartRateSubscribers.forEach(callback => {
            callback(sample);
          });
        }
      );

      // Start observing heart rate in native module
      NativeModules.HealthKitModule.startHeartRateObserver();
    } catch (error) {
      console.error('HealthKitService: Failed to start heart rate observer:', error);
    }
  }

  /**
   * Stop the native heart rate observer
   */
  private stopHeartRateObserver(): void {
    if (this.heartRateListener) {
      this.heartRateListener.remove();
      this.heartRateListener = null;
    }

    if (this.isHealthKitAvailable()) {
      try {
        NativeModules.HealthKitModule.stopHeartRateObserver();
      } catch (error) {
        console.error('HealthKitService: Failed to stop heart rate observer:', error);
      }
    }
  }

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ============================================
  // Calorie Query Methods
  // ============================================

  /**
   * Get active calories burned within a date range
   * 
   * @param startDate - Start of the date range
   * @param endDate - End of the date range
   * @returns Total active calories burned, or 0 if unavailable
   * 
   * Requirements: 4.2, 4.3
   */
  async getActiveCalories(startDate: Date, endDate: Date): Promise<number> {
    if (!this.isHealthKitAvailable()) {
      return 0;
    }

    try {
      const calories = await NativeModules.HealthKitModule.getActiveCalories(
        startDate.toISOString(),
        endDate.toISOString()
      );
      return calories || 0;
    } catch (error) {
      console.error('HealthKitService: Failed to get active calories:', error);
      return 0;
    }
  }


  // ============================================
  // Workout Persistence Methods
  // ============================================

  /**
   * Save a workout to HealthKit with retry logic
   * 
   * @param workout - The workout data to save
   * @param retryConfig - Optional retry configuration
   * @returns The HealthKit workout ID
   * @throws Error if save fails after all retries
   * 
   * Requirements: 6.1, 6.2, 6.3
   */
  async saveWorkoutToHealthKit(
    workout: HealthKitWorkout,
    retryConfig?: Partial<RetryConfig>
  ): Promise<string> {
    const config: RetryConfig = {
      baseDelayMs: retryConfig?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
      maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
      maxRetries: retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES,
    };

    if (!this.isHealthKitAvailable()) {
      throw new Error('HealthKit is not available on this device');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Prepare workout data for native module
        const workoutData = {
          workoutType: workout.workoutType,
          startDate: workout.startDate.toISOString(),
          endDate: workout.endDate.toISOString(),
          duration: workout.duration,
          totalEnergyBurned: workout.totalEnergyBurned,
          heartRateSamples: workout.heartRateSamples.map(sample => ({
            value: sample.value,
            timestamp: sample.timestamp.toISOString(),
            source: sample.source,
          })),
          metadata: workout.metadata,
        };

        // Save to HealthKit via native module
        const workoutId = await NativeModules.HealthKitModule.saveWorkout(workoutData);
        return workoutId;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `HealthKitService: Save workout attempt ${attempt + 1} failed:`,
          error
        );

        // Don't retry on the last attempt
        if (attempt < config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, config);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Failed to save workout to HealthKit');
  }

  /**
   * Delete a workout from HealthKit
   * 
   * @param workoutId - The HealthKit workout ID to delete
   * 
   * Requirements: 6.4
   */
  async deleteWorkoutFromHealthKit(workoutId: string): Promise<void> {
    if (!this.isHealthKitAvailable()) {
      throw new Error('HealthKit is not available on this device');
    }

    try {
      await NativeModules.HealthKitModule.deleteWorkout(workoutId);
    } catch (error) {
      console.error('HealthKitService: Failed to delete workout:', error);
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   * 
   * @param attempt - The current attempt number (0-indexed)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   * 
   * Requirements: 6.3
   */
  calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, config.maxDelayMs);
  }

  /**
   * Sleep for a specified duration
   * 
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // Timer-Correlated Health Data Methods
  // ============================================

  /**
   * Correlate heart rate samples with a specific timer period
   * 
   * @param samples - Array of heart rate samples
   * @param startTime - Timer start time
   * @param endTime - Timer end time
   * @returns Heart rate samples within the timer period
   * 
   * Requirements: 7.3
   */
  correlateHeartRateSamplesWithTimer(
    samples: HeartRateSample[],
    startTime: Date,
    endTime: Date
  ): HeartRateSample[] {
    return samples.filter(sample => {
      const sampleTime = sample.timestamp.getTime();
      return sampleTime >= startTime.getTime() && sampleTime <= endTime.getTime();
    });
  }

  /**
   * Calculate health metrics for a specific timer period
   * 
   * @param samples - Heart rate samples for the timer period
   * @param timerId - Timer identifier
   * @param timerType - Type of timer (exercise, rest, workout)
   * @param startTime - Timer start time
   * @param endTime - Timer end time
   * @param exerciseId - Optional exercise identifier
   * @param setId - Optional set identifier
   * @returns Timer health metrics
   * 
   * Requirements: 7.3, 7.4
   */
  calculateTimerHealthMetrics(
    samples: HeartRateSample[],
    timerId: string,
    timerType: 'exercise' | 'rest' | 'workout',
    startTime: Date,
    endTime: Date,
    exerciseId?: string,
    setId?: string
  ): TimerHealthMetrics {
    const correlatedSamples = this.correlateHeartRateSamplesWithTimer(
      samples,
      startTime,
      endTime
    );

    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    let averageHeartRate: number | undefined;
    let maxHeartRate: number | undefined;
    let minHeartRate: number | undefined;

    if (correlatedSamples.length > 0) {
      const heartRates = correlatedSamples.map(s => s.value);
      averageHeartRate = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
      maxHeartRate = Math.max(...heartRates);
      minHeartRate = Math.min(...heartRates);
    }

    return {
      timerId,
      timerType,
      exerciseId,
      setId,
      startTime,
      endTime,
      duration,
      heartRateSamples: correlatedSamples,
      averageHeartRate,
      maxHeartRate,
      minHeartRate,
    };
  }

  /**
   * Aggregate timer health metrics for an exercise
   * 
   * @param timerPeriods - Array of timer health metrics for the exercise
   * @param exerciseId - Exercise identifier
   * @param exerciseName - Exercise name
   * @returns Exercise-level health data with timer correlation
   * 
   * Requirements: 7.3, 7.4
   */
  aggregateExerciseHealthData(
    timerPeriods: TimerHealthMetrics[],
    exerciseId: string,
    exerciseName: string
  ): ExerciseTimerHealthData {
    const exercisePeriods = timerPeriods.filter(p => p.timerType === 'exercise');
    const restPeriods = timerPeriods.filter(p => p.timerType === 'rest');

    const totalDuration = exercisePeriods.reduce((sum, p) => sum + p.duration, 0);
    const totalRestDuration = restPeriods.reduce((sum, p) => sum + p.duration, 0);

    // Aggregate all heart rate samples
    const allSamples = timerPeriods.flatMap(p => p.heartRateSamples);
    
    let aggregatedMetrics: ExerciseHealthMetrics = {};

    if (allSamples.length > 0) {
      const heartRates = allSamples.map(s => s.value);
      aggregatedMetrics = {
        averageHeartRate: heartRates.reduce((a, b) => a + b, 0) / heartRates.length,
        maxHeartRate: Math.max(...heartRates),
        heartRateSamples: allSamples,
      };
    }

    return {
      exerciseId,
      exerciseName,
      timerPeriods,
      totalDuration,
      totalRestDuration,
      aggregatedMetrics,
    };
  }

  /**
   * Create complete workout health data with timer correlation
   * 
   * @param workoutId - Workout identifier
   * @param startTime - Workout start time
   * @param endTime - Workout end time
   * @param exercises - Array of exercise health data
   * @param allTimerPeriods - All timer periods from the workout
   * @returns Complete workout health data
   * 
   * Requirements: 7.3, 7.4
   */
  createWorkoutTimerHealthData(
    workoutId: string,
    startTime: Date,
    endTime: Date,
    exercises: ExerciseTimerHealthData[],
    allTimerPeriods: TimerHealthMetrics[]
  ): WorkoutTimerHealthData {
    const totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // Aggregate all heart rate samples
    const allSamples = allTimerPeriods.flatMap(p => p.heartRateSamples);
    
    let overallMetrics: WorkoutHealthMetrics = {
      averageHeartRate: 0,
      maxHeartRate: 0,
      totalCalories: 0,
      duration: totalDuration,
    };

    if (allSamples.length > 0) {
      const heartRates = allSamples.map(s => s.value);
      overallMetrics.averageHeartRate = heartRates.reduce((a, b) => a + b, 0) / heartRates.length;
      overallMetrics.maxHeartRate = Math.max(...heartRates);
    }

    // Sum calories from all timer periods
    overallMetrics.totalCalories = allTimerPeriods.reduce(
      (sum, p) => sum + (p.caloriesBurned || 0),
      0
    );

    return {
      workoutId,
      startTime,
      endTime,
      totalDuration,
      exercises,
      overallMetrics,
      timerPeriods: allTimerPeriods,
    };
  }

  /**
   * Save workout with timer-correlated health data to HealthKit
   * 
   * @param workoutData - Complete workout health data with timer correlation
   * @returns The HealthKit workout ID
   * 
   * Requirements: 7.3, 7.4
   */
  async saveWorkoutWithTimerCorrelation(
    workoutData: WorkoutTimerHealthData
  ): Promise<string> {
    // Convert to HealthKitWorkout format
    const allSamples = workoutData.timerPeriods.flatMap(p => p.heartRateSamples);
    
    const workout: HealthKitWorkout = {
      workoutType: 'traditionalStrengthTraining',
      startDate: workoutData.startTime,
      endDate: workoutData.endTime,
      duration: workoutData.totalDuration,
      totalEnergyBurned: workoutData.overallMetrics.totalCalories,
      heartRateSamples: allSamples,
      metadata: {
        workoutId: workoutData.workoutId,
        exerciseCount: String(workoutData.exercises.length),
        timerPeriodCount: String(workoutData.timerPeriods.length),
      },
    };

    return this.saveWorkoutToHealthKit(workout);
  }
}

// Export singleton instance
export const healthKitService = new HealthKitService();

// Export class for testing purposes
export { HealthKitService };
