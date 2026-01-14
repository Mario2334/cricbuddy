/**
 * Watch Connectivity Service Module
 * 
 * This module provides methods to interact with Apple's WatchConnectivity framework
 * for bidirectional communication between the iOS app and Apple Watch companion app.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 7.1, 7.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import type { WatchConnectionState, WorkoutContext } from '../types/health';
import type { TimerType, TimerState, WorkoutPhase, WorkoutTheme } from '../types/timer';

// Storage keys
const MESSAGE_QUEUE_KEY = '@watch_message_queue';
const APP_CONTEXT_KEY = '@watch_app_context';
const TIMER_STATE_KEY = '@watch_timer_state';

/**
 * Subscription handle for state changes and messages
 */
export interface Subscription {
  remove: () => void;
}

/**
 * Payload types for different message types
 */
export interface WorkoutStartPayload {
  workoutId: string;
  workoutName: string;
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
  }>;
}

export interface WorkoutEndPayload {
  workoutId: string;
  duration: number;
  totalCalories: number;
}

export interface SetCompletedPayload {
  workoutId: string;
  exerciseId: string;
  setId: string;
  completedAt: string;
  heartRateAtCompletion?: number;
}

export interface HeartRatePayload {
  value: number;
  timestamp: string;
  source: 'watch' | 'phone';
}

export interface SyncRequestPayload {
  lastSyncTimestamp: string;
}

// ============================================
// Timer Message Payloads (Interactive Workout Session)
// ============================================

/**
 * Payload for starting a timer on the Watch
 */
export interface TimerStartPayload {
  timerId: string;
  duration: number;
  timerType: TimerType;
  exerciseId?: string;
  setId?: string;
}

/**
 * Payload for timer control messages
 */
export interface TimerControlPayload {
  timerId: string;
}

/**
 * Payload for timer state updates
 */
export interface TimerStatePayload {
  timerId: string;
  state: TimerState;
  remaining: number;
  elapsed: number;
  duration: number;
  timerType: TimerType;
}

/**
 * Payload for phase change messages
 */
export interface PhaseChangePayload {
  phase: WorkoutPhase;
  theme: WorkoutTheme;
}

/**
 * Payload for full session state sync
 */
export interface SessionStatePayload {
  isActive: boolean;
  isPaused: boolean;
  currentPhase: WorkoutPhase;
  currentExercise: string | null;
  currentSet: number;
  totalSets: number;
  overallProgress: number;
  elapsedSeconds: number;
  activeTimers: TimerStatePayload[];
}

/**
 * Watch timer state for synchronization
 */
export interface WatchTimerState {
  activeTimers: TimerStatePayload[];
  currentExercise: string | null;
  currentPhase: WorkoutPhase;
  sessionElapsed: number;
  heartRate: number | null;
  calories: number;
}

/**
 * Union type for all Watch messages
 */
export type WatchMessage =
  | { type: 'START_WORKOUT'; payload: WorkoutStartPayload }
  | { type: 'END_WORKOUT'; payload: WorkoutEndPayload }
  | { type: 'SET_COMPLETED'; payload: SetCompletedPayload }
  | { type: 'HEART_RATE_UPDATE'; payload: HeartRatePayload }
  | { type: 'SYNC_REQUEST'; payload: SyncRequestPayload }
  // Timer-specific messages
  | { type: 'TIMER_START'; payload: TimerStartPayload }
  | { type: 'TIMER_PAUSE'; payload: TimerControlPayload }
  | { type: 'TIMER_RESUME'; payload: TimerControlPayload }
  | { type: 'TIMER_COMPLETE'; payload: TimerControlPayload }
  | { type: 'TIMER_SKIP'; payload: TimerControlPayload }
  | { type: 'TIMER_STATE_UPDATE'; payload: TimerStatePayload }
  | { type: 'PHASE_CHANGE'; payload: PhaseChangePayload }
  | { type: 'SESSION_STATE'; payload: SessionStatePayload };

/**
 * Queued message with metadata
 */
interface QueuedMessage {
  id: string;
  message: WatchMessage;
  queuedAt: string;
  retryCount: number;
}

/**
 * WatchConnectivityService class handles all Watch Connectivity interactions
 */
