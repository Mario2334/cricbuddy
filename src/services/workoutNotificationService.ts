/**
 * Workout Notification Service Module
 * 
 * This module handles persistent notifications for active workouts,
 * displaying workout status when the app is in the background.
 * 
 * Requirements: 8.3
 */

import { Platform, NativeModules } from 'react-native';

/**
 * Notification content for workout status
 */
export interface WorkoutNotificationContent {
  title: string;
  body: string;
  heartRate?: number;
  calories?: number;
  elapsedTime?: string;
}

/**
 * WorkoutNotificationService class handles persistent workout notifications
 */
class WorkoutNotificationService {
  private notificationId: string | null = null;
  private isNotificationActive: boolean = false;

  constructor() {
    // Constructor is lightweight
  }

  // ============================================
  // Notification Management (Task 9.2)
  // ============================================

  /**
   * Show persistent notification for active workout
   * 
   * @param content - WorkoutNotificationContent to display
   * 
   * Requirements: 8.3
   */
  async showWorkoutNotification(content: WorkoutNotificationContent): Promise<void> {
    if (Platform.OS !== 'ios') {
      return;
    }

    try {
      // Use native module to show notification if available
      if (NativeModules.WorkoutNotificationModule) {
        const notificationId = await NativeModules.WorkoutNotificationModule.showNotification({
          title: content.title,
          body: content.body,
          heartRate: content.heartRate,
          calories: content.calories,
          elapsedTime: content.elapsedTime,
          category: 'workout',
          ongoing: true,
        });
        
        this.notificationId = notificationId;
        this.isNotificationActive = true;
      }
    } catch (error) {
      console.error('WorkoutNotificationService: Failed to show notification:', error);
    }
  }

  /**
   * Update the persistent workout notification
   * 
   * @param content - Updated WorkoutNotificationContent
   * 
   * Requirements: 8.3
   */
  async updateWorkoutNotification(content: WorkoutNotificationContent): Promise<void> {
    if (!this.isNotificationActive || Platform.OS !== 'ios') {
      return;
    }

    try {
      if (NativeModules.WorkoutNotificationModule && this.notificationId) {
        await NativeModules.WorkoutNotificationModule.updateNotification(this.notificationId, {
          title: content.title,
          body: content.body,
          heartRate: content.heartRate,
          calories: content.calories,
          elapsedTime: content.elapsedTime,
        });
      }
    } catch (error) {
      console.error('WorkoutNotificationService: Failed to update notification:', error);
    }
  }

  /**
   * Hide the persistent workout notification
   * 
   * Requirements: 8.3
   */
  async hideWorkoutNotification(): Promise<void> {
    if (!this.isNotificationActive || Platform.OS !== 'ios') {
      return;
    }

    try {
      if (NativeModules.WorkoutNotificationModule && this.notificationId) {
        await NativeModules.WorkoutNotificationModule.hideNotification(this.notificationId);
      }
    } catch (error) {
      console.error('WorkoutNotificationService: Failed to hide notification:', error);
    } finally {
      this.notificationId = null;
      this.isNotificationActive = false;
    }
  }

  /**
   * Check if notification is currently active
   */
  isActive(): boolean {
    return this.isNotificationActive;
  }

  /**
   * Format elapsed time for notification display
   * 
   * @param seconds - Elapsed seconds
   * @returns Formatted time string (MM:SS or HH:MM:SS)
   */
  formatElapsedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Build notification content from workout metrics
   * 
   * @param workoutName - Name of the workout
   * @param heartRate - Current heart rate (optional)
   * @param calories - Calories burned (optional)
   * @param elapsedSeconds - Elapsed time in seconds
   * @returns WorkoutNotificationContent
   */
  buildNotificationContent(
    workoutName: string,
    heartRate: number | null,
    calories: number,
    elapsedSeconds: number
  ): WorkoutNotificationContent {
    const elapsedTime = this.formatElapsedTime(elapsedSeconds);
    
    let body = `Duration: ${elapsedTime}`;
    if (heartRate !== null) {
      body += ` • ${heartRate} BPM`;
    }
    if (calories > 0) {
      body += ` • ${Math.round(calories)} kcal`;
    }

    return {
      title: `🏋️ ${workoutName}`,
      body,
      heartRate: heartRate ?? undefined,
      calories,
      elapsedTime,
    };
  }

  // ============================================
  // Testing Helper Methods
  // ============================================

  /**
   * Reset for testing
   */
  _resetForTesting(): void {
    this.notificationId = null;
    this.isNotificationActive = false;
  }

  /**
   * Get notification ID (for testing)
   */
  _getNotificationId(): string | null {
    return this.notificationId;
  }
}

// Export singleton instance
export const workoutNotificationService = new WorkoutNotificationService();

// Export class for testing purposes
export { WorkoutNotificationService };
