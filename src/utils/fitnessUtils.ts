/**
 * Fitness Utility Functions
 * 
 * Utility functions for the Gym Diary & Fitness Tracker module.
 * Includes day indicator colors, calendar data merging, date formatting, UUID generation,
 * and set management functions.
 */

import type { WorkoutStorage, ExerciseLog, ExerciseSet } from '../types/fitness';
import type { ScheduledMatch } from '../types/Match';

/**
 * Day indicator colors for the weekly view
 * - Blue: Match day
 * - Orange: Gym day
 * - Grey: Rest day
 */
export const DAY_INDICATOR_COLORS = {
  MATCH: '#3B82F6',   // Blue
  GYM: '#F97316',     // Orange
  REST: '#9CA3AF',    // Grey
} as const;

export type DayIndicatorColor = typeof DAY_INDICATOR_COLORS[keyof typeof DAY_INDICATOR_COLORS];

/**
 * Calendar dot data structure for merged calendar view
 */
export interface CalendarDot {
  date: string;
  color: DayIndicatorColor;
  type: 'match' | 'gym' | 'rest';
}

/**
 * Merged calendar data structure
 */
export interface MergedCalendarData {
  [date: string]: CalendarDot;
}

/**
 * Get the indicator color for a specific date based on scheduled activities
 * 
 * Priority: Match (blue) > Gym (orange) > Rest (grey)
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @param matches - Array of scheduled matches
 * @param workouts - Workout storage object
 * @returns The appropriate indicator color
 * 
 * Requirements: 4.2, 4.3, 4.4
 */
export function getDayIndicatorColor(
  date: string,
  matches: ScheduledMatch[],
  workouts: WorkoutStorage
): DayIndicatorColor {
  // Check if there's a match on this date (highest priority)
  // Use matchStartTime (actual match date) instead of scheduledAt (when user added it)
  const hasMatch = matches.some(match => {
    const matchDate = (match.matchStartTime || match.scheduledAt).split('T')[0];
    return matchDate === date;
  });

  if (hasMatch) {
    return DAY_INDICATOR_COLORS.MATCH;
  }

  // Check if there's a gym workout on this date
  const workout = workouts[date];
  if (workout && workout.type === 'GYM' && !workout.isRestDay) {
    return DAY_INDICATOR_COLORS.GYM;
  }

  // Default to rest day
  return DAY_INDICATOR_COLORS.REST;
}

/**
 * Merge scheduled matches and workout data into a unified calendar data structure
 * 
 * Creates a map of dates to calendar dots with appropriate colors:
 * - Blue dots for match days
 * - Orange dots for gym days
 * 
 * @param matches - Array of scheduled matches
 * @param workouts - Workout storage object
 * @param startDate - Start date for the range (YYYY-MM-DD)
 * @param endDate - End date for the range (YYYY-MM-DD)
 * @returns Merged calendar data with dots for each date
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
export function mergeCalendarData(
  matches: ScheduledMatch[],
  workouts: WorkoutStorage,
  startDate?: string,
  endDate?: string
): MergedCalendarData {
  const mergedData: MergedCalendarData = {};

  // Add match dates (blue dots)
  // Use matchStartTime (actual match date) instead of scheduledAt (when user added it)
  for (const match of matches) {
    const matchDate = (match.matchStartTime || match.scheduledAt).split('T')[0];
    
    // Skip if outside date range (if specified)
    if (startDate && matchDate < startDate) continue;
    if (endDate && matchDate > endDate) continue;

    mergedData[matchDate] = {
      date: matchDate,
      color: DAY_INDICATOR_COLORS.MATCH,
      type: 'match',
    };
  }

  // Add workout dates (orange dots for gym days)
  // Note: Match days take priority, so we don't overwrite existing match entries
  for (const [date, workout] of Object.entries(workouts)) {
    // Skip if outside date range (if specified)
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    // Only add if not already a match day and it's a gym workout
    if (!mergedData[date] && workout.type === 'GYM' && !workout.isRestDay) {
      mergedData[date] = {
        date,
        color: DAY_INDICATOR_COLORS.GYM,
        type: 'gym',
      };
    }
  }

  return mergedData;
}

/**
 * Format a workout date for display
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @param format - Display format ('short' | 'long' | 'relative')
 * @returns Formatted date string
 * 
 * Requirements: 4.2, 4.3, 4.4
 */
