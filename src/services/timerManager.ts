/**
 * TimerManager Service
 * 
 * Manages all timer types and their states during workout sessions.
 * Provides timer creation, control, state management, and cleanup functionality.
 */

import { 
  Timer, 
  ActiveTimer, 
  TimerType, 
  TimerState 
} from '../types/timer';

/**
 * Subscription interface for timer updates
 */
export interface Subscription {
  unsubscribe: () => void;
}

/**
 * Timer update callback function type
 */
export type TimerUpdateCallback = (timer: Timer) => void;

/**
 * TimerManager class handles all timer lifecycle operations
 * Provides centralized timer management for interactive workout sessions
 */
export class TimerManager {
  private timers: Map<string, Timer> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private subscribers: Map<string, Set<TimerUpdateCallback>> = new Map();
  private globalSubscribers: Set<(timers: Timer[]) => void> = new Set();

  /**
   * Creates a new exercise timer with specified duration
   * @param duration Timer duration in seconds
   * @param exerciseId Associated exercise ID
   * @returns Timer ID for reference
   */
  createExerciseTimer(duration: number, exerciseId: string): string {
    const timerId = this.generateTimerId('exercise');
    const timer: Timer = {
      id: timerId,
      type: 'exercise',
      state: 'created',
      duration,
      remaining: duration,
      elapsed: 0,
      exerciseId,
      createdAt: new Date(),
    };

    this.timers.set(timerId, timer);
    this.notifyGlobalSubscribers();
    return timerId;
  }

  /**
   * Creates a new rest timer with specified duration
   * @param duration Timer duration in seconds
   * @param setId Associated set ID
   * @returns Timer ID for reference
   */
  createRestTimer(duration: number, setId: string): string {
    const timerId = this.generateTimerId('rest');
    const timer: Timer = {
      id: timerId,
      type: 'rest',
      state: 'created',
      duration,
      remaining: duration,
      elapsed: 0,
      setId,
      createdAt: new Date(),
    };

    this.timers.set(timerId, timer);
    this.notifyGlobalSubscribers();
    return timerId;
  }

  /**
   * Creates a new workout timer (counts up from 0)
   * @returns Timer ID for reference
   */
  createWorkoutTimer(): string {
    const timerId = this.generateTimerId('workout');
    const timer: Timer = {
      id: timerId,
      type: 'workout',
      state: 'created',
      duration: 0, // Workout timer counts up indefinitely
      remaining: 0,
      elapsed: 0,
      createdAt: new Date(),
    };

    this.timers.set(timerId, timer);
    this.notifyGlobalSubscribers();
    return timerId;
  }

  /**
   * Starts a timer by ID
   * @param timerId Timer ID to start
   */
  startTimer(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (!timer || timer.state === 'running') {
      return;
    }

    // Update timer state
    timer.state = 'running';
    timer.startedAt = new Date();

    // Clear any existing interval
    this.clearInterval(timerId);

    // Start the timer interval
    const interval = setInterval(() => {
      this.updateTimer(timerId);
    }, 100); // Update every 100ms for smooth UI

    this.intervals.set(timerId, interval);
    this.notifySubscribers(timerId, timer);
    this.notifyGlobalSubscribers();
  }

  /**
   * Pauses a running timer
   * @param timerId Timer ID to pause
   */
  pauseTimer(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (!timer || timer.state !== 'running') {
      return;
    }

    timer.state = 'paused';
    timer.pausedAt = new Date();
    this.clearInterval(timerId);
    
    this.notifySubscribers(timerId, timer);
    this.notifyGlobalSubscribers();
  }

  /**
   * Resumes a paused timer
   * @param timerId Timer ID to resume
   */
  resumeTimer(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (!timer || timer.state !== 'paused') {
      return;
    }

    timer.state = 'running';
    timer.pausedAt = undefined;

    // Restart the interval
    const interval = setInterval(() => {
      this.updateTimer(timerId);
    }, 100);

    this.intervals.set(timerId, interval);
    this.notifySubscribers(timerId, timer);
    this.notifyGlobalSubscribers();
  }

  /**
   * Stops a timer and marks it as stopped
   * @param timerId Timer ID to stop
   */
  stopTimer(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (!timer) {
      return;
    }

    timer.state = 'stopped';
    this.clearInterval(timerId);
    
    this.notifySubscribers(timerId, timer);
    this.notifyGlobalSubscribers();
  }

  /**
   * Adjusts timer duration by specified seconds (+/- 15s intervals)
   * @param timerId Timer ID to adjust
   * @param adjustmentSeconds Seconds to add (positive) or subtract (negative)
   */
  adjustTimer(timerId: string, adjustmentSeconds: number): void {
    const timer = this.timers.get(timerId);
    if (!timer || timer.type === 'workout') {
      return; // Cannot adjust workout timer
    }

    // Ensure adjustment is in 15-second intervals
    const normalizedAdjustment = Math.round(adjustmentSeconds / 15) * 15;
    
    // Calculate new duration with bounds checking
    const newDuration = Math.max(15, Math.min(300, timer.duration + normalizedAdjustment));
    const durationChange = newDuration - timer.duration;
    
    // Update timer properties
    timer.duration = newDuration;
    timer.remaining = Math.max(0, timer.remaining + durationChange);
    
    this.notifySubscribers(timerId, timer);
    this.notifyGlobalSubscribers();
  }

