import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '../types/Match';
import type { WorkoutStorage, ScheduledWorkout } from '../types/fitness';
import { formatMatchTime, getMatchStatusColor } from '../utils/matchUtils';
import { DAY_INDICATOR_COLORS } from '../utils/fitnessUtils';

interface MatchCalendarProps {
  matches: Match[];
  loading: boolean;
  onMatchPress: (match: Match) => void;
  onRefresh: () => void;
  onRemoveMatch?: (match: Match) => void;
  workouts?: WorkoutStorage;
  scheduledWorkouts?: ScheduledWorkout[];
  onScheduledWorkoutPress?: (workout: ScheduledWorkout) => void;
  onDateSelect?: (date: string) => void;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  matches: Match[];
  isCurrentMonth: boolean;
  hasGymSession: boolean;
  scheduledWorkouts: ScheduledWorkout[];
  isFutureDate: boolean;
}

/**
 * Unified event type for the upcoming events list
 * Combines matches and scheduled workouts into a single sortable list
 */
type UpcomingEvent = 
  | { type: 'match'; data: Match; dateTime: Date }
  | { type: 'scheduledWorkout'; data: ScheduledWorkout; dateTime: Date };

interface SwipeableMatchItemProps {
  match: Match;
  onPress: () => void;
  onRemove?: () => void;
}

