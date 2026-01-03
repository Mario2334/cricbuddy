import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FitnessStackParamList } from '../types/navigation';
import { DailyWorkout, MuscleGroup, WorkoutStorage } from '../types/fitness';
import { ScheduledMatch } from '../types/Match';
import { fitnessService } from '../services/fitnessService';
import {
  DAY_INDICATOR_COLORS,
  getDayIndicatorColor,
  getWeekStartDate,
  getWeekDates,
  getDayAbbreviation,
  getDayNumber,
  isToday,
  formatWorkoutDate,
} from '../utils/fitnessUtils';

type Props = StackScreenProps<FitnessStackParamList, 'FitnessDashboard'>;

/**
 * Day data structure for the weekly view
 */
interface DayData {
  date: string;
  dayAbbr: string;
  dayNumber: number;
  isToday: boolean;
  hasMatch: boolean;
  hasWorkout: boolean;
  workout?: DailyWorkout;
  match?: ScheduledMatch;
  indicatorColor: string;
}

/**
 * FitnessDashboard Screen
 * 
 * Main screen for the Fitness module showing:
 * - Weekly snapshot with 7-day horizontal scroll
 * - Today's action card (Match Day rest or Gym Day workout)
 * - "Start Workout" button for gym days
 * - Long-press to swap workout days
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4
 */