class WatchConnectivityService {
  private stateSubscribers: Map<string, (state: WatchConnectionState) => void> = new Map();
  private messageSubscribers: Map<string, (message: WatchMessage) => void> = new Map();
  private timerStateSubscribers: Map<string, (state: WatchTimerState) => void> = new Map();
  private eventEmitter: NativeEventEmitter | null = null;
  private stateListener: any = null;
  private messageListener: any = null;
  private currentState: WatchConnectionState = {
    isPaired: false,
    isReachable: false,
    isWatchAppInstalled: false,
  };
  private messageQueue: QueuedMessage[] = [];
  private isProcessingQueue: boolean = false;
  private initialized: boolean = false;
  private currentTimerState: WatchTimerState | null = null;
  private lastTimerSyncTimestamp: number = 0;

  constructor() {
    // Constructor is lightweight - actual initialization happens in initialize()
  }

  // ============================================
  // Initialization Methods
  // ============================================

  /**
   * Initialize the Watch Connectivity service
   * Sets up WCSession and begins listening for state changes
   * 
   * Requirements: 2.1
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    if (!this.isWatchConnectivityAvailable()) {
      console.warn('WatchConnectivityService: Watch Connectivity is not available');
      this.initialized = true;
      return;
    }

    this.initializeEventEmitter();
    this.setupStateListener();
    this.setupMessageListener();
    this.loadMessageQueue();
    this.activateSession();
    
    this.initialized = true;
  }

  /**
   * Check if Watch Connectivity is available on the current device
   * 
   * @returns true if Watch Connectivity is available, false otherwise
   */
  isWatchConnectivityAvailable(): boolean {
    // Watch Connectivity is only available on iOS
    if (Platform.OS !== 'ios') {
      return false;
    }

    // Check if the native module is available
    return !!NativeModules.WatchConnectivityModule;
  }

  /**
   * Initialize the native event emitter
   */
  private initializeEventEmitter(): void {
    if (Platform.OS === 'ios' && NativeModules.WatchConnectivityModule) {
      this.eventEmitter = new NativeEventEmitter(NativeModules.WatchConnectivityModule);
    }
  }

  /**
   * Activate the WCSession
   */
  private activateSession(): void {
    if (!this.isWatchConnectivityAvailable()) {
      return;
    }

    try {
      NativeModules.WatchConnectivityModule.activateSession();
    } catch (error) {
      console.error('WatchConnectivityService: Failed to activate session:', error);
    }
  }

  // ============================================
  // Connection State Methods
  // ============================================

  /**
   * Get the current Watch connection state
   * 
   * @returns Current WatchConnectionState
   * 
   * Requirements: 2.2, 2.3
   */
  getConnectionState(): WatchConnectionState {
    return { ...this.currentState };
  }

  /**
   * Subscribe to Watch connection state changes
   * 
   * @param callback - Function called when connection state changes
   * @returns Subscription handle to remove the subscription
   * 
   * Requirements: 2.2
   */
  subscribeToStateChanges(callback: (state: WatchConnectionState) => void): Subscription {
    const subscriptionId = this.generateSubscriptionId();
    this.stateSubscribers.set(subscriptionId, callback);

    // Immediately notify with current state
    callback(this.getConnectionState());

    return {
      remove: () => {
        this.stateSubscribers.delete(subscriptionId);
      },
    };
  }

  /**
   * Set up the native state change listener
   */
  private setupStateListener(): void {
    if (!this.eventEmitter) {
      return;
    }

    try {
      this.stateListener = this.eventEmitter.addListener(
        'onWatchStateChange',
        (data: { isPaired: boolean; isReachable: boolean; isWatchAppInstalled: boolean }) => {
          const newState: WatchConnectionState = {
            isPaired: data.isPaired,
            isReachable: data.isReachable,
            isWatchAppInstalled: data.isWatchAppInstalled,
          };

          // Only notify if state actually changed
          if (
            newState.isPaired !== this.currentState.isPaired ||
            newState.isReachable !== this.currentState.isReachable ||
            newState.isWatchAppInstalled !== this.currentState.isWatchAppInstalled
          ) {
            this.currentState = newState;
            this.notifyStateSubscribers(newState);

            // If Watch became reachable, process queued messages
            if (newState.isReachable && !this.isProcessingQueue) {
              this.processMessageQueue();
            }
          }
        }
      );
    } catch (error) {
      console.error('WatchConnectivityService: Failed to setup state listener:', error);
    }
  }