const SwipeableMatchItem: React.FC<SwipeableMatchItemProps> = ({
  match,
  onPress,
  onRemove,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const swipeThreshold = screenWidth * 0.3;
  const deleteButtonWidth = 80;

  const translateX = new Animated.Value(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return !!(onRemove && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10);
    },
    onPanResponderGrant: () => {
      setIsSwipeActive(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dx < 0) {
        const clampedDx = Math.max(gestureState.dx, -deleteButtonWidth);
        translateX.setValue(clampedDx);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      setIsSwipeActive(false);

      if (gestureState.dx < -swipeThreshold) {
        Animated.spring(translateX, {
          toValue: -deleteButtonWidth,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (isSwipeActive) {
      resetSwipe();
    } else {
      onPress();
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
      resetSwipe();
    }
  };

  return (
    <View style={styles.swipeableContainer}>
      {onRemove && (
        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleRemove}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        style={[
          styles.swipeableItem,
          {
            transform: [{ translateX }],
          },
        ]}
        {...(onRemove ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity
          style={styles.matchItem}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.matchInfo}>
            <Text style={styles.matchTeams}>
              {match.team1_name || match.team_a} vs {match.team2_name || match.team_b}
            </Text>
            <Text style={styles.matchTime}>
              {formatMatchTime(match.match_start_time || match.start_time || '')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getMatchStatusColor(match.status) }]}>
            <Text style={styles.statusText}>{match.status.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

/**
 * Scheduled workout item component for the upcoming events list
 */
interface ScheduledWorkoutItemProps {
  workout: ScheduledWorkout;
  onPress: () => void;
}

const ScheduledWorkoutItem: React.FC<ScheduledWorkoutItemProps> = ({
  workout,
  onPress,
}) => {
  const formatScheduledTime = (date: string, time: string): string => {
    const dateObj = new Date(`${date}T${time}:00`);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity
      style={[styles.matchItem, styles.workoutItem]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.workoutIconContainer}>
        <Ionicons name="fitness" size={24} color={DAY_INDICATOR_COLORS.SCHEDULED_WORKOUT} />
      </View>
      <View style={styles.matchInfo}>
        <Text style={styles.matchTeams}>{workout.templateName}</Text>
        <Text style={styles.matchTime}>
          {formatScheduledTime(workout.scheduledDate, workout.scheduledTime)}
        </Text>
        <Text style={styles.focusAreasText}>
          {workout.focusAreas.join(', ')}
        </Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: DAY_INDICATOR_COLORS.SCHEDULED_WORKOUT }]}>
        <Text style={styles.statusText}>SCHEDULED</Text>
      </View>
    </TouchableOpacity>
  );
};

const MatchCalendar: React.FC<MatchCalendarProps> = ({
  matches,
  loading,
  onMatchPress,
  onRefresh,
  onRemoveMatch,
  workouts = {},
  scheduledWorkouts = [],
  onScheduledWorkoutPress,
  onDateSelect,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  // Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
  const formatDateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    generateCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, matches, JSON.stringify(workouts), JSON.stringify(scheduledWorkouts)]);

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const currentDateObj = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dayMatches = matches.filter(match => {
        const matchDate = new Date(match.match_start_time || match.start_time || '');
        return (
          matchDate.getDate() === currentDateObj.getDate() &&
          matchDate.getMonth() === currentDateObj.getMonth() &&
          matchDate.getFullYear() === currentDateObj.getFullYear()
        );
      });

      const dateStr = formatDateToLocalString(currentDateObj);
      const workout = workouts[dateStr];
      const hasGymSession = workout?.type === 'GYM' && !workout?.isRestDay;

      // Filter scheduled workouts for this date
      const dayScheduledWorkouts = scheduledWorkouts.filter(
        sw => sw.scheduledDate === dateStr
      );

      // Check if this is a future date
      const dayDate = new Date(currentDateObj);
      dayDate.setHours(0, 0, 0, 0);
      const isFutureDate = dayDate >= today;

      days.push({
        date: new Date(currentDateObj),
        dateStr,
        matches: dayMatches,
        isCurrentMonth: currentDateObj.getMonth() === month,
        hasGymSession,
        scheduledWorkouts: dayScheduledWorkouts,
        isFutureDate,
      });

      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }

    setCalendarDays(days);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleDayPress = (day: CalendarDay) => {
    // If there are scheduled workouts and a handler is provided, show the first one
    if (day.scheduledWorkouts.length > 0 && onScheduledWorkoutPress) {
      onScheduledWorkoutPress(day.scheduledWorkouts[0]);
    } else if (day.matches.length > 0) {
      // If there are matches, show the first match
      onMatchPress(day.matches[0]);
    } else if (onDateSelect && day.isFutureDate) {
      // If no events and it's a future date, allow scheduling
      onDateSelect(day.dateStr);
    }
  };

  const renderCalendarHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigateMonth('prev')}
      >
        <Ionicons name="chevron-back" size={24} color="#0066cc" />
      </TouchableOpacity>

      <Text style={styles.monthYear}>
        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
      </Text>

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigateMonth('next')}
      >
        <Ionicons name="chevron-forward" size={24} color="#0066cc" />
      </TouchableOpacity>
    </View>
  );

  const renderDayNames = () => (
    <View style={styles.dayNamesRow}>
      {dayNames.map(day => (
        <View key={day} style={styles.dayNameCell}>
          <Text style={styles.dayNameText}>{day}</Text>
        </View>
      ))}
    </View>
  );

  const renderCalendarDay = (day: CalendarDay, index: number) => {
    const isToday = 
      day.date.getDate() === new Date().getDate() &&
      day.date.getMonth() === new Date().getMonth() &&
      day.date.getFullYear() === new Date().getFullYear();

    // Determine if this day has a "No Play" indicator
    // Show No Play for future dates with scheduled workouts
    const hasNoPlayIndicator = day.isFutureDate && day.scheduledWorkouts.length > 0;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.dayCell,
          !day.isCurrentMonth && styles.otherMonthDay,
          isToday && styles.today,
        ]}
        onPress={() => handleDayPress(day)}
      >
        <Text
          style={[
            styles.dayText,
            !day.isCurrentMonth && styles.otherMonthText,
            isToday && styles.todayText,
          ]}
        >
          {day.date.getDate()}
        </Text>

        <View style={styles.matchIndicators}>
          {/* Match dots (blue) */}
          {day.matches.slice(0, 2).map((match, matchIndex) => (
            <View
              key={`match-${matchIndex}`}
              style={[
                styles.matchDot,
                { backgroundColor: DAY_INDICATOR_COLORS.MATCH }
              ]}
            />
          ))}
          
          {/* Completed gym session dot (orange) - for past workouts */}
          {day.hasGymSession && (
            <View
              style={[
                styles.matchDot,
                { backgroundColor: DAY_INDICATOR_COLORS.GYM }
              ]}
            />
          )}
          
          {/* Scheduled workout dots (green) - for future scheduled workouts */}
          {day.scheduledWorkouts.slice(0, 2).map((sw, swIndex) => (
            <View
              key={`scheduled-${swIndex}`}
              style={[
                styles.matchDot,
                { backgroundColor: DAY_INDICATOR_COLORS.SCHEDULED_WORKOUT }
              ]}
            />
          ))}
          
          {day.matches.length > 2 && (
            <Text style={styles.moreMatches}>+{day.matches.length - 2}</Text>
          )}
        </View>

        {/* No Play indicator for dates with scheduled workouts */}
        {hasNoPlayIndicator && (
          <View style={styles.noPlayIndicator}>
            <Text style={styles.noPlayText}>No Play</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCalendarGrid = () => {
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      const weekDays = calendarDays.slice(i * 7, (i + 1) * 7);
      weeks.push(
        <View key={i} style={styles.weekRow}>
          {weekDays.map((day, index) => renderCalendarDay(day, i * 7 + index))}
        </View>
      );
    }
    return weeks;
  };

  /**
   * Merge matches and scheduled workouts into a single chronologically sorted list
   * Requirements: 3.4
   */
  const getUpcomingEvents = useMemo((): UpcomingEvent[] => {
    const events: UpcomingEvent[] = [];
    const now = new Date();

    // Add upcoming matches
    matches.forEach(match => {
      const matchDate = new Date(match.match_start_time || match.start_time || '');
      if (matchDate > now) {
        events.push({
          type: 'match',
          data: match,
          dateTime: matchDate,
        });
      }
    });

    // Add scheduled workouts
    scheduledWorkouts.forEach(workout => {
      const workoutDate = new Date(`${workout.scheduledDate}T${workout.scheduledTime}:00`);
      if (workoutDate > now) {
        events.push({
          type: 'scheduledWorkout',
          data: workout,
          dateTime: workoutDate,
        });
      }
    });

    // Sort by date/time in chronological order
    events.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    // Return first 5 events
    return events.slice(0, 5);
  }, [matches, scheduledWorkouts]);

  /**
   * Get today's events (matches and scheduled workouts)
   */
  const getTodayEvents = useMemo((): UpcomingEvent[] => {
    const events: UpcomingEvent[] = [];
    const todayStr = formatDateToLocalString(new Date());

    // Add today's matches
    matches.forEach(match => {
      const matchDate = new Date(match.match_start_time || match.start_time || '');
      const matchDateStr = formatDateToLocalString(matchDate);
      if (matchDateStr === todayStr) {
        events.push({
          type: 'match',
          data: match,
          dateTime: matchDate,
        });
      }
    });

    // Add today's scheduled workouts
    scheduledWorkouts.forEach(workout => {
      if (workout.scheduledDate === todayStr) {
        const workoutDate = new Date(`${workout.scheduledDate}T${workout.scheduledTime}:00`);
        events.push({
          type: 'scheduledWorkout',
          data: workout,
          dateTime: workoutDate,
        });
      }
    });

    // Sort by time
    events.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    return events;
  }, [matches, scheduledWorkouts]);

  const renderEventItem = (event: UpcomingEvent, index: number) => {
    if (event.type === 'match') {
      return (
        <SwipeableMatchItem
          key={`match-${event.data.match_id}-${index}`}
          match={event.data}
          onPress={() => onMatchPress(event.data)}
          onRemove={onRemoveMatch ? () => onRemoveMatch(event.data) : undefined}
        />
      );
    } else {
      return (
        <ScheduledWorkoutItem
          key={`workout-${event.data.id}-${index}`}
          workout={event.data}
          onPress={() => onScheduledWorkoutPress?.(event.data)}
        />
      );
    }
  };

  const renderEventsList = () => {
    const todayEvents = getTodayEvents;
    const upcomingEvents = getUpcomingEvents;

    return (
      <View style={styles.matchListContainer}>
        {todayEvents.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.sectionTitle}>Today's Events</Text>
            {todayEvents.map((event, index) => renderEventItem(event, index))}
          </View>
        )}

        {upcomingEvents.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {upcomingEvents.map((event, index) => renderEventItem(event, index))}
          </View>
        )}

        {todayEvents.length === 0 && upcomingEvents.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No upcoming events</Text>
            <Text style={styles.emptyStateSubtext}>
              Schedule a workout or add a match to get started
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {renderCalendarHeader()}
      {renderDayNames()}
      <View style={styles.calendarGrid}>
        {renderCalendarGrid()}
      </View>
      
      {/* Legend for calendar indicators */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DAY_INDICATOR_COLORS.MATCH }]} />
          <Text style={styles.legendText}>Match</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DAY_INDICATOR_COLORS.GYM }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: DAY_INDICATOR_COLORS.SCHEDULED_WORKOUT }]} />
          <Text style={styles.legendText}>Scheduled</Text>
        </View>
      </View>
      
      {renderEventsList()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    padding: 10,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dayNamesRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dayNameCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    backgroundColor: '#fff',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: 70,
    padding: 4,
    borderBottomWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  otherMonthDay: {
    backgroundColor: '#f8f8f8',
  },
  today: {
    backgroundColor: '#e3f2fd',
  },
  dayText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  otherMonthText: {
    color: '#ccc',
  },
  todayText: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  matchIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1,
    marginVertical: 1,
  },
  moreMatches: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
  },
  noPlayIndicator: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: DAY_INDICATOR_COLORS.NO_PLAY,
    borderRadius: 4,
  },
  noPlayText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '600',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  matchListContainer: {
    padding: 16,
  },
  matchSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  matchItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  workoutItem: {
    borderLeftWidth: 4,
    borderLeftColor: DAY_INDICATOR_COLORS.SCHEDULED_WORKOUT,
  },
  workoutIconContainer: {
    marginRight: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  matchTime: {
    fontSize: 14,
    color: '#666',
  },
  focusAreasText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  // Swipeable styles
  swipeableContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    borderRadius: 8,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  swipeableItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});

export default MatchCalendar;