const FitnessDashboard: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekDays, setWeekDays] = useState<DayData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [workouts, setWorkouts] = useState<WorkoutStorage>({});
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  
  // Swap mode state
  const [swapMode, setSwapMode] = useState(false);
  const [swapSourceDate, setSwapSourceDate] = useState<string | null>(null);
  const swapAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;

  /**
   * Load workout and match data
   */
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Load workouts and matches in parallel
      const [workoutHistory, scheduledMatches] = await Promise.all([
        fitnessService.getWorkoutHistory(),
        fitnessService.getScheduledMatches(),
      ]);

      setWorkouts(workoutHistory);
      setMatches(scheduledMatches);

      // Build week data
      const weekStart = getWeekStartDate();
      const dates = getWeekDates(weekStart);
      
      const days: DayData[] = dates.map(date => {
        // Use matchStartTime (actual match date) instead of scheduledAt (when user added it)
        const matchForDate = scheduledMatches.find(m => {
          const matchDate = (m.matchStartTime || m.scheduledAt).split('T')[0];
          return matchDate === date;
        });
        const workoutForDate = workoutHistory[date];
        
        return {
          date,
          dayAbbr: getDayAbbreviation(date),
          dayNumber: getDayNumber(date),
          isToday: isToday(date),
          hasMatch: !!matchForDate,
          hasWorkout: !!workoutForDate && workoutForDate.type === 'GYM' && !workoutForDate.isRestDay,
          workout: workoutForDate,
          match: matchForDate,
          indicatorColor: getDayIndicatorColor(date, scheduledMatches, workoutHistory),
        };
      });

      setWeekDays(days);
      
      // Initialize swap animations for each day
      days.forEach(day => {
        if (!swapAnimations[day.date]) {
          swapAnimations[day.date] = new Animated.Value(1);
        }
      });
    } catch (error) {
      console.error('FitnessDashboard: Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [swapAnimations]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  /**
   * Handle day selection
   */
  const handleDayPress = useCallback((date: string) => {
    if (swapMode && swapSourceDate) {
      // In swap mode - handle swap target selection
      handleSwapTarget(date);
    } else {
      setSelectedDate(date);
    }
  }, [swapMode, swapSourceDate]);

  /**
   * Handle long press to initiate swap mode
   * Requirements: 6.1
   */
  const handleDayLongPress = useCallback((date: string) => {
    const dayData = weekDays.find(d => d.date === date);
    
    // Only allow swapping gym days
    if (!dayData?.hasWorkout) {
      return;
    }

    setSwapMode(true);
    setSwapSourceDate(date);
    
    // Animate available days
    weekDays.forEach(day => {
      if (day.date !== date && !day.hasMatch) {
        // Pulse animation for available swap targets
        Animated.loop(
          Animated.sequence([
            Animated.timing(swapAnimations[day.date], {
              toValue: 1.1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(swapAnimations[day.date], {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    });
  }, [weekDays, swapAnimations]);

  /**
   * Handle swap target selection
   * Requirements: 6.2, 6.3, 6.4
   */
  const handleSwapTarget = useCallback(async (targetDate: string) => {
    if (!swapSourceDate || targetDate === swapSourceDate) {
      cancelSwapMode();
      return;
    }

    const targetDay = weekDays.find(d => d.date === targetDate);
    const sourceDay = weekDays.find(d => d.date === swapSourceDate);

    // Check for match day conflict
    if (targetDay?.hasMatch) {
      Alert.alert(
        'Match Day Conflict',
        'You cannot swap a workout to a match day. Please select a different day.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check for leg day before match conflict
    if (sourceDay?.workout?.focusAreas?.includes('LEGS')) {
      const hasConflict = await fitnessService.checkLegDayConflict(
        targetDate,
        sourceDay.workout.focusAreas
      );

      if (hasConflict) {
        Alert.alert(
          'Leg Day Warning',
          'Scheduling leg day before a match may affect your performance. Do you want to proceed?',
          [
            { text: 'Cancel', style: 'cancel', onPress: cancelSwapMode },
            { text: 'Proceed Anyway', onPress: () => executeSwap(targetDate) },
          ]
        );
        return;
      }
    }

    executeSwap(targetDate);
  }, [swapSourceDate, weekDays]);

  /**
   * Execute the workout swap
   */
  const executeSwap = useCallback(async (targetDate: string) => {
    if (!swapSourceDate) return;

    try {
      const sourceWorkout = workouts[swapSourceDate];
      
      if (sourceWorkout) {
        // Create new workout for target date
        const newWorkout: DailyWorkout = {
          ...sourceWorkout,
          date: targetDate,
          updatedAt: new Date().toISOString(),
        };

        // Save to target date and delete from source
        await fitnessService.saveWorkout(newWorkout);
        await fitnessService.deleteWorkout(swapSourceDate);

        // Reload data
        await loadData();
      }
    } catch (error) {
      console.error('FitnessDashboard: Failed to swap workout:', error);
      Alert.alert('Error', 'Failed to swap workout. Please try again.');
    } finally {
      cancelSwapMode();
    }
  }, [swapSourceDate, workouts, loadData]);

  /**
   * Cancel swap mode
   */
  const cancelSwapMode = useCallback(() => {
    setSwapMode(false);
    setSwapSourceDate(null);
    
    // Stop all animations
    Object.values(swapAnimations).forEach(anim => {
      anim.stopAnimation();
      anim.setValue(1);
    });
  }, [swapAnimations]);

  /**
   * Handle start workout button press
   */
  const handleStartWorkout = useCallback(() => {
    const selectedDay = weekDays.find(d => d.date === selectedDate);
    const focusAreas = selectedDay?.workout?.focusAreas || [];
    
    navigation.navigate('ActiveWorkout', {
      date: selectedDate,
      focusAreas,
      existingWorkout: selectedDay?.workout,
    });
  }, [navigation, selectedDate, weekDays]);

  /**
   * Get the selected day data
   */
  const getSelectedDayData = useCallback((): DayData | undefined => {
    return weekDays.find(d => d.date === selectedDate);
  }, [weekDays, selectedDate]);

  /**
   * Render a single day in the weekly view
   */
  const renderDayItem = (day: DayData) => {
    const isSelected = day.date === selectedDate;
    const isSwapSource = day.date === swapSourceDate;
    const isAvailableForSwap = swapMode && !day.hasMatch && day.date !== swapSourceDate;
    
    const scale = swapAnimations[day.date] || new Animated.Value(1);

    return (
      <Animated.View
        key={day.date}
        style={[
          { transform: [{ scale }] },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.dayItem,
            isSelected && styles.dayItemSelected,
            isSwapSource && styles.dayItemSwapSource,
            isAvailableForSwap && styles.dayItemSwapTarget,
          ]}
          onPress={() => handleDayPress(day.date)}
          onLongPress={() => handleDayLongPress(day.date)}
          delayLongPress={500}
        >
          <Text style={[
            styles.dayAbbr,
            isSelected && styles.dayAbbrSelected,
            day.isToday && styles.dayAbbrToday,
          ]}>
            {day.dayAbbr}
          </Text>
          <Text style={[
            styles.dayNumber,
            isSelected && styles.dayNumberSelected,
          ]}>
            {day.dayNumber}
          </Text>
          <View style={[
            styles.dayIndicator,
            { backgroundColor: day.indicatorColor },
          ]} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  /**
   * Render the action card based on selected day type
   */
  const renderActionCard = () => {
    const selectedDay = getSelectedDayData();
    
    if (!selectedDay) {
      return null;
    }

    // Match day card - Requirements: 4.5
    if (selectedDay.hasMatch) {
      return (
        <View style={[styles.actionCard, styles.matchDayCard]}>
          <View style={styles.actionCardHeader}>
            <Ionicons name="trophy" size={32} color={DAY_INDICATOR_COLORS.MATCH} />
            <Text style={styles.actionCardTitle}>Match Day</Text>
          </View>
          <Text style={styles.matchDayMessage}>Rest & Hydrate</Text>
          {selectedDay.match && (
            <View style={styles.matchInfo}>
              <Text style={styles.matchTeams}>
                {selectedDay.match.teamNames.team1} vs {selectedDay.match.teamNames.team2}
              </Text>
              {selectedDay.match.groundName && (
                <Text style={styles.matchVenue}>{selectedDay.match.groundName}</Text>
              )}
            </View>
          )}
          <View style={styles.restTips}>
            <Text style={styles.restTipTitle}>Pre-Match Tips:</Text>
            <Text style={styles.restTip}>• Stay hydrated throughout the day</Text>
            <Text style={styles.restTip}>• Get adequate sleep tonight</Text>
            <Text style={styles.restTip}>• Light stretching only</Text>
          </View>
        </View>
      );
    }

    // Gym day card - Requirements: 4.6
    if (selectedDay.hasWorkout) {
      const focusAreas = selectedDay.workout?.focusAreas || [];
      
      return (
        <View style={[styles.actionCard, styles.gymDayCard]}>
          <View style={styles.actionCardHeader}>
            <Ionicons name="barbell" size={32} color={DAY_INDICATOR_COLORS.GYM} />
            <Text style={styles.actionCardTitle}>Gym Day</Text>
          </View>
          <Text style={styles.dateLabel}>{formatWorkoutDate(selectedDay.date, 'long')}</Text>
          
          {focusAreas.length > 0 && (
            <View style={styles.focusAreasContainer}>
              <Text style={styles.focusAreasLabel}>Focus Areas:</Text>
              <View style={styles.focusAreasTags}>
                {focusAreas.map((area, index) => (
                  <View key={index} style={styles.focusAreaTag}>
                    <Text style={styles.focusAreaText}>{area}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.startWorkoutButton}
            onPress={handleStartWorkout}
          >
            <Ionicons name="play-circle" size={24} color="#fff" />
            <Text style={styles.startWorkoutButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Rest day card
    const today = new Date().toISOString().split('T')[0];
    const isPastDate = selectedDay.date < today;

    return (
      <View style={[styles.actionCard, styles.restDayCard]}>
        <View style={styles.actionCardHeader}>
          <Ionicons name="bed" size={32} color={DAY_INDICATOR_COLORS.REST} />
          <Text style={styles.actionCardTitle}>Rest Day</Text>
        </View>
        <Text style={styles.dateLabel}>{formatWorkoutDate(selectedDay.date, 'long')}</Text>
        <Text style={styles.restDayMessage}>No workout scheduled</Text>
        {isPastDate ? (
          <TouchableOpacity
            style={styles.startWorkoutButton}
            onPress={() => {
              navigation.navigate('ActiveWorkout', {
                date: selectedDay.date,
                focusAreas: [],
              });
            }}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.startWorkoutButtonText}>Log Workout</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.scheduleWorkoutButton}
            onPress={() => {
              navigation.navigate('WorkoutTemplates');
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={DAY_INDICATOR_COLORS.GYM} />
            <Text style={styles.scheduleWorkoutButtonText}>Schedule Workout</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading fitness data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Swap mode banner */}
      {swapMode && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText}>
            Select a day to swap with, or tap anywhere to cancel
          </Text>
          <TouchableOpacity onPress={cancelSwapMode} style={styles.cancelSwapButton}>
            <Text style={styles.cancelSwapButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Weekly Snapshot - Requirements: 4.1 */}
      <View style={styles.weeklySection}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weeklyScrollContent}
        >
          {weekDays.map(renderDayItem)}
        </ScrollView>
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DAY_INDICATOR_COLORS.MATCH }]} />
            <Text style={styles.legendText}>Match</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DAY_INDICATOR_COLORS.GYM }]} />
            <Text style={styles.legendText}>Gym</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DAY_INDICATOR_COLORS.REST }]} />
            <Text style={styles.legendText}>Rest</Text>
          </View>
        </View>
      </View>

      {/* Action Card */}
      <View style={styles.actionSection}>
        {renderActionCard()}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('WorkoutTemplates')}
          >
            <Ionicons name="library" size={24} color="#F97316" />
            <Text style={styles.quickActionText}>Browse Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('ExerciseHistory', {})}
          >
            <Ionicons name="stats-chart" size={24} color="#3498db" />
            <Text style={styles.quickActionText}>Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              navigation.navigate('ActiveWorkout', {
                date: selectedDate,
                focusAreas: [],
              });
            }}
          >
            <Ionicons name="add-circle" size={24} color="#3498db" />
            <Text style={styles.quickActionText}>Log Workout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tip of the day */}
      <View style={styles.tipSection}>
        <View style={styles.tipCard}>
          <Ionicons name="bulb" size={20} color="#f39c12" />
          <Text style={styles.tipText}>
            Tip: Long-press a gym day to swap it with another day
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // Swap mode styles
  swapBanner: {
    backgroundColor: '#3498db',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swapBannerText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  cancelSwapButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  cancelSwapButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Weekly section styles
  weeklySection: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  weeklyScrollContent: {
    paddingHorizontal: 12,
  },
  dayItem: {
    width: 56,
    height: 80,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dayItemSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#3498db',
  },
  dayItemSwapSource: {
    backgroundColor: '#fff3e0',
    borderWidth: 2,
    borderColor: DAY_INDICATOR_COLORS.GYM,
  },
  dayItemSwapTarget: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4caf50',
    borderStyle: 'dashed',
  },
  dayAbbr: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dayAbbrSelected: {
    color: '#3498db',
    fontWeight: '600',
  },
  dayAbbrToday: {
    fontWeight: '700',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dayNumberSelected: {
    color: '#3498db',
  },
  dayIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Legend styles
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },

  // Action section styles
  actionSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },

  // Match day card
  matchDayCard: {
    backgroundColor: '#e3f2fd',
  },
  matchDayMessage: {
    fontSize: 24,
    fontWeight: '600',
    color: DAY_INDICATOR_COLORS.MATCH,
    marginBottom: 16,
  },
  matchInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  matchVenue: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  restTips: {
    marginTop: 8,
  },
  restTipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  restTip: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },

  // Gym day card
  gymDayCard: {
    backgroundColor: '#fff3e0',
  },
  focusAreasContainer: {
    marginBottom: 20,
  },
  focusAreasLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  focusAreasTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  focusAreaTag: {
    backgroundColor: DAY_INDICATOR_COLORS.GYM,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  focusAreaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  startWorkoutButton: {
    backgroundColor: DAY_INDICATOR_COLORS.GYM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  startWorkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Rest day card
  restDayCard: {
    backgroundColor: '#fff',
  },
  restDayMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  scheduleWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: DAY_INDICATOR_COLORS.GYM,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  scheduleWorkoutButtonText: {
    color: DAY_INDICATOR_COLORS.GYM,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Quick actions styles
  quickActionsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Tip section styles
  tipSection: {
    paddingHorizontal: 16,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});

export default FitnessDashboard;
