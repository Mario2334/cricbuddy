/**
 * Template Service Module
 * 
 * This module provides methods to access preloaded workout templates
 * and convert them to DailyWorkout records for the fitness tracker.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 5.4
 */

import { WORKOUT_TEMPLATES } from '../data/workoutTemplates';
import type {
  WorkoutTemplate,
  MuscleGroupCategory,
  DailyWorkout,
  ExerciseLog,
  ExerciseSet,
  ExerciseDefinition,
} from '../types/fitness';

/**
 * Generate a unique ID using timestamp and random string
 * @returns A unique string identifier
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert an ExerciseDefinition to an ExerciseLog with empty sets
 * @param exercise - The exercise definition from the template
 * @returns An ExerciseLog with sets pre-populated from template defaults
 */
function convertExerciseToLog(exercise: ExerciseDefinition): ExerciseLog {
  const sets: ExerciseSet[] = [];
  
  for (let i = 0; i < exercise.defaultSets; i++) {
    sets.push({
      id: generateId(),
      weight: exercise.defaultWeight?.[i] ?? 0,
      reps: exercise.defaultReps?.[i] ?? 10,
      completed: false,
    });
  }

  return {
    id: generateId(),
    exerciseName: exercise.name,
    targetGroup: exercise.targetGroup,
    sets,
  };
}

/**
 * TemplateService class handles workout template operations
 */
class TemplateService {
  /**
   * Get all available workout templates
   * Templates are loaded synchronously from static data
   * 
   * @returns Array of all preloaded WorkoutTemplate objects
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3
   */
  getAllTemplates(): WorkoutTemplate[] {
    return WORKOUT_TEMPLATES;
  }

  /**
   * Get templates filtered by muscle group category
   * 
   * @param category - The muscle group category to filter by
   * @returns Array of WorkoutTemplate objects matching the category
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  getTemplatesByCategory(category: MuscleGroupCategory): WorkoutTemplate[] {
    return WORKOUT_TEMPLATES.filter(template => template.category === category);
  }

  /**
   * Get a single template by its ID
   * 
   * @param id - The unique template identifier
   * @returns The WorkoutTemplate or undefined if not found
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  getTemplateById(id: string): WorkoutTemplate | undefined {
    return WORKOUT_TEMPLATES.find(template => template.id === id);
  }

  /**
   * Convert a workout template to a DailyWorkout
   * Generates unique IDs for workout and exercises, creates sets with default reps
   * 
   * @param template - The template to convert
   * @param date - Optional date for the workout (defaults to today in YYYY-MM-DD format)
   * @returns A new DailyWorkout populated from the template
   * 
   * Requirements: 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 5.4
   */
  createWorkoutFromTemplate(template: WorkoutTemplate, date?: string): DailyWorkout {
    const workoutDate = date ?? new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Convert all exercises from template to ExerciseLog format
    const exercises: ExerciseLog[] = template.exercises.map(convertExerciseToLog);

    return {
      id: generateId(),
      date: workoutDate,
      type: 'GYM',
      focusAreas: [...template.focusAreas],
      exercises,
      isRestDay: false,
      createdAt: now,
      updatedAt: now,
    };
  }
}

// Export singleton instance
export const templateService = new TemplateService();

// Export class for testing purposes
export { TemplateService };

// Export utility functions for testing
export { generateId, convertExerciseToLog };