  /**
   * Gets a timer by ID
   * @param timerId Timer ID to retrieve
   * @returns Timer object or null if not found
   */
  getTimer(timerId: string): Timer | null {
    return this.timers.get(timerId) || null;
  }

  /**
   * Gets all active timers (running or paused)
   * @returns Array of active timers
   */
  getActiveTimers(): Timer[] {
    return Array.from(this.timers.values()).filter(
      timer => timer.state === 'running' || timer.state === 'paused'
    );
  }

  /**
   * Gets all timers as ActiveTimer objects with computed properties
   * @returns Array of ActiveTimer objects
   */
  getActiveTimersWithDisplay(): ActiveTimer[] {
    return this.getActiveTimers().map(timer => this.toActiveTimer(timer));
  }

  /**
   * Subscribes to updates for a specific timer
   * @param timerId Timer ID to subscribe to
   * @param callback Callback function for timer updates
   * @returns Subscription object with unsubscribe method
   */
  subscribeToTimer(timerId: string, callback: TimerUpdateCallback): Subscription {
    if (!this.subscribers.has(timerId)) {
      this.subscribers.set(timerId, new Set());
    }
    
    this.subscribers.get(timerId)!.add(callback);
    
    return {
      unsubscribe: () => {
        const timerSubscribers = this.subscribers.get(timerId);
        if (timerSubscribers) {
          timerSubscribers.delete(callback);
          if (timerSubscribers.size === 0) {
            this.subscribers.delete(timerId);
          }
        }
      }
    };
  }

  /**
   * Subscribes to updates for all timers
   * @param callback Callback function for timer list updates
   * @returns Subscription object with unsubscribe method
   */
  subscribeToAllTimers(callback: (timers: Timer[]) => void): Subscription {
    this.globalSubscribers.add(callback);
    
    return {
      unsubscribe: () => {
        this.globalSubscribers.delete(callback);
      }
    };
  }

  /**
   * Clears a specific timer and its resources
   * @param timerId Timer ID to clear
   */
  clearTimer(timerId: string): void {
    this.clearInterval(timerId);
    this.timers.delete(timerId);
    this.subscribers.delete(timerId);
    this.notifyGlobalSubscribers();
  }

  /**
   * Clears all timers and resources
   */
  clearAllTimers(): void {
    // Clear all intervals
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });

    // Clear all data structures
    this.timers.clear();
    this.intervals.clear();
    this.subscribers.clear();
    this.globalSubscribers.clear();
  }

  /**
   * Private method to update timer state during intervals
   * @param timerId Timer ID to update
   */
  private updateTimer(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (!timer || timer.state !== 'running') {
      return;
    }

    const now = new Date();
    const startTime = timer.startedAt || timer.createdAt;
    const totalElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    if (timer.type === 'workout') {
      // Workout timer counts up
      timer.elapsed = totalElapsed;
      timer.remaining = 0;
    } else {
      // Exercise and rest timers count down
      timer.elapsed = totalElapsed;
      timer.remaining = Math.max(0, timer.duration - totalElapsed);

      // Check if timer is complete
      if (timer.remaining === 0) {
        timer.state = 'completed';
        timer.completedAt = now;
        this.clearInterval(timerId);
      }
    }

    this.notifySubscribers(timerId, timer);
    this.notifyGlobalSubscribers();
  }

  /**
   * Converts a Timer to ActiveTimer with computed display properties
   * @param timer Timer object to convert
   * @returns ActiveTimer with display properties
   */
  private toActiveTimer(timer: Timer): ActiveTimer {
    const progress = timer.type === 'workout' 
      ? 0 // Workout timer doesn't have progress
      : timer.duration > 0 
        ? (timer.duration - timer.remaining) / timer.duration 
        : 0;

    const displayTime = timer.type === 'workout'
      ? this.formatTime(timer.elapsed)
      : this.formatTime(timer.remaining);

    return {
      ...timer,
      progress,
      displayTime,
      isCountdown: timer.type !== 'workout',
    };
  }

  /**
   * Formats seconds into MM:SS format
   * @param seconds Seconds to format
   * @returns Formatted time string
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Generates a unique timer ID
   * @param type Timer type for ID prefix
   * @returns Unique timer ID
   */
  private generateTimerId(type: TimerType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Clears interval for a specific timer
   * @param timerId Timer ID to clear interval for
   */
  private clearInterval(timerId: string): void {
    const interval = this.intervals.get(timerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(timerId);
    }
  }

  /**
   * Notifies subscribers of a specific timer
   * @param timerId Timer ID that was updated
   * @param timer Updated timer object
   */
  private notifySubscribers(timerId: string, timer: Timer): void {
    const timerSubscribers = this.subscribers.get(timerId);
    if (timerSubscribers) {
      timerSubscribers.forEach(callback => {
        try {
          callback(timer);
        } catch (error) {
          console.error('Error in timer subscriber callback:', error);
        }
      });
    }
  }

  /**
   * Notifies global subscribers of timer list changes
   */
  private notifyGlobalSubscribers(): void {
    const allTimers = Array.from(this.timers.values());
    this.globalSubscribers.forEach(callback => {
      try {
        callback(allTimers);
      } catch (error) {
        console.error('Error in global timer subscriber callback:', error);
      }
    });
  }
}

// Export singleton instance
export const timerManager = new TimerManager();