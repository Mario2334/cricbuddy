/**
 * Background Workout Service Module
 * 
 * This module handles background workout tracking configuration, including:
 * - Audio session configuration for background operation
 * - App state monitoring for foreground/background transitions
 * - Persistent notification management for active workouts
 * - Session state recovery after app termination
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 3.5
 */

import { AppState, AppStateStatus, Platform, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HeartRateSample, WorkoutContext } from '../types/health';
import type { DailyWorkout } from '../types/fitness';

// Storage keys for background state persistence
const BACKGROUND_SESSION_KEY = '@background_workout_session';
const BACKGROUND_SAMPLES_KEY = '@background_workout_samples';

/**
 * Persisted session state for recovery after termination
 */
export interface PersistedSessionState {
  sessionId: string;
  workoutId: string;
  startTime: string;
  pausedDuration: number;
  workout: DailyWorkout;
  heartRateSamples: HeartRateSample[];
  cumulativeCalories: number;
  lastUpdateTime: string;
  isActive: boolean;
}

/**
 * Background state change event
 */
export interface BackgroundStateChange {
  previousState: AppStateStatus;
  currentState: AppStateStatus;
  timestamp: Date;
}

/**
 * Subscription handle for state changes
 */
export interface Subscription {
  remove: () => void;
}

/**
 * BackgroundWorkoutService class handles background workout tracking
 */
class BackgroundWorkoutService {
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = 'active';
  private stateChangeSubscribers: Map<string, (change: BackgroundStateChange) => void> = new Map();
  private isAudioSessionConfigured: boolean = false;
  private backgroundSamples: HeartRateSample[] = [];
  private isBackgroundCollectionActive: boolean = false;
  private terminationHandler: (() => Promise<void>) | null = null;
  private terminationEventEmitter: NativeEventEmitter | null = null;
  private terminationListener: any = null;

  constructor() {
    // Initialize app state monitoring
    this.currentAppState = AppState.currentState;
  }

  // ============================================
  // Initialization and Configuration (Task 9.1)
  // ============================================

  /**
   * Initialize background workout tracking
   * Sets up app state monitoring and audio session
   * 
   * Requirements: 8.1, 8.3
   */
  async initialize(): Promise<void> {
    // Set up app state change listener
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    // Configure audio session for background operation
    await this.configureAudioSession();
  }

  /**
   * Configure audio session for background workout tracking
   * This allows the app to continue running in the background
   * 
   * Requirements: 8.1, 8.3
   */
  async configureAudioSession(): Promise<void> {
    if (Platform.OS !== 'ios') {
      return;
    }

    try {
      // Use native module to configure audio session if available
      if (NativeModules.AudioSessionModule) {
        await NativeModules.AudioSessionModule.configureForWorkout();
        this.isAudioSessionConfigured = true;
      }
    } catch (error) {
      console.error('BackgroundWorkoutService: Failed to configure audio session:', error);
    }
  }

  /**
   * Check if audio session is configured for background operation
   */
  isAudioConfigured(): boolean {
    return this.isAudioSessionConfigured;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.terminationListener) {
      this.terminationListener.remove();
      this.terminationListener = null;
    }
    this.stateChangeSubscribers.clear();
    this.terminationHandler = null;
  }

  // ============================================
  // App Termination Handling (Task 9.5)
  // ============================================

  /**
   * Register a handler to be called when app is about to terminate
   * 
   * @param handler - Async function to call before termination
   * 
   * Requirements: 3.5, 8.4
   */
  registerTerminationHandler(handler: () => Promise<void>): void {
    this.terminationHandler = handler;
    
    // Set up native event listener for termination notification
    if (Platform.OS === 'ios' && NativeModules.AppLifecycleModule) {
      try {
        this.terminationEventEmitter = new NativeEventEmitter(NativeModules.AppLifecycleModule);
        this.terminationListener = this.terminationEventEmitter.addListener(
          'AppWillTerminate',
          this.handleAppTermination.bind(this)
        );
      } catch (error) {
        console.error('BackgroundWorkoutService: Failed to register termination listener:', error);
      }
    }
  }

  /**
   * Handle app termination event
   * 
   * Requirements: 3.5, 8.4
   */
  private async handleAppTermination(): Promise<void> {
    if (this.terminationHandler) {
      try {
        await this.terminationHandler();
      } catch (error) {
        console.error('BackgroundWorkoutService: Error in termination handler:', error);
      }
    }
  }

  /**
   * Unregister the termination handler
   */
  unregisterTerminationHandler(): void {
    this.terminationHandler = null;
    if (this.terminationListener) {
      this.terminationListener.remove();
      this.terminationListener = null;
    }
  }

  // ============================================
  // App State Monitoring (Task 9.2)
  // ============================================

  /**
   * Handle app state changes (foreground/background transitions)
   * 
   * @param nextAppState - The new app state
   * 
   * Requirements: 8.1, 8.2
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const previousState = this.currentAppState;
    this.currentAppState = nextAppState;

    const change: BackgroundStateChange = {
      previousState,
      currentState: nextAppState,
      timestamp: new Date(),
    };

    // Notify all subscribers of state change
    this.stateChangeSubscribers.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('BackgroundWorkoutService: Error in state change subscriber:', error);
      }
    });

    // Handle transition to background
    if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
      this.onEnterBackground();
    }

    // Handle transition to foreground
    if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      this.onEnterForeground();
    }
  }

  /**
   * Called when app enters background
   * 
   * Requirements: 8.1, 8.3
   */
  private onEnterBackground(): void {
    if (this.isBackgroundCollectionActive) {
      // Persist current state for recovery
      this.persistCurrentState();
    }
  }

  /**
   * Called when app returns to foreground
   * 
   * Requirements: 8.2
   */
  private onEnterForeground(): void {
    // Background samples will be merged by WorkoutSessionManager
  }

  /**
   * Subscribe to app state changes
   * 
   * @param callback - Function called when app state changes
   * @returns Subscription handle
   */
  subscribeToStateChanges(callback: (change: BackgroundStateChange) => void): Subscription {
    const subscriptionId = this.generateSubscriptionId();
    this.stateChangeSubscribers.set(subscriptionId, callback);

    return {
      remove: () => {
        this.stateChangeSubscribers.delete(subscriptionId);
      },
    };
  }

  /**
   * Get current app state
   */
  getCurrentAppState(): AppStateStatus {
    return this.currentAppState;
  }

  /**
   * Check if app is in background
   */
  isInBackground(): boolean {
    return this.currentAppState === 'background';
  }

  // ============================================
  // Background Sample Collection (Task 9.2)
  // ============================================

  /**
   * Start background sample collection
   * 
   * Requirements: 8.1
   */
  startBackgroundCollection(): void {
    this.isBackgroundCollectionActive = true;
    this.backgroundSamples = [];
  }

  /**
   * Stop background sample collection
   * 
   * Requirements: 8.1
   */
  stopBackgroundCollection(): void {
    this.isBackgroundCollectionActive = false;
    this.backgroundSamples = [];
  }

  /**
   * Add a heart rate sample collected during background operation
   * 
   * @param sample - HeartRateSample to store
   * 
   * Requirements: 8.1
   */
  addBackgroundSample(sample: HeartRateSample): void {
    if (this.isBackgroundCollectionActive) {
      this.backgroundSamples.push(sample);
    }
  }

  /**
   * Get all samples collected during background operation
   * 
   * @returns Array of HeartRateSample collected in background
   * 
   * Requirements: 8.2
   */
  getBackgroundSamples(): HeartRateSample[] {
    return [...this.backgroundSamples];
  }

  /**
   * Clear background samples after they've been merged
   */
  clearBackgroundSamples(): void {
    this.backgroundSamples = [];
  }

  /**
   * Check if background collection is active
   */
  isCollectionActive(): boolean {
    return this.isBackgroundCollectionActive;
  }

  // ============================================
  // Session State Persistence (Task 9.5)
  // ============================================

  /**
   * Persist current workout session state for recovery
   * Called when app enters background or is about to terminate
   * 
   * Requirements: 3.5, 8.4
   */
  private async persistCurrentState(): Promise<void> {
    // This will be called by WorkoutSessionManager with actual state
  }

  /**
   * Save session state to persistent storage
   * 
   * @param state - PersistedSessionState to save
   * 
   * Requirements: 3.5, 8.4
   */
  async saveSessionState(state: PersistedSessionState): Promise<void> {
    try {
      await AsyncStorage.setItem(BACKGROUND_SESSION_KEY, JSON.stringify(state));
      
      // Also save samples separately for larger data
      if (state.heartRateSamples.length > 0) {
        await AsyncStorage.setItem(
          BACKGROUND_SAMPLES_KEY,
          JSON.stringify(state.heartRateSamples.map(s => ({
            ...s,
            timestamp: s.timestamp instanceof Date ? s.timestamp.toISOString() : s.timestamp,
          })))
        );
      }
    } catch (error) {
      console.error('BackgroundWorkoutService: Failed to save session state:', error);
    }
  }

  /**
   * Load persisted session state for recovery
   * 
   * @returns PersistedSessionState if available, null otherwise
   * 
   * Requirements: 3.5, 8.4
   */
  async loadSessionState(): Promise<PersistedSessionState | null> {
    try {
      const stateJson = await AsyncStorage.getItem(BACKGROUND_SESSION_KEY);
      if (!stateJson) {
        return null;
      }

      const state = JSON.parse(stateJson) as PersistedSessionState;

      // Load samples separately
      const samplesJson = await AsyncStorage.getItem(BACKGROUND_SAMPLES_KEY);
      if (samplesJson) {
        const samples = JSON.parse(samplesJson);
        state.heartRateSamples = samples.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
        }));
      }

      return state;
    } catch (error) {
      console.error('BackgroundWorkoutService: Failed to load session state:', error);
      return null;
    }
  }

  /**
   * Clear persisted session state
   * Called after successful recovery or when session ends normally
   * 
   * Requirements: 3.5
   */
  async clearSessionState(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([BACKGROUND_SESSION_KEY, BACKGROUND_SAMPLES_KEY]);
    } catch (error) {
      console.error('BackgroundWorkoutService: Failed to clear session state:', error);
    }
  }

  /**
   * Check if there's a recoverable session
   * 
   * @returns true if there's a session to recover
   * 
   * Requirements: 3.5, 8.4
   */
  async hasRecoverableSession(): Promise<boolean> {
    try {
      const stateJson = await AsyncStorage.getItem(BACKGROUND_SESSION_KEY);
      if (!stateJson) {
        return false;
      }

      const state = JSON.parse(stateJson) as PersistedSessionState;
      return state.isActive;
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ============================================
  // Testing Helper Methods
  // ============================================

  /**
   * Simulate app state change (for testing)
   */
  _simulateAppStateChange(newState: AppStateStatus): void {
    this.handleAppStateChange(newState);
  }

  /**
   * Get background samples count (for testing)
   */
  _getBackgroundSamplesCount(): number {
    return this.backgroundSamples.length;
  }

  /**
   * Reset for testing
   */
  _resetForTesting(): void {
    this.currentAppState = 'active';
    this.isBackgroundCollectionActive = false;
    this.backgroundSamples = [];
    this.stateChangeSubscribers.clear();
  }
}

// Export singleton instance
export const backgroundWorkoutService = new BackgroundWorkoutService();

// Export class for testing purposes
export { BackgroundWorkoutService };
