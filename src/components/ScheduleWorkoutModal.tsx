/**
 * ScheduleWorkoutModal Component
 * 
 * A modal component for scheduling future workouts with date/time selection,
 * template selection, and recurring schedule options.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 7.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { templateService } from '../services/templateService';
import { workoutCalendarService } from '../services/workoutCalendarService';
import type { 
  WorkoutTemplate, 
  ScheduledWorkout, 
  RecurringPattern,
  ConflictResult,
  MuscleGroup,
} from '../types/fitness';

interface ScheduleWorkoutModalProps {
  visible: boolean;
  selectedDate?: string;  // Pre-selected date in YYYY-MM-DD format
  onClose: () => void;
  onSchedule: (workout: ScheduledWorkout) => void;
}

// Days of week for recurring schedule
const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun', fullLabel: 'Sunday' },
  { id: 1, label: 'Mon', fullLabel: 'Monday' },
  { id: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { id: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { id: 4, label: 'Thu', fullLabel: 'Thursday' },
  { id: 5, label: 'Fri', fullLabel: 'Friday' },
  { id: 6, label: 'Sat', fullLabel: 'Saturday' },
];

// Available time slots (5 AM to 10 PM)
const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 5;
  return {
    value: `${hour.toString().padStart(2, '0')}:00`,
    label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
  };
});

// Default workout duration in minutes
const DEFAULT_DURATION = 90;

export const ScheduleWorkoutModal: React.FC<ScheduleWorkoutModalProps> = ({
  visible,
  selectedDate,
  onClose,
  onSchedule,
}) => {
  // State for form fields
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('07:00');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);

  // Load templates on mount
  useEffect(() => {
    const allTemplates = templateService.getAllTemplates();
    setTemplates(allTemplates);
  }, []);

  // Initialize date when modal opens or selectedDate changes
  useEffect(() => {
    if (visible) {
      const initialDate = selectedDate || getTodayDate();
      setScheduledDate(initialDate);
      setSelectedTemplate(null);
      setScheduledTime('07:00');
      setIsRecurring(false);
      setSelectedDays([]);
      setConflict(null);
    }
  }, [visible, selectedDate]);

  // Check for conflicts when date or time changes
  useEffect(() => {
    if (scheduledDate && scheduledTime) {
      checkForConflicts();
    }
  }, [scheduledDate, scheduledTime]);

  // Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
  const formatDateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get today's date as default
  const getTodayDate = (): string => {
    return formatDateToLocalString(new Date());
  };

  // Check for scheduling conflicts
  const checkForConflicts = useCallback(async () => {
    try {
      const result = await workoutCalendarService.checkConflicts(scheduledDate, scheduledTime);
      setConflict(result.hasConflict ? result : null);
    } catch (error) {
      console.error('Error checking conflicts:', error);
    }
  }, [scheduledDate, scheduledTime]);

  // Toggle day selection for recurring schedule
  const toggleDaySelection = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId].sort()
    );
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Generate dates for date picker (next 30 days)
  // If selectedDate prop is provided and is a future date, ensure it's included in the list
  const getAvailableDates = (): { value: string; label: string }[] => {
    const dates: { value: string; label: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Always start from today (offset 0) to include today as an option
    // This ensures the selected date is always available if it's today or in the future
    for (let i = 0; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatDateToLocalString(date);
      dates.push({
        value: dateStr,
        label: formatDateDisplay(dateStr),
      });
    }
    
    return dates;
  };

  // Handle schedule submission
  const handleSchedule = async () => {
    if (!selectedTemplate) {
      Alert.alert('Select Template', 'Please select a workout template.');
      return;
    }

    if (!scheduledDate) {
      Alert.alert('Select Date', 'Please select a date for your workout.');
      return;
    }

    if (isRecurring && selectedDays.length === 0) {
      Alert.alert('Select Days', 'Please select at least one day for recurring workouts.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRecurring) {
        // Create recurring series
        const pattern: RecurringPattern = {
          frequency: 'weekly',
          daysOfWeek: selectedDays,
        };

        const baseWorkout = {
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          focusAreas: selectedTemplate.focusAreas as MuscleGroup[],
          scheduledTime,
          durationMinutes: DEFAULT_DURATION,
          isRecurring: true,
          recurringPattern: pattern,
        };

        const createdWorkouts = await workoutCalendarService.createRecurringSeries(
          pattern,
          baseWorkout,
          4 // 4 weeks
        );

        // Sync first workout to calendar and return it
        if (createdWorkouts.length > 0) {
          const firstWorkout = createdWorkouts[0];
          const calendarEventId = await workoutCalendarService.syncToDeviceCalendar(firstWorkout);
          
          if (calendarEventId) {
            await workoutCalendarService.updateScheduledWorkout(firstWorkout.id, { calendarEventId });
          }
          
          onSchedule(firstWorkout);
        }
      } else {
        // Create single workout
        const workout = await workoutCalendarService.scheduleWorkoutWithCalendarSync({
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          focusAreas: selectedTemplate.focusAreas as MuscleGroup[],
          scheduledDate,
          scheduledTime,
          durationMinutes: DEFAULT_DURATION,
          isRecurring: false,
        });

        onSchedule(workout);
      }

      onClose();
    } catch (error) {
      console.error('Error scheduling workout:', error);
      Alert.alert('Error', 'Failed to schedule workout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render template selector
  const renderTemplateSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Workout Template</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.templateScrollContent}
      >
        {templates.map(template => (
          <TouchableOpacity
            key={template.id}
            style={[
              styles.templateCard,
              selectedTemplate?.id === template.id && styles.templateCardSelected,
            ]}
            onPress={() => setSelectedTemplate(template)}
          >
            <View style={styles.templateIconContainer}>
              <Ionicons 
                name="barbell-outline" 
                size={24} 
                color={selectedTemplate?.id === template.id ? '#fff' : '#3B82F6'} 
              />
            </View>
            <Text 
              style={[
                styles.templateName,
                selectedTemplate?.id === template.id && styles.templateNameSelected,
              ]}
              numberOfLines={2}
            >
              {template.name}
            </Text>
            <Text 
              style={[
                styles.templateFocus,
                selectedTemplate?.id === template.id && styles.templateFocusSelected,
              ]}
            >
              {template.focusAreas.join(' & ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render date picker
  const renderDatePicker = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Date</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowDatePicker(!showDatePicker)}
      >
        <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
        <Text style={styles.pickerButtonText}>
          {scheduledDate ? formatDateDisplay(scheduledDate) : 'Select a date'}
        </Text>
        <Ionicons 
          name={showDatePicker ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#6B7280" 
        />
      </TouchableOpacity>
      
      {showDatePicker && (
        <ScrollView 
          style={styles.pickerDropdown}
          nestedScrollEnabled
        >
          {getAvailableDates().map(date => (
            <TouchableOpacity
              key={date.value}
              style={[
                styles.pickerOption,
                scheduledDate === date.value && styles.pickerOptionSelected,
              ]}
              onPress={() => {
                setScheduledDate(date.value);
                setShowDatePicker(false);
              }}
            >
              <Text 
                style={[
                  styles.pickerOptionText,
                  scheduledDate === date.value && styles.pickerOptionTextSelected,
                ]}
              >
                {date.label}
              </Text>
              {scheduledDate === date.value && (
                <Ionicons name="checkmark" size={20} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Render time picker
  const renderTimePicker = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select Time</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowTimePicker(!showTimePicker)}
      >
        <Ionicons name="time-outline" size={20} color="#3B82F6" />
        <Text style={styles.pickerButtonText}>
          {TIME_SLOTS.find(t => t.value === scheduledTime)?.label || 'Select a time'}
        </Text>
        <Ionicons 
          name={showTimePicker ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#6B7280" 
        />
      </TouchableOpacity>
      
      {showTimePicker && (
        <ScrollView 
          style={styles.pickerDropdown}
          nestedScrollEnabled
        >
          {TIME_SLOTS.map(time => (
            <TouchableOpacity
              key={time.value}
              style={[
                styles.pickerOption,
                scheduledTime === time.value && styles.pickerOptionSelected,
              ]}
              onPress={() => {
                setScheduledTime(time.value);
                setShowTimePicker(false);
              }}
            >
              <Text 
                style={[
                  styles.pickerOptionText,
                  scheduledTime === time.value && styles.pickerOptionTextSelected,
                ]}
              >
                {time.label}
              </Text>
              {scheduledTime === time.value && (
                <Ionicons name="checkmark" size={20} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Render recurring schedule toggle and day selector
  const renderRecurringSection = () => (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.recurringToggle}
        onPress={() => setIsRecurring(!isRecurring)}
      >
        <View style={styles.recurringToggleLeft}>
          <Ionicons 
            name="repeat-outline" 
            size={20} 
            color={isRecurring ? '#3B82F6' : '#6B7280'} 
          />
          <Text style={styles.recurringToggleText}>Make it recurring</Text>
        </View>
        <View style={[styles.toggleSwitch, isRecurring && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, isRecurring && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {isRecurring && (
        <View style={styles.daysSelector}>
          <Text style={styles.daysSelectorLabel}>Repeat on:</Text>
          <View style={styles.daysRow}>
            {DAYS_OF_WEEK.map(day => (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayButton,
                  selectedDays.includes(day.id) && styles.dayButtonSelected,
                ]}
                onPress={() => toggleDaySelection(day.id)}
              >
                <Text 
                  style={[
                    styles.dayButtonText,
                    selectedDays.includes(day.id) && styles.dayButtonTextSelected,
                  ]}
                >
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.recurringNote}>
            Workouts will be scheduled for the next 4 weeks
          </Text>
        </View>
      )}
    </View>
  );

  // Render conflict warning
  const renderConflictWarning = () => {
    if (!conflict) return null;

    return (
      <View style={styles.conflictWarning}>
        <Ionicons name="warning-outline" size={20} color="#F59E0B" />
        <View style={styles.conflictTextContainer}>
          <Text style={styles.conflictTitle}>Scheduling Conflict</Text>
          <Text style={styles.conflictDetails}>{conflict.conflictDetails}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Schedule Workout</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderTemplateSelector()}
            {renderDatePicker()}
            {renderTimePicker()}
            {renderRecurringSection()}
            {renderConflictWarning()}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.scheduleButton,
                (!selectedTemplate || isLoading) && styles.scheduleButtonDisabled,
              ]}
              onPress={handleSchedule}
              disabled={!selectedTemplate || isLoading}
            >
              {isLoading ? (
                <Text style={styles.scheduleButtonText}>Scheduling...</Text>
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={18} color="#fff" />
                  <Text style={styles.scheduleButtonText}>
                    {isRecurring ? 'Schedule Series' : 'Schedule Workout'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Template selector styles
  templateScrollContent: {
    paddingRight: 20,
  },
  templateCard: {
    width: 120,
    padding: 12,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  templateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  templateNameSelected: {
    color: '#fff',
  },
  templateFocus: {
    fontSize: 11,
    color: '#6B7280',
  },
  templateFocusSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Picker styles
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  pickerDropdown: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  pickerOptionTextSelected: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  // Recurring section styles
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
  },
  recurringToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recurringToggleText: {
    fontSize: 16,
    color: '#111827',
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#3B82F6',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  daysSelector: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  daysSelectorLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#3B82F6',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  dayButtonTextSelected: {
    color: '#fff',
  },
  recurringNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  // Conflict warning styles
  conflictWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  conflictTextContainer: {
    flex: 1,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 2,
  },
  conflictDetails: {
    fontSize: 13,
    color: '#B45309',
  },
  // Footer styles
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  scheduleButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scheduleButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  scheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ScheduleWorkoutModal;