export function formatWorkoutDate(
  date: string,
  format: 'short' | 'long' | 'relative' = 'short'
): string {
  const dateObj = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (format === 'relative') {
    const dateTime = dateObj.getTime();
    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();
    const yesterdayTime = yesterday.getTime();

    if (dateTime === todayTime) {
      return 'Today';
    }
    if (dateTime === tomorrowTime) {
      return 'Tomorrow';
    }
    if (dateTime === yesterdayTime) {
      return 'Yesterday';
    }
  }

  if (format === 'short') {
    // Format: "Mon, Jan 2"
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  // Long format: "Monday, January 2, 2025"
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generate a UUID v4 for creating unique IDs
 * 
 * Uses crypto.randomUUID if available, otherwise falls back to a manual implementation
 * 
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
  // Try to use crypto.randomUUID if available (React Native with Hermes)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback implementation for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the day of week abbreviation for a date
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns Day abbreviation (e.g., "Mon", "Tue")
 */
export function getDayAbbreviation(date: string): string {
  const dateObj = new Date(date + 'T00:00:00');
  return dateObj.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Get the day number for a date
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns Day number (1-31)
 */
export function getDayNumber(date: string): number {
  const dateObj = new Date(date + 'T00:00:00');
  return dateObj.getDate();
}

/**
 * Check if a date is today
 * 
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns true if the date is today
 */
export function isToday(date: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return date === today;
}

/**
 * Get an array of dates for a week starting from a given date
 * 
 * @param startDate - ISO date string (YYYY-MM-DD) for the start of the week
 * @param numDays - Number of days to include (default: 7)
 * @returns Array of ISO date strings
 */
export function getWeekDates(startDate: string, numDays: number = 7): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');

  for (let i = 0; i < numDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Get the start of the current week (Monday)
 * 
 * @returns ISO date string (YYYY-MM-DD) for Monday of the current week
 */
export function getWeekStartDate(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // Adjust so Monday is 0, Sunday is 6
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  
  return monday.toISOString().split('T')[0];
}


// ============================================================================
// Set Management Functions
// ============================================================================

/**
 * Default values for a new exercise set
 */
export const DEFAULT_SET_VALUES = {
  weight: 0,
  reps: 10,
  completed: false,
} as const;

/**
 * Add a new set to an exercise with default values
 * 
 * Creates a new ExerciseSet with a unique ID and default weight/reps values,
 * then returns a new ExerciseLog with the set appended to the sets array.
 * 
 * @param exercise - The exercise to add a set to
 * @param defaults - Optional custom default values for the new set
 * @returns A new ExerciseLog with the added set
 * 
 * Requirements: 3.2
 */
export function addSetToExercise(
  exercise: ExerciseLog,
  defaults?: Partial<Pick<ExerciseSet, 'weight' | 'reps'>>
): ExerciseLog {
  const newSet: ExerciseSet = {
    id: generateUUID(),
    weight: defaults?.weight ?? DEFAULT_SET_VALUES.weight,
    reps: defaults?.reps ?? DEFAULT_SET_VALUES.reps,
    completed: DEFAULT_SET_VALUES.completed,
  };

  return {
    ...exercise,
    sets: [...exercise.sets, newSet],
  };
}

/**
 * Remove a set from an exercise by its ID
 * 
 * Returns a new ExerciseLog with the specified set removed from the sets array.
 * If the set ID is not found, returns the original exercise unchanged.
 * 
 * @param exercise - The exercise to remove a set from
 * @param setId - The ID of the set to remove
 * @returns A new ExerciseLog with the set removed
 * 
 * Requirements: 3.3
 */
export function removeSetFromExercise(
  exercise: ExerciseLog,
  setId: string
): ExerciseLog {
  const filteredSets = exercise.sets.filter(set => set.id !== setId);
  
  // If no set was removed, return original exercise
  if (filteredSets.length === exercise.sets.length) {
    return exercise;
  }

  return {
    ...exercise,
    sets: filteredSets,
  };
}

/**
 * Update a set's weight and/or reps values
 * 
 * Returns a new ExerciseLog with the specified set's values updated.
 * If the set ID is not found, returns the original exercise unchanged.
 * 
 * @param exercise - The exercise containing the set to update
 * @param setId - The ID of the set to update
 * @param updates - The values to update (weight and/or reps)
 * @returns A new ExerciseLog with the updated set
 * 
 * Requirements: 3.4
 */
export function updateSet(
  exercise: ExerciseLog,
  setId: string,
  updates: Partial<Pick<ExerciseSet, 'weight' | 'reps'>>
): ExerciseLog {
  const setIndex = exercise.sets.findIndex(set => set.id === setId);
  
  // If set not found, return original exercise
  if (setIndex === -1) {
    return exercise;
  }

  const updatedSets = [...exercise.sets];
  updatedSets[setIndex] = {
    ...updatedSets[setIndex],
    ...updates,
  };

  return {
    ...exercise,
    sets: updatedSets,
  };
}

/**
 * Toggle the completion status of a set
 * 
 * Flips the completed boolean value (true→false or false→true).
 * Returns a new ExerciseLog with the toggled set.
 * If the set ID is not found, returns the original exercise unchanged.
 * 
 * @param exercise - The exercise containing the set to toggle
 * @param setId - The ID of the set to toggle
 * @returns A new ExerciseLog with the toggled set
 * 
 * Requirements: 3.5
 */
export function toggleSetCompletion(
  exercise: ExerciseLog,
  setId: string
): ExerciseLog {
  const setIndex = exercise.sets.findIndex(set => set.id === setId);
  
  // If set not found, return original exercise
  if (setIndex === -1) {
    return exercise;
  }

  const updatedSets = [...exercise.sets];
  updatedSets[setIndex] = {
    ...updatedSets[setIndex],
    completed: !updatedSets[setIndex].completed,
  };

  return {
    ...exercise,
    sets: updatedSets,
  };
}
