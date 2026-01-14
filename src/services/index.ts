/**
 * Services Index
 * 
 * Central export point for all service modules.
 * This allows for cleaner imports throughout the application.
 */

// Workout Calendar Service - handles scheduled workout management and device calendar sync
export { workoutCalendarService, WorkoutCalendarService } from './workoutCalendarService';

// Fitness Service - handles workout persistence and retrieval
export { fitnessService } from './fitnessService';

// Template Service - provides preloaded workout templates
export { templateService } from './templateService';

// Health Kit Service - handles Apple HealthKit integration
export { healthKitService } from './healthKitService';

// Watch Connectivity Service - handles Apple Watch communication
export { watchConnectivityService } from './watchConnectivityService';

// Background Workout Service - handles background workout tracking
export { backgroundWorkoutService } from './backgroundWorkoutService';

// Workout Notification Service - handles workout notifications
export { workoutNotificationService } from './workoutNotificationService';

// Timer Manager - handles workout timer functionality
export { timerManager } from './timerManager';

// Audio Feedback Manager - handles audio cues during workouts
export { audioFeedbackManager } from './audioFeedbackManager';

// Haptic Feedback Manager - handles haptic feedback during workouts
export { hapticFeedbackManager } from './hapticFeedbackManager';

// Visual Feedback Manager - handles visual feedback during workouts
export { visualFeedbackManager } from './visualFeedbackManager';

// Workout Session Manager - handles active workout session state
export { workoutSessionManager } from './workoutSessionManager';

// Interactive Workout Session - handles interactive workout flow
export { interactiveWorkoutSession } from './interactiveWorkoutSession';
