/**
 * Property-Based Tests for Workout Notification Content
 * 
 * Feature: workout-calendar-scheduling
 * Property 10: Notification Content Completeness
 * 
 * Tests that notification content includes workout name and focus areas
 * 
 * **Validates: Requirements 6.1, 6.2**
 */

import * as fc from 'fast-check';
import type { ScheduledWorkout, MuscleGroup } from '../../types/fitness';

// Mock expo-calendar
jest.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCalendarsAsync: jest.fn().mockResolvedValue([]),
  createEventAsync: jest.fn().mockResolvedValue('mock-event-id'),
  deleteEventAsync: jest.fn().mockResolvedValue(undefined),
  updateEventAsync: jest.fn().mockResolvedValue(undefined),
  EntityTypes: { EVENT: 'event' },
  AlarmMethod: { ALERT: 'alert' },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

// Mock react-native
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
}));

// Import after mocks
import { WorkoutCalendarService } from '../workoutCalendarService';

// ============================================
// Test Data Generators (Arbitraries)
// ============================================

const muscleGroupArb = fc.constantFrom<MuscleGroup>(
  'LEGS', 'SHOULDERS', 'CHEST', 'TRICEPS', 'BACK', 'BICEPS', 'CORE', 'CARDIO'
);

// Generate valid ISO date strings (YYYY-MM-DD) for future dates
const futureDateStringArb = fc.integer({ min: 2026, max: 2030 }).chain(year =>
  fc.integer({ min: 1, max: 12 }).chain(month =>
    fc.integer({ min: 1, max: 28 }).map(day => 
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    )
  )
);

// Generate valid time strings (HH:mm)
const timeStringArb = fc.integer({ min: 5, max: 22 }).chain(hour =>
  fc.integer({ min: 0, max: 59 }).map(minute =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  )
);

// Generate valid ISO datetime strings
const dateTimeArb = futureDateStringArb.map(date => `${date}T12:00:00.000Z`);

// Generate a valid workout template name (non-empty, reasonable length)
const templateNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

// Generate a valid ScheduledWorkout
const scheduledWorkoutArb: fc.Arbitrary<ScheduledWorkout> = fc.record({
  id: fc.uuid().map(id => `sw_${id}`),
  templateId: fc.option(fc.uuid(), { nil: undefined }),
  templateName: templateNameArb,
  focusAreas: fc.array(muscleGroupArb, { minLength: 1, maxLength: 4 }),
  scheduledDate: futureDateStringArb,
  scheduledTime: timeStringArb,
  durationMinutes: fc.integer({ min: 30, max: 180 }),
  calendarEventId: fc.option(fc.uuid(), { nil: undefined }),
  notificationId: fc.option(fc.uuid(), { nil: undefined }),
  isRecurring: fc.boolean(),
  recurringPattern: fc.constant(undefined),
  recurringSeriesId: fc.option(fc.uuid(), { nil: undefined }),
  createdAt: dateTimeArb,
  updatedAt: dateTimeArb,
});

// ============================================
// Test Setup
// ============================================

describe('Workout Notification Content - Property Tests', () => {
  let service: WorkoutCalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkoutCalendarService();
  });

  // ============================================
  // Property 10: Notification Content Completeness
  // ============================================
  describe('Property 10: Notification Content Completeness', () => {
    /**
     * Feature: workout-calendar-scheduling, Property 10: Notification Content Completeness
     * 
     * *For any* scheduled workout notification, the notification content 
     * should include the workout name and focus areas.
     * 
     * **Validates: Requirements 6.1, 6.2**
     */
    it('notification content should include workout name', () => {
      fc.assert(
        fc.property(
          scheduledWorkoutArb,
          (workout) => {
            // Execute: Build notification content
            const content = service.buildNotificationContent(workout);

            // Verify: Title should contain the workout template name
            expect(content.title).toContain(workout.templateName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notification content should include all focus areas', () => {
      fc.assert(
        fc.property(
          scheduledWorkoutArb,
          (workout) => {
            // Execute: Build notification content
            const content = service.buildNotificationContent(workout);

            // Verify: Body should contain all focus areas
            workout.focusAreas.forEach(focusArea => {
              expect(content.body).toContain(focusArea);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notification title should have workout reminder prefix', () => {
      fc.assert(
        fc.property(
          scheduledWorkoutArb,
          (workout) => {
            // Execute: Build notification content
            const content = service.buildNotificationContent(workout);

            // Verify: Title should have the workout reminder emoji and prefix
            expect(content.title).toMatch(/^🏋️ Workout Reminder:/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notification body should mention 30 minutes timing', () => {
      fc.assert(
        fc.property(
          scheduledWorkoutArb,
          (workout) => {
            // Execute: Build notification content
            const content = service.buildNotificationContent(workout);

            // Verify: Body should mention the 30-minute reminder timing
            expect(content.body).toContain('30 minutes');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('notification content should be non-empty strings', () => {
      fc.assert(
        fc.property(
          scheduledWorkoutArb,
          (workout) => {
            // Execute: Build notification content
            const content = service.buildNotificationContent(workout);

            // Verify: Both title and body should be non-empty strings
            expect(typeof content.title).toBe('string');
            expect(typeof content.body).toBe('string');
            expect(content.title.length).toBeGreaterThan(0);
            expect(content.body.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