  /**
   * Notify all state subscribers of a state change
   */
  private notifyStateSubscribers(state: WatchConnectionState): void {
    this.stateSubscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('WatchConnectivityService: Error in state subscriber callback:', error);
      }
    });
  }

  // ============================================
  // Message Passing Methods
  // ============================================

  /**
   * Send a message to the Watch
   * If the Watch is not reachable, the message is queued for later delivery
   * 
   * @param message - The message to send
   * @returns Promise that resolves when message is sent or queued
   * 
   * Requirements: 2.4, 3.1, 3.2
   */
  async sendMessage(message: WatchMessage): Promise<void> {
    if (!this.isWatchConnectivityAvailable()) {
      // Queue message even if not available - it will be sent when available
      await this.queueMessage(message);
      return;
    }

    if (!this.currentState.isReachable) {
      // Queue message for later delivery
      await this.queueMessage(message);
      return;
    }

    try {
      await NativeModules.WatchConnectivityModule.sendMessage(message);
    } catch (error) {
      console.error('WatchConnectivityService: Failed to send message, queuing:', error);
      await this.queueMessage(message);
    }
  }

  /**
   * Subscribe to incoming messages from the Watch
   * 
   * @param callback - Function called when a message is received
   * @returns Subscription handle to remove the subscription
   * 
   * Requirements: 3.1, 3.2
   */
  subscribeToMessages(callback: (message: WatchMessage) => void): Subscription {
    const subscriptionId = this.generateSubscriptionId();
    this.messageSubscribers.set(subscriptionId, callback);

    return {
      remove: () => {
        this.messageSubscribers.delete(subscriptionId);
      },
    };
  }

  /**
   * Set up the native message listener
   */
  private setupMessageListener(): void {
    if (!this.eventEmitter) {
      return;
    }

    try {
      this.messageListener = this.eventEmitter.addListener(
        'onWatchMessage',
        (data: WatchMessage) => {
          this.notifyMessageSubscribers(data);
        }
      );
    } catch (error) {
      console.error('WatchConnectivityService: Failed to setup message listener:', error);
    }
  }

  /**
   * Notify all message subscribers of an incoming message
   */
  private notifyMessageSubscribers(message: WatchMessage): void {
    this.messageSubscribers.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('WatchConnectivityService: Error in message subscriber callback:', error);
      }
    });
  }

  // ============================================
  // Message Queue Methods
  // ============================================

  /**
   * Queue a message for later delivery
   * 
   * @param message - The message to queue
   * 
   * Requirements: 2.4
   */
  private async queueMessage(message: WatchMessage): Promise<void> {
    const queuedMessage: QueuedMessage = {
      id: this.generateMessageId(),
      message,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.messageQueue.push(queuedMessage);
    await this.saveMessageQueue();
  }

  /**
   * Process the message queue, sending messages in FIFO order
   * 
   * Requirements: 2.4
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    if (!this.currentState.isReachable) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0 && this.currentState.isReachable) {
        const queuedMessage = this.messageQueue[0];

        try {
          await NativeModules.WatchConnectivityModule.sendMessage(queuedMessage.message);
          // Remove successfully sent message from queue
          this.messageQueue.shift();
          await this.saveMessageQueue();
        } catch (error) {
          console.error('WatchConnectivityService: Failed to send queued message:', error);
          queuedMessage.retryCount++;
          
          // If too many retries, move to end of queue
          if (queuedMessage.retryCount >= 3) {
            this.messageQueue.shift();
            this.messageQueue.push(queuedMessage);
            await this.saveMessageQueue();
          }
          
          // Break to avoid infinite loop on persistent failures
          break;
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Save the message queue to AsyncStorage
   */
  private async saveMessageQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(this.messageQueue));
    } catch (error) {
      console.error('WatchConnectivityService: Failed to save message queue:', error);
    }
  }

  /**
   * Load the message queue from AsyncStorage
   */
  private async loadMessageQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(MESSAGE_QUEUE_KEY);
      if (data) {
        this.messageQueue = JSON.parse(data);
      }
    } catch (error) {
      console.error('WatchConnectivityService: Failed to load message queue:', error);
      this.messageQueue = [];
    }
  }

  /**
   * Get the current message queue (for testing purposes)
   * 
   * @returns Copy of the current message queue
   */
  getMessageQueue(): QueuedMessage[] {
    return [...this.messageQueue];
  }

  /**
   * Clear the message queue (for testing purposes)
   */
  async clearMessageQueue(): Promise<void> {
    this.messageQueue = [];
    await this.saveMessageQueue();
  }

  // ============================================
  // Application Context Methods
  // ============================================

  /**
   * Update the application context for background state sync
   * This is used to share workout state with the Watch when messages can't be sent
   * 
   * @param context - The workout context to share
   * 
   * Requirements: 7.1, 7.5
   */
  updateApplicationContext(context: WorkoutContext): void {
    if (!this.isWatchConnectivityAvailable()) {
      // Store locally even if not available
      this.saveApplicationContextLocally(context);
      return;
    }

    try {
      NativeModules.WatchConnectivityModule.updateApplicationContext(context);
      this.saveApplicationContextLocally(context);
    } catch (error) {
      console.error('WatchConnectivityService: Failed to update application context:', error);
      // Still save locally as fallback
      this.saveApplicationContextLocally(context);
    }
  }

  /**
   * Get the current application context
   * 
   * @returns The current WorkoutContext or null if not set
   * 
   * Requirements: 7.1, 7.5
   */
  async getApplicationContext(): Promise<WorkoutContext | null> {
    if (!this.isWatchConnectivityAvailable()) {
      return this.loadApplicationContextLocally();
    }

    try {
      const context = await NativeModules.WatchConnectivityModule.getApplicationContext();
      return context || null;
    } catch (error) {
      console.error('WatchConnectivityService: Failed to get application context:', error);
      return this.loadApplicationContextLocally();
    }
  }

  /**
   * Save application context to AsyncStorage as fallback
   */
  private async saveApplicationContextLocally(context: WorkoutContext): Promise<void> {
    try {
      await AsyncStorage.setItem(APP_CONTEXT_KEY, JSON.stringify(context));
    } catch (error) {
      console.error('WatchConnectivityService: Failed to save app context locally:', error);
    }
  }

  /**
   * Load application context from AsyncStorage
   */
  private async loadApplicationContextLocally(): Promise<WorkoutContext | null> {
    try {
      const data = await AsyncStorage.getItem(APP_CONTEXT_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('WatchConnectivityService: Failed to load app context locally:', error);
    }
    return null;
  }

  // ============================================
  // Timer Synchronization Methods
  // ============================================

  /**
   * Send timer start message to Watch
   * 
   * @param timerId - Unique timer identifier
   * @param duration - Timer duration in seconds
   * @param timerType - Type of timer (exercise, rest, workout)
   * @param exerciseId - Optional associated exercise ID
   * @param setId - Optional associated set ID
   * 
   * Requirements: 7.5
   */
  async sendTimerStart(
    timerId: string,
    duration: number,
    timerType: TimerType,
    exerciseId?: string,
    setId?: string
  ): Promise<void> {
    const message: WatchMessage = {
      type: 'TIMER_START',
      payload: {
        timerId,
        duration,
        timerType,
        exerciseId,
        setId,
      },
    };
    await this.sendMessage(message);
    this.updateLocalTimerState(timerId, 'running', duration, 0, duration, timerType);
  }

  /**
   * Send timer pause message to Watch
   * 
   * @param timerId - Timer ID to pause
   * 
   * Requirements: 7.5
   */
  async sendTimerPause(timerId: string): Promise<void> {
    const message: WatchMessage = {
      type: 'TIMER_PAUSE',
      payload: { timerId },
    };
    await this.sendMessage(message);
  }

  /**
   * Send timer resume message to Watch
   * 
   * @param timerId - Timer ID to resume
   * 
   * Requirements: 7.5
   */
  async sendTimerResume(timerId: string): Promise<void> {
    const message: WatchMessage = {
      type: 'TIMER_RESUME',
      payload: { timerId },
    };
    await this.sendMessage(message);
  }

  /**
   * Send timer complete message to Watch
   * 
   * @param timerId - Timer ID that completed
   * 
   * Requirements: 7.5
   */
  async sendTimerComplete(timerId: string): Promise<void> {
    const message: WatchMessage = {
      type: 'TIMER_COMPLETE',
      payload: { timerId },
    };
    await this.sendMessage(message);
  }

  /**
   * Send timer skip message to Watch
   * 
   * @param timerId - Timer ID to skip
   * 
   * Requirements: 7.5
   */
  async sendTimerSkip(timerId: string): Promise<void> {
    const message: WatchMessage = {
      type: 'TIMER_SKIP',
      payload: { timerId },
    };
    await this.sendMessage(message);
  }

  /**
   * Send timer state update to Watch for real-time synchronization
   * 
   * @param timerState - Current timer state payload
   * 
   * Requirements: 7.5
   */
  async sendTimerStateUpdate(timerState: TimerStatePayload): Promise<void> {
    const message: WatchMessage = {
      type: 'TIMER_STATE_UPDATE',
      payload: timerState,
    };
    await this.sendMessage(message);
    this.updateLocalTimerState(
      timerState.timerId,
      timerState.state,
      timerState.remaining,
      timerState.elapsed,
      timerState.duration,
      timerState.timerType
    );
  }

  /**
   * Send phase change message to Watch
   * 
   * @param phase - New workout phase
   * @param theme - Theme colors for the phase
   * 
   * Requirements: 7.5
   */
  async sendPhaseChange(phase: WorkoutPhase, theme: WorkoutTheme): Promise<void> {
    const message: WatchMessage = {
      type: 'PHASE_CHANGE',
      payload: { phase, theme },
    };
    await this.sendMessage(message);
    
    if (this.currentTimerState) {
      this.currentTimerState.currentPhase = phase;
    }
  }

  /**
   * Send full session state to Watch for synchronization
   * 
   * @param sessionState - Complete session state payload
   * 
   * Requirements: 7.5
   */
  async sendSessionState(sessionState: SessionStatePayload): Promise<void> {
    const message: WatchMessage = {
      type: 'SESSION_STATE',
      payload: sessionState,
    };
    await this.sendMessage(message);
    this.lastTimerSyncTimestamp = Date.now();
    
    // Update local timer state
    this.currentTimerState = {
      activeTimers: sessionState.activeTimers,
      currentExercise: sessionState.currentExercise,
      currentPhase: sessionState.currentPhase,
      sessionElapsed: sessionState.elapsedSeconds,
      heartRate: null,
      calories: 0,
    };
  }

  /**
   * Subscribe to timer state updates from Watch
   * 
   * @param callback - Function called when timer state is received from Watch
   * @returns Subscription handle to remove the subscription
   * 
   * Requirements: 7.5
   */
  subscribeToTimerStateUpdates(callback: (state: WatchTimerState) => void): Subscription {
    const subscriptionId = this.generateSubscriptionId();
    this.timerStateSubscribers.set(subscriptionId, callback);

    // Immediately notify with current state if available
    if (this.currentTimerState) {
      callback(this.currentTimerState);
    }

    return {
      remove: () => {
        this.timerStateSubscribers.delete(subscriptionId);
      },
    };
  }

  /**
   * Get the current timer state
   * 
   * @returns Current WatchTimerState or null if not set
   * 
   * Requirements: 7.5
   */
  getCurrentTimerState(): WatchTimerState | null {
    return this.currentTimerState ? { ...this.currentTimerState } : null;
  }

  /**
   * Get the timestamp of the last timer sync
   * 
   * @returns Timestamp in milliseconds
   */
  getLastTimerSyncTimestamp(): number {
    return this.lastTimerSyncTimestamp;
  }

  /**
   * Update local timer state and notify subscribers
   */
  private updateLocalTimerState(
    timerId: string,
    state: TimerState,
    remaining: number,
    elapsed: number,
    duration: number,
    timerType: TimerType
  ): void {
    if (!this.currentTimerState) {
      this.currentTimerState = {
        activeTimers: [],
        currentExercise: null,
        currentPhase: 'warmup',
        sessionElapsed: 0,
        heartRate: null,
        calories: 0,
      };
    }

    const existingIndex = this.currentTimerState.activeTimers.findIndex(
      t => t.timerId === timerId
    );

    const timerPayload: TimerStatePayload = {
      timerId,
      state,
      remaining,
      elapsed,
      duration,
      timerType,
    };

    if (existingIndex >= 0) {
      if (state === 'completed' || state === 'stopped') {
        this.currentTimerState.activeTimers.splice(existingIndex, 1);
      } else {
        this.currentTimerState.activeTimers[existingIndex] = timerPayload;
      }
    } else if (state !== 'completed' && state !== 'stopped') {
      this.currentTimerState.activeTimers.push(timerPayload);
    }

    this.notifyTimerStateSubscribers(this.currentTimerState);
  }

  /**
   * Notify all timer state subscribers
   */
  private notifyTimerStateSubscribers(state: WatchTimerState): void {
    this.timerStateSubscribers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('WatchConnectivityService: Error in timer state subscriber callback:', error);
      }
    });
  }

  /**
   * Save timer state to AsyncStorage for persistence
   */
  async saveTimerState(): Promise<void> {
    if (!this.currentTimerState) return;
    
    try {
      await AsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(this.currentTimerState));
    } catch (error) {
      console.error('WatchConnectivityService: Failed to save timer state:', error);
    }
  }

  /**
   * Load timer state from AsyncStorage
   */
  async loadTimerState(): Promise<WatchTimerState | null> {
    try {
      const data = await AsyncStorage.getItem(TIMER_STATE_KEY);
      if (data) {
        this.currentTimerState = JSON.parse(data);
        return this.currentTimerState;
      }
    } catch (error) {
      console.error('WatchConnectivityService: Failed to load timer state:', error);
    }
    return null;
  }

  /**
   * Clear timer state
   */
  async clearTimerState(): Promise<void> {
    this.currentTimerState = null;
    try {
      await AsyncStorage.removeItem(TIMER_STATE_KEY);
    } catch (error) {
      console.error('WatchConnectivityService: Failed to clear timer state:', error);
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

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clean up resources when service is no longer needed
   */
  cleanup(): void {
    if (this.stateListener) {
      this.stateListener.remove();
      this.stateListener = null;
    }

    if (this.messageListener) {
      this.messageListener.remove();
      this.messageListener = null;
    }

    this.stateSubscribers.clear();
    this.messageSubscribers.clear();
    this.timerStateSubscribers.clear();
    this.currentTimerState = null;
    this.initialized = false;
  }

  // ============================================
  // Testing Helper Methods
  // ============================================

  /**
   * Simulate a state change (for testing purposes)
   * This method is only intended for use in tests
   */
  _simulateStateChange(state: WatchConnectionState): void {
    const previousState = this.currentState;
    this.currentState = state;
    
    // Only notify if state actually changed
    if (
      state.isPaired !== previousState.isPaired ||
      state.isReachable !== previousState.isReachable ||
      state.isWatchAppInstalled !== previousState.isWatchAppInstalled
    ) {
      this.notifyStateSubscribers(state);
    }
  }

  /**
   * Simulate receiving a message (for testing purposes)
   * This method is only intended for use in tests
   */
  _simulateMessageReceived(message: WatchMessage): void {
    this.notifyMessageSubscribers(message);
  }

  /**
   * Get the number of state subscribers (for testing purposes)
   */
  _getStateSubscriberCount(): number {
    return this.stateSubscribers.size;
  }

  /**
   * Get the number of message subscribers (for testing purposes)
   */
  _getMessageSubscriberCount(): number {
    return this.messageSubscribers.size;
  }

  /**
   * Simulate receiving a timer state update from Watch (for testing purposes)
   * This method is only intended for use in tests
   */
  _simulateTimerStateReceived(state: WatchTimerState): void {
    this.currentTimerState = state;
    this.notifyTimerStateSubscribers(state);
  }

  /**
   * Get the number of timer state subscribers (for testing purposes)
   */
  _getTimerStateSubscriberCount(): number {
    return this.timerStateSubscribers.size;
  }

  /**
   * Set the last timer sync timestamp (for testing purposes)
   */
  _setLastTimerSyncTimestamp(timestamp: number): void {
    this.lastTimerSyncTimestamp = timestamp;
  }
}

// Export singleton instance
export const watchConnectivityService = new WatchConnectivityService();

// Export class for testing purposes
export { WatchConnectivityService };
