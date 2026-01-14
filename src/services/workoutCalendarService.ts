/**
 * Workout Calendar Service Module
 * 
 * This module provides methods to schedule, manage, and sync workouts
 * with the device calendar for the Workout Calendar Scheduling feature.
 * 
 * Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 6.1, 6.2, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { Alert, Linking } from 'react-native';
import type { 
  ScheduledWorkout, 
  RecurringPattern, 
  ConflictResult
} from '../types/fitness';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Storage key for scheduled workouts
const SCHEDULED_WORKOUTS_KEY = '@scheduled_workouts';
// Storage key for scheduled matches (used by existing match scheduling feature)
const SCHEDULED_MATCHES_KEY = 'scheduledMatches';

/**
 * Generate a unique ID using timestamp and random string
 * @returns A unique string identifier
 */
function generateId(prefix: string = 'sw'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
function formatDateToLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * WorkoutCalendarService class handles all scheduled workout operations
 */
class WorkoutCalendarService {
  // ============================================
  // Core Schedule Management (Task 2.1)
  // ============================================

  /**
   * Schedule a new workout
   * Creates a ScheduledWorkout record and persists it to AsyncStorage
   * 
   * @param workout - The workout data to schedule (without id, createdAt, updatedAt)
   * @returns The created ScheduledWorkout with generated fields
   * 
   * Requirements: 1.4, 8.1, 8.2
   */
  async scheduleWorkout(
    workout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScheduledWorkout> {
    const now = new Date().toISOString();
    
    const scheduledWorkout: ScheduledWorkout = {
      ...workout,
      id: generateId('sw'),
      createdAt: now,
      updatedAt: now,
    };

    // Get existing workouts and add the new one
    const existingWorkouts = await this.getScheduledWorkouts();
    existingWorkouts.push(scheduledWorkout);

    // Persist to AsyncStorage
    await AsyncStorage.setItem(
      SCHEDULED_WORKOUTS_KEY, 
      JSON.stringify(existingWorkouts)
    );

    return scheduledWorkout;
  }

  /**
   * Retrieve all scheduled workouts from AsyncStorage
   * 
   * @returns Array of all ScheduledWorkout objects
   * 
   * Requirements: 8.1, 8.2, 8.3
   */
  async getScheduledWorkouts(): Promise<ScheduledWorkout[]> {
    try {
      const data = await AsyncStorage.getItem(SCHEDULED_WORKOUTS_KEY);
      
      if (!data) {
        return [];
      }
      
      return JSON.parse(data) as ScheduledWorkout[];
    } catch (error) {
      // If AsyncStorage read fails, return empty list and log error
      // Requirements: 8.4
      console.error('WorkoutCalendarService: Failed to retrieve scheduled workouts:', error);
      return [];
    }
  }

  /**
   * Retrieve scheduled workouts within a date range
   * 
   * @param startDate - Start date (inclusive) in ISO format (YYYY-MM-DD)
   * @param endDate - End date (inclusive) in ISO format (YYYY-MM-DD)
   * @returns Array of ScheduledWorkout objects within the date range
   * 
   * Requirements: 8.3
   */
  async getScheduledWorkoutsByDateRange(
    startDate: string, 
    endDate: string
  ): Promise<ScheduledWorkout[]> {
    const allWorkouts = await this.getScheduledWorkouts();
    
    return allWorkouts.filter(workout => {
      return workout.scheduledDate >= startDate && workout.scheduledDate <= endDate;
    });
  }

  /**
   * Retrieve a single scheduled workout by ID
   * 
   * @param id - The unique workout identifier
   * @returns The ScheduledWorkout or null if not found
   */
  async getScheduledWorkoutById(id: string): Promise<ScheduledWorkout | null> {
    const allWorkouts = await this.getScheduledWorkouts();
    return allWorkouts.find(workout => workout.id === id) || null;
  }

  /**
   * Update an existing scheduled workout
   * 
   * @param id - The ID of the workout to update
   * @param updates - Partial workout data to update
   * @returns The updated ScheduledWorkout
   * @throws Error if workout not found
   * 
   * Requirements: 5.1, 5.2
   */
  async updateScheduledWorkout(
    id: string, 
    updates: Partial<Omit<ScheduledWorkout, 'id' | 'createdAt'>>
  ): Promise<ScheduledWorkout> {
    const allWorkouts = await this.getScheduledWorkouts();
    const workoutIndex = allWorkouts.findIndex(w => w.id === id);
    
    if (workoutIndex === -1) {
      throw new Error(`Scheduled workout with id ${id} not found`);
    }

    const updatedWorkout: ScheduledWorkout = {
      ...allWorkouts[workoutIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    allWorkouts[workoutIndex] = updatedWorkout;

    await AsyncStorage.setItem(
      SCHEDULED_WORKOUTS_KEY, 
      JSON.stringify(allWorkouts)
    );

    return updatedWorkout;
  }

  /**
   * Delete a scheduled workout by ID
   * 
   * @param id - The ID of the workout to delete
   * @throws Error if workout not found
   * 
   * Requirements: 5.4
   */
  async deleteScheduledWorkout(id: string): Promise<void> {
    const allWorkouts = await this.getScheduledWorkouts();
    const workoutIndex = allWorkouts.findIndex(w => w.id === id);
    
    if (workoutIndex === -1) {
      throw new Error(`Scheduled workout with id ${id} not found`);
    }

    // Remove the workout from the array
    allWorkouts.splice(workoutIndex, 1);

    await AsyncStorage.setItem(
      SCHEDULED_WORKOUTS_KEY, 
      JSON.stringify(allWorkouts)
    );
  }

  // ============================================
  // Device Calendar Integration (Task 2.3)
  // ============================================

  /**
   * Request calendar permissions from the user
   * 
   * @returns true if permission granted, false otherwise
   * 
   * Requirements: 2.5
   */
  async requestCalendarPermission(): Promise<boolean> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Calendar Permission Required',
        'To sync workouts with your calendar, please enable calendar access in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
    return true;
  }

  /**
   * Get the default calendar for creating events
   * 
   * @returns The default calendar or first available calendar
   */
  private async getDefaultCalendar(): Promise<Calendar.Calendar | null> {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      
      // Try to find the default calendar
      const defaultCalendar = calendars.find(cal => 
        cal.allowsModifications && 
        (cal.source.name === 'Default' || cal.isPrimary)
      );
      
      // Fall back to first modifiable calendar
      return defaultCalendar || calendars.find(cal => cal.allowsModifications) || null;
    } catch (error) {
      console.error('WorkoutCalendarService: Failed to get calendars:', error);
      return null;
    }
  }

  /**
   * Sync a scheduled workout to the device calendar
   * Creates a calendar event with reminder
   * 
   * @param workout - The scheduled workout to sync
   * @returns The calendar event ID, or null if sync failed
   * 
   * Requirements: 2.1, 2.2, 2.3
   */
  async syncToDeviceCalendar(workout: ScheduledWorkout): Promise<string | null> {
    try {
      const hasPermission = await this.requestCalendarPermission();
      if (!hasPermission) return null;

      const calendar = await this.getDefaultCalendar();
      if (!calendar) {
        console.error('WorkoutCalendarService: No calendar available');
        return null;
      }

      // Parse scheduled date and time
      const [year, month, day] = workout.scheduledDate.split('-').map(Number);
      const [hours, minutes] = workout.scheduledTime.split(':').map(Number);
      
      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(startDate.getTime() + workout.durationMinutes * 60 * 1000);

      // Format focus areas for display
      const focusAreasText = workout.focusAreas.join(', ');

      const eventDetails = {
        title: `🏋️ ${workout.templateName}`,
        startDate,
        endDate,
        notes: `Focus Areas: ${focusAreasText}\nDuration: ${workout.durationMinutes} minutes`,
        alarms: [
          {
            relativeOffset: -30, // 30 minutes before (in minutes, negative means before)
            method: Calendar.AlarmMethod.ALERT,
          },
        ],
      };

      const eventId = await Calendar.createEventAsync(calendar.id, eventDetails);
      console.log('WorkoutCalendarService: Event created with 30-minute reminder:', eventId);
      
      return eventId;
    } catch (error) {
      console.error('WorkoutCalendarService: Failed to sync to device calendar:', error);
      return null;
    }
  }

  /**
   * Remove a calendar event from the device calendar
   * 
   * @param calendarEventId - The ID of the calendar event to remove
   * @returns true if removal successful, false otherwise
   * 
   * Requirements: 2.4
   */
  async removeFromDeviceCalendar(calendarEventId: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestCalendarPermission();
      if (!hasPermission) return false;

      await Calendar.deleteEventAsync(calendarEventId);
      console.log('WorkoutCalendarService: Event removed from calendar:', calendarEventId);
      return true;
    } catch (error) {
      console.error('WorkoutCalendarService: Failed to remove calendar event:', error);
      return false;
    }
  }

  /**
   * Update an existing calendar event
   * 
   * @param calendarEventId - The ID of the calendar event to update
   * @param workout - The updated workout data
   * @returns true if update successful, false otherwise
   * 
   * Requirements: 5.3
   */
  async updateDeviceCalendarEvent(
    calendarEventId: string, 
    workout: ScheduledWorkout
  ): Promise<boolean> {
    try {
      const hasPermission = await this.requestCalendarPermission();
      if (!hasPermission) return false;

      // Parse scheduled date and time
      const [year, month, day] = workout.scheduledDate.split('-').map(Number);
      const [hours, minutes] = workout.scheduledTime.split(':').map(Number);
      
      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(startDate.getTime() + workout.durationMinutes * 60 * 1000);

      // Format focus areas for display
      const focusAreasText = workout.focusAreas.join(', ');

      const eventDetails = {
        title: `🏋️ ${workout.templateName}`,
        startDate,
        endDate,
        notes: `Focus Areas: ${focusAreasText}\nDuration: ${workout.durationMinutes} minutes`,
        alarms: [
          {
            relativeOffset: -30,
            method: Calendar.AlarmMethod.ALERT,
          },
        ],
      };

      await Calendar.updateEventAsync(calendarEventId, eventDetails);
      console.log('WorkoutCalendarService: Calendar event updated:', calendarEventId);
      return true;
    } catch (error) {
      console.error('WorkoutCalendarService: Failed to update calendar event:', error);
      return false;
    }
  }

  // ============================================
  // Notification Scheduling (Task 9.1)
  // ============================================

  /**
   * Request notification permissions from the user
   * 
   * @returns true if permission granted, false otherwise
   * 
   * Requirements: 6.1
   */
  async requestNotificationPermission(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notification Permission Required',
        'To receive workout reminders, please enable notifications in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
    return true;
  }

  /**
   * Schedule a local notification 30 minutes before a workout
   * 
   * @param workout - The scheduled workout to create notification for
   * @returns The notification identifier, or null if scheduling failed
   * 
   * Requirements: 6.1, 6.2
   */
  async scheduleWorkoutNotification(workout: ScheduledWorkout): Promise<string | null> {
    try {
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) return null;

      // Parse scheduled date and time
      const [year, month, day] = workout.scheduledDate.split('-').map(Number);
      const [hours, minutes] = workout.scheduledTime.split(':').map(Number);
      
      // Create workout start time
      const workoutStartTime = new Date(year, month - 1, day, hours, minutes);
      
      // Calculate notification time (30 minutes before)
      const notificationTime = new Date(workoutStartTime.getTime() - 30 * 60 * 1000);
      
      // Don't schedule if notification time is in the past
      if (notificationTime <= new Date()) {
        console.log('WorkoutCalendarService: Notification time is in the past, skipping');
        return null;
      }

      // Format focus areas for notification body
      const focusAreasText = workout.focusAreas.join(', ');

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🏋️ Workout Reminder: ${workout.templateName}`,
          body: `Your workout starts in 30 minutes!\nFocus Areas: ${focusAreasText}`,
          data: { 
            workoutId: workout.id,
            type: 'workout_reminder'
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationTime,
        },
      });

      console.log('WorkoutCalendarService: Notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('WorkoutCalendarService: Failed to schedule notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   * 
   * @param notificationId - The ID of the notification to cancel
   * @returns true if cancellation successful, false otherwise
   * 
   * Requirements: 6.1
   */
  async cancelWorkoutNotification(notificationId: string): Promise<boolean> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('WorkoutCalendarService: Notification cancelled:', notificationId);
      return true;
    } catch (error) {
      console.error('WorkoutCalendarService: Failed to cancel notification:', error);
      return false;
    }
  }

  /**
   * Update a scheduled notification (cancel old and create new)
   * 
   * @param oldNotificationId - The ID of the existing notification to cancel
   * @param workout - The updated workout data
   * @returns The new notification ID, or null if update failed
   * 
   * Requirements: 6.1, 6.2
   */
  async updateWorkoutNotification(
    oldNotificationId: string | undefined,
    workout: ScheduledWorkout
  ): Promise<string | null> {
    // Cancel old notification if it exists
    if (oldNotificationId) {
      await this.cancelWorkoutNotification(oldNotificationId);
    }
    
    // Schedule new notification
    return await this.scheduleWorkoutNotification(workout);
  }

  /**
   * Build notification content for a scheduled workout
   * Utility function for testing and external use
   * 
   * @param workout - The scheduled workout
   * @returns Object with title and body for the notification
   * 
   * Requirements: 6.1, 6.2
   */
  buildNotificationContent(workout: ScheduledWorkout): { title: string; body: string } {
    const focusAreasText = workout.focusAreas.join(', ');
    return {
      title: `🏋️ Workout Reminder: ${workout.templateName}`,
      body: `Your workout starts in 30 minutes!\nFocus Areas: ${focusAreasText}`,
    };
  }

  // ============================================
  // Conflict Detection (Task 2.6)
  // ============================================

  /**
   * Check for scheduling conflicts on a given date and time
   * Checks against both scheduled matches and existing scheduled workouts
   * 
   * @param date - The date to check (YYYY-MM-DD)
   * @param time - The time to check (HH:mm)
   * @returns ConflictResult indicating if there's a conflict
   * 
   * Requirements: 1.5, 4.4
   */
  async checkConflicts(date: string, time: string): Promise<ConflictResult> {
    // Check for match conflicts
    try {
      const scheduledMatchesData = await AsyncStorage.getItem(SCHEDULED_MATCHES_KEY);
      if (scheduledMatchesData) {
        const matches = JSON.parse(scheduledMatchesData);
        const matchOnDate = matches.find((match: any) => {
          const matchDate = (match.matchStartTime || match.scheduledAt)?.split('T')[0];
          return matchDate === date;
        });
        
        if (matchOnDate) {
          return {
            hasConflict: true,
            conflictType: 'match',
            conflictDetails: `Match scheduled: ${matchOnDate.teamNames?.team1 || 'Team A'} vs ${matchOnDate.teamNames?.team2 || 'Team B'}`
          };
        }
      }
    } catch (error) {
      console.error('WorkoutCalendarService: Error checking match conflicts:', error);
    }

    // Check for existing workout conflicts
    const scheduledWorkouts = await this.getScheduledWorkouts();
    const workoutOnDateTime = scheduledWorkouts.find(w => 
      w.scheduledDate === date && w.scheduledTime === time
    );
    
    if (workoutOnDateTime) {
      return {
        hasConflict: true,
        conflictType: 'workout',
        conflictDetails: `Workout already scheduled: ${workoutOnDateTime.templateName}`
      };
    }

    return { hasConflict: false };
  }

  // ============================================
  // Recurring Schedule Generation (Task 2.8)
  // ============================================

  /**
   * Generate recurring workout entries based on a weekly pattern
   * 
   * @param pattern - The recurring pattern (weekly with specific days)
   * @param baseWorkout - The base workout to use as template
   * @param weeks - Number of weeks to generate (default: 4)
   * @returns Array of generated ScheduledWorkout objects
   * 
   * Requirements: 7.2, 7.3
   */
  generateRecurringWorkouts(
    pattern: RecurringPattern,
    baseWorkout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt' | 'scheduledDate'>,
    weeks: number = 4
  ): Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'>[] {
    const workouts: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const seriesId = generateId('series');
    
    // Start from today
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    // Calculate end date (weeks from now)
    const endDate = pattern.endDate 
      ? new Date(pattern.endDate) 
      : new Date(startDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    // Iterate through each day from start to end
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, etc.
      
      if (pattern.daysOfWeek.includes(dayOfWeek)) {
        const dateStr = formatDateToLocalString(currentDate);
        
        workouts.push({
          ...baseWorkout,
          scheduledDate: dateStr,
          isRecurring: true,
          recurringPattern: pattern,
          recurringSeriesId: seriesId,
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workouts;
  }

  /**
   * Create a recurring workout series
   * Generates and persists all workout entries for the series
   * 
   * @param pattern - The recurring pattern
   * @param baseWorkout - The base workout template
   * @param weeks - Number of weeks to generate
   * @returns Array of created ScheduledWorkout objects
   * 
   * Requirements: 7.2, 7.3
   */
  async createRecurringSeries(
    pattern: RecurringPattern,
    baseWorkout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt' | 'scheduledDate'>,
    weeks: number = 4
  ): Promise<ScheduledWorkout[]> {
    const workoutsToCreate = this.generateRecurringWorkouts(pattern, baseWorkout, weeks);
    const createdWorkouts: ScheduledWorkout[] = [];

    for (const workout of workoutsToCreate) {
      const created = await this.scheduleWorkout(workout);
      createdWorkouts.push(created);
    }

    return createdWorkouts;
  }

  /**
   * Delete all workouts in a recurring series
   * 
   * @param seriesId - The recurring series ID
   * 
   * Requirements: 7.5
   */
  async deleteRecurringSeries(seriesId: string): Promise<void> {
    const allWorkouts = await this.getScheduledWorkouts();
    
    // Filter out workouts that belong to the series
    const remainingWorkouts = allWorkouts.filter(
      w => w.recurringSeriesId !== seriesId
    );

    // Also remove calendar events and notifications for deleted workouts
    const deletedWorkouts = allWorkouts.filter(
      w => w.recurringSeriesId === seriesId
    );
    
    for (const workout of deletedWorkouts) {
      if (workout.calendarEventId) {
        await this.removeFromDeviceCalendar(workout.calendarEventId);
      }
      if (workout.notificationId) {
        await this.cancelWorkoutNotification(workout.notificationId);
      }
    }

    await AsyncStorage.setItem(
      SCHEDULED_WORKOUTS_KEY, 
      JSON.stringify(remainingWorkouts)
    );
  }

  // ============================================
  // Past Workout Cleanup (Task 2.13)
  // ============================================

  /**
   * Clean up past scheduled workouts that were not completed
   * Should be called on app load
   * 
   * @returns Number of workouts cleaned up
   * 
   * Requirements: 8.5
   */
  async cleanupPastWorkouts(): Promise<number> {
    const allWorkouts = await this.getScheduledWorkouts();
    const today = formatDateToLocalString(new Date());
    
    // Filter to keep only future workouts (including today)
    const futureWorkouts = allWorkouts.filter(
      workout => workout.scheduledDate >= today
    );

    const cleanedCount = allWorkouts.length - futureWorkouts.length;

    if (cleanedCount > 0) {
      await AsyncStorage.setItem(
        SCHEDULED_WORKOUTS_KEY, 
        JSON.stringify(futureWorkouts)
      );
      console.log(`WorkoutCalendarService: Cleaned up ${cleanedCount} past workouts`);
    }

    return cleanedCount;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Schedule a workout and sync to device calendar
   * Convenience method that combines scheduling and calendar sync
   * 
   * @param workout - The workout data to schedule
   * @param syncToCalendar - Whether to sync to device calendar (default: true)
   * @returns The created ScheduledWorkout
   */
  async scheduleWorkoutWithCalendarSync(
    workout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt' | 'calendarEventId' | 'notificationId'>,
    syncToCalendar: boolean = true
  ): Promise<ScheduledWorkout> {
    // First create the scheduled workout
    const scheduledWorkout = await this.scheduleWorkout(workout);
    let updatedWorkout = scheduledWorkout;

    // Sync to device calendar if requested
    if (syncToCalendar) {
      const calendarEventId = await this.syncToDeviceCalendar(scheduledWorkout);
      
      if (calendarEventId) {
        updatedWorkout = await this.updateScheduledWorkout(scheduledWorkout.id, {
          calendarEventId
        });
      }
    }

    // Schedule notification 30 minutes before workout
    const notificationId = await this.scheduleWorkoutNotification(updatedWorkout);
    if (notificationId) {
      updatedWorkout = await this.updateScheduledWorkout(updatedWorkout.id, {
        notificationId
      });
    }

    return updatedWorkout;
  }

  /**
   * Delete a scheduled workout and remove from device calendar
   * Convenience method that combines deletion and calendar removal
   * 
   * @param id - The ID of the workout to delete
   */
  async deleteScheduledWorkoutWithCalendarSync(id: string): Promise<void> {
    const workout = await this.getScheduledWorkoutById(id);
    
    if (workout?.calendarEventId) {
      await this.removeFromDeviceCalendar(workout.calendarEventId);
    }

    // Cancel notification if it exists
    if (workout?.notificationId) {
      await this.cancelWorkoutNotification(workout.notificationId);
    }

    await this.deleteScheduledWorkout(id);
  }

  /**
   * Get workouts scheduled for a specific date
   * 
   * @param date - The date to check (YYYY-MM-DD)
   * @returns Array of workouts scheduled for that date
   */
  async getWorkoutsForDate(date: string): Promise<ScheduledWorkout[]> {
    const allWorkouts = await this.getScheduledWorkouts();
    return allWorkouts.filter(w => w.scheduledDate === date);
  }
}

// Export singleton instance
export const workoutCalendarService = new WorkoutCalendarService();

// Export class for testing purposes
export { WorkoutCalendarService };

// Export utility functions for testing
export { generateId };
