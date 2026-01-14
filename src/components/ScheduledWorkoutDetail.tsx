/**
 * ScheduledWorkoutDetail Component
 * 
 * A component for viewing and managing scheduled workout details.
 * Displays workout information and provides edit, delete, and start workout actions.
 * 
 * Requirements: 5.1, 5.2, 5.5
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScheduledWorkout, MuscleGroup } from '../types/fitness';

interface ScheduledWorkoutDetailProps {
  workout: ScheduledWorkout;
  onEdit: () => void;
  onDelete: () => void;
  onStartWorkout: () => void;
}

/**
 * Get color for muscle group badge
 */
function getMuscleGroupColor(group: MuscleGroup): string {
  const colors: Record<MuscleGroup, string> = {
    LEGS: '#8B5CF6',
    SHOULDERS: '#EC4899',
    CHEST: '#EF4444',
    TRICEPS: '#F97316',
    BACK: '#14B8A6',
    BICEPS: '#3B82F6',
    CORE: '#10B981',
    CARDIO: '#6366F1',
  };
  return colors[group] || '#6B7280';
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format time for display (24h to 12h format)
 */
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Check if workout is due (today or past)
 */
function isWorkoutDue(scheduledDate: string, scheduledTime: string): boolean {
  const now = new Date();
  const [year, month, day] = scheduledDate.split('-').map(Number);
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const workoutDateTime = new Date(year, month - 1, day, hours, minutes);
  
  // Workout is due if it's within 30 minutes before or after scheduled time
  const thirtyMinutes = 30 * 60 * 1000;
  const timeDiff = workoutDateTime.getTime() - now.getTime();
  
  return timeDiff <= thirtyMinutes;
}

/**
 * Get recurring pattern description
 */
function getRecurringDescription(workout: ScheduledWorkout): string | null {
  if (!workout.isRecurring || !workout.recurringPattern) {
    return null;
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = workout.recurringPattern.daysOfWeek
    .map(d => dayNames[d])
    .join(', ');
  
  return `Repeats weekly on ${days}`;
}

export const ScheduledWorkoutDetail: React.FC<ScheduledWorkoutDetailProps> = ({
  workout,
  onEdit,
  onDelete,
  onStartWorkout,
}) => {
  const isDue = useMemo(
    () => isWorkoutDue(workout.scheduledDate, workout.scheduledTime),
    [workout.scheduledDate, workout.scheduledTime]
  );

  const recurringDescription = useMemo(
    () => getRecurringDescription(workout),
    [workout]
  );

  /**
   * Handle delete with confirmation dialog
   * Requirements: 5.5
   */
  const handleDeletePress = () => {
    const message = workout.isRecurring
      ? 'Do you want to delete just this workout or the entire recurring series?'
      : 'Are you sure you want to delete this scheduled workout?';

    if (workout.isRecurring) {
      Alert.alert(
        'Delete Workout',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete This Only', 
            onPress: onDelete,
            style: 'destructive',
          },
          { 
            text: 'Delete Series', 
            onPress: onDelete,
            style: 'destructive',
          },
        ]
      );
    } else {
      Alert.alert(
        'Delete Workout',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            onPress: onDelete,
            style: 'destructive',
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with workout name */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="barbell" size={28} color="#3B82F6" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.workoutName}>{workout.templateName}</Text>
          {workout.isRecurring && (
            <View style={styles.recurringBadge}>
              <Ionicons name="repeat" size={12} color="#6366F1" />
              <Text style={styles.recurringBadgeText}>Recurring</Text>
            </View>
          )}
        </View>
      </View>

      {/* Focus Areas */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Focus Areas</Text>
        <View style={styles.focusAreasContainer}>
          {workout.focusAreas.map((area, index) => (
            <View
              key={index}
              style={[styles.focusAreaTag, { backgroundColor: getMuscleGroupColor(area) }]}
            >
              <Text style={styles.focusAreaText}>{area}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Date and Time */}
      <View style={styles.section}>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeItem}>
            <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            <Text style={styles.dateTimeText}>{formatDate(workout.scheduledDate)}</Text>
          </View>
          <View style={styles.dateTimeItem}>
            <Ionicons name="time-outline" size={20} color="#6B7280" />
            <Text style={styles.dateTimeText}>{formatTime(workout.scheduledTime)}</Text>
          </View>
        </View>
      </View>

      {/* Duration */}
      <View style={styles.section}>
        <View style={styles.durationRow}>
          <Ionicons name="hourglass-outline" size={20} color="#6B7280" />
          <Text style={styles.durationText}>
            Duration: {workout.durationMinutes} minutes
          </Text>
        </View>
      </View>

      {/* Recurring Pattern Info */}
      {recurringDescription && (
        <View style={styles.section}>
          <View style={styles.recurringInfoRow}>
            <Ionicons name="repeat-outline" size={20} color="#6366F1" />
            <Text style={styles.recurringInfoText}>{recurringDescription}</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Edit Button - Requirements: 5.1 */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onEdit}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={20} color="#3B82F6" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        {/* Delete Button - Requirements: 5.2, 5.5 */}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDeletePress}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Start Workout Button - shown when workout is due */}
      {isDue && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={onStartWorkout}
          activeOpacity={0.8}
        >
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      )}

      {/* Calendar sync indicator */}
      {workout.calendarEventId && (
        <View style={styles.syncIndicator}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.syncIndicatorText}>Synced to calendar</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  recurringBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6366F1',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  focusAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusAreaTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  focusAreaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 15,
    color: '#374151',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationText: {
    fontSize: 15,
    color: '#374151',
  },
  recurringInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  recurringInfoText: {
    fontSize: 14,
    color: '#4F46E5',
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  syncIndicatorText: {
    fontSize: 13,
    color: '#10B981',
  },
});

export default ScheduledWorkoutDetail;
