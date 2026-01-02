/**
 * Fitness Service Module
 * 
 * This module provides methods to persist and retrieve workout data
 * from AsyncStorage for the Gym Diary & Fitness Tracker feature.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyWorkout, WorkoutStorage, MuscleGroup, ExerciseLog } from '../types/fitness';
import type { ScheduledMatch } from '../types/Match';

// Storage key for gym diary logs
const STORAGE_KEY = '@gym_diary_logs';
// Storage key for scheduled matches (used by existing match scheduling feature)
const SCHEDULED_MATCHES_KEY = 'scheduledMatches';

/**
 * FitnessService class handles all workout data persistence operations
 */
class FitnessService {
  /**
   * Save a workout to AsyncStorage
   * Persists DailyWorkout record using ISO date string as key
   * 
   * @param workout - The DailyWorkout to save
   * @throws Error if AsyncStorage write fails
   * 
   * Requirements: 1.1, 1.2, 1.3
   */
  async saveWorkout(workout: DailyWorkout): Promise<void> {
    try {
      // Get existing workout history
      const history = await this.getWorkoutHistory();
      
      // Update the workout's updatedAt timestamp
      const workoutToSave: DailyWorkout = {
        ...workout,
        updatedAt: new Date().toISOString(),
      };
      
      // Add/update the workout using date as key (YYYY-MM-DD format)
      history[workout.date] = workoutToSave;
      
      // Persist to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('FitnessService: Failed to save workout:', error);
      throw error;
    }
  }

  /**
   * Retrieve a single workout by date
   * 
   * @param date - ISO date string (YYYY-MM-DD)
   * @returns The DailyWorkout for the given date, or null if not found
   * 
   * Requirements: 1.2, 1.4
   */
  async getWorkoutByDate(date: string): Promise<DailyWorkout | null> {
    try {
      const history = await this.getWorkoutHistory();
      return history[date] || null;
    } catch (error) {
      console.error('FitnessService: Failed to get workout by date:', error);
      return null;
    }
  }

  /**
   * Retrieve all workout history from AsyncStorage
   * 
   * @returns Object map of date strings to DailyWorkout records
   * 
   * Requirements: 1.4, 1.5
   */
  async getWorkoutHistory(): Promise<WorkoutStorage> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (!data) {
        return {};
      }
      
      return JSON.parse(data) as WorkoutStorage;
    } catch (error) {
      // If AsyncStorage read fails, return empty history and log error
      // Requirements: 1.5
      console.error('FitnessService: Failed to retrieve workout history:', error);
      return {};
    }
  }

  /**
   * Delete a workout by date
   * 
   * @param date - ISO date string (YYYY-MM-DD) of the workout to delete
   * @throws Error if AsyncStorage write fails
   * 
   * Requirements: 1.1
   */
  async deleteWorkout(date: string): Promise<void> {
    try {
      const history = await this.getWorkoutHistory();
      
      // Remove the workout for the given date
      delete history[date];
      
      // Persist updated history to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('FitnessService: Failed to delete workout:', error);
      throw error;
    }
  }

  // ============================================
  // Conflict Detection Methods
  // ============================================

  /**
   * Fetch scheduled matches from AsyncStorage
   * 
   * @returns Array of ScheduledMatch objects
   * 
   * Requirements: 5.4
   */
  async getScheduledMatches(): Promise<ScheduledMatch[]> {
    try {
      const data = await AsyncStorage.getItem(SCHEDULED_MATCHES_KEY);
      
      if (!data) {
        return [];
      }
      
      return JSON.parse(data) as ScheduledMatch[];
    } catch (error) {
      console.error('FitnessService: Failed to retrieve scheduled matches:', error);
      return [];
    }
  }

  /**
   * Check if scheduling a leg day workout on a given date conflicts with a match the next day
   * 
   * @param date - ISO date string (YYYY-MM-DD) of the planned workout
   * @param focusAreas - Array of muscle groups for the workout
   * @returns true if there's a conflict (leg day before match), false otherwise
   * 
   * Requirements: 5.1, 5.2
   */
  async checkLegDayConflict(date: string, focusAreas: MuscleGroup[]): Promise<boolean> {
    // Check if LEGS is in the focus areas
    if (!focusAreas.includes('LEGS')) {
      return false;
    }

    // Calculate the next day's date
    const workoutDate = new Date(date);
    workoutDate.setDate(workoutDate.getDate() + 1);
    const nextDayStr = workoutDate.toISOString().split('T')[0];

    // Get scheduled matches
    const matches = await this.getScheduledMatches();

    // Check if any match is scheduled for the next day
    return matches.some(match => {
      // Extract date from scheduledAt (could be ISO string or date string)
      const matchDate = match.scheduledAt.split('T')[0];
      return matchDate === nextDayStr;
    });
  }

  // ============================================
  // Analytics Methods
  // ============================================

  /**
   * Get all exercise logs for a specific exercise name across all workouts
   * 
   * @param exerciseName - Name of the exercise to search for
   * @returns Array of ExerciseLog objects with their workout dates, ordered chronologically
   * 
   * Requirements: 10.1, 10.2
   */
  async getExerciseHistory(exerciseName: string): Promise<Array<ExerciseLog & { workoutDate: string }>> {
    const history = await this.getWorkoutHistory();
    const exerciseLogs: Array<ExerciseLog & { workoutDate: string }> = [];

    // Iterate through all workouts and collect matching exercise logs
    for (const [date, workout] of Object.entries(history)) {
      for (const exercise of workout.exercises) {
        if (exercise.exerciseName === exerciseName) {
          exerciseLogs.push({
            ...exercise,
            workoutDate: date,
          });
        }
      }
    }

    // Sort chronologically by workout date
    exerciseLogs.sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));

    return exerciseLogs;
  }

  /**
   * Get the personal record (maximum weight) for a specific exercise
   * 
   * @param exerciseName - Name of the exercise
   * @returns Maximum weight lifted for the exercise, or 0 if no history exists
   * 
   * Requirements: 10.3
   */
  async getPersonalRecord(exerciseName: string): Promise<number> {
    const exerciseHistory = await this.getExerciseHistory(exerciseName);

    if (exerciseHistory.length === 0) {
      return 0;
    }

    // Find the maximum weight across all sets of all exercise logs
    let maxWeight = 0;
    for (const log of exerciseHistory) {
      for (const set of log.sets) {
        if (set.weight > maxWeight) {
          maxWeight = set.weight;
        }
      }
    }

    return maxWeight;
  }

  /**
   * Get the next scheduled gym session (workout with earliest date >= today)
   * 
   * @returns The next DailyWorkout, or null if none scheduled
   * 
   * Requirements: 8.2
   */
  async getNextGymSession(): Promise<DailyWorkout | null> {
    const history = await this.getWorkoutHistory();
    const today = new Date().toISOString().split('T')[0];

    // Filter workouts that are gym sessions and >= today
    const futureWorkouts = Object.entries(history)
      .filter(([date, workout]) => {
        return date >= today && workout.type === 'GYM' && !workout.isRestDay;
      })
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

    if (futureWorkouts.length === 0) {
      return null;
    }

    // Return the earliest future workout
    return futureWorkouts[0][1];
  }
}

// Export singleton instance
export const fitnessService = new FitnessService();

// Export class for testing purposes
export { FitnessService };
