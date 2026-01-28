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
import { formatMatchTime, getMatchStatusColor } from '../utils/matchUtils';

const MATCH_COLOR = '#3498db';

interface MatchCalendarProps {
  matches: Match[];
  loading: boolean;
  onMatchPress: (match: Match) => void;
  onRefresh: () => void;
  onRemoveMatch?: (match: Match) => void;
  onDateSelect?: (date: string) => void;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  matches: Match[];
  isCurrentMonth: boolean;
  isFutureDate: boolean;
}

/**
 * Unified event type for the upcoming events list
 */
type UpcomingEvent = { type: 'match'; data: Match; dateTime: Date };

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

const MatchCalendar: React.FC<MatchCalendarProps> = ({
  matches,
  loading,
  onMatchPress,
  onRefresh,
  onRemoveMatch,
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
  }, [currentDate, matches]);

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

      // Check if this is a future date
      const dayDate = new Date(currentDateObj);
      dayDate.setHours(0, 0, 0, 0);
      const isFutureDate = dayDate >= today;

      days.push({
        date: new Date(currentDateObj),
        dateStr,
        matches: dayMatches,
        isCurrentMonth: currentDateObj.getMonth() === month,
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
    if (day.matches.length > 0) {
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
          {day.matches.slice(0, 3).map((match, matchIndex) => (
            <View
              key={`match-${matchIndex}`}
              style={[
                styles.matchDot,
                { backgroundColor: MATCH_COLOR }
              ]}
            />
          ))}
          
          {day.matches.length > 3 && (
            <Text style={styles.moreMatches}>+{day.matches.length - 3}</Text>
          )}
        </View>
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
   * Get upcoming matches
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

    // Sort by date/time in chronological order
    events.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    // Return first 5 events
    return events.slice(0, 5);
  }, [matches]);

  /**
   * Get today's matches
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

    // Sort by time
    events.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    return events;
  }, [matches]);

  const renderEventItem = (event: UpcomingEvent, index: number) => {
    return (
      <SwipeableMatchItem
        key={`match-${event.data.match_id}-${index}`}
        match={event.data}
        onPress={() => onMatchPress(event.data)}
        onRemove={onRemoveMatch ? () => onRemoveMatch(event.data) : undefined}
      />
    );
  };

  const renderEventsList = () => {
    const todayEvents = getTodayEvents;
    const upcomingEvents = getUpcomingEvents;

    return (
      <View style={styles.matchListContainer}>
        {todayEvents.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.sectionTitle}>Today's Matches</Text>
            {todayEvents.map((event, index) => renderEventItem(event, index))}
          </View>
        )}

        {upcomingEvents.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.sectionTitle}>Upcoming Matches</Text>
            {upcomingEvents.map((event, index) => renderEventItem(event, index))}
          </View>
        )}

        {todayEvents.length === 0 && upcomingEvents.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No upcoming matches</Text>
            <Text style={styles.emptyStateSubtext}>
              Add a match to get started
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
          <View style={[styles.legendDot, { backgroundColor: MATCH_COLOR }]} />
          <Text style={styles.legendText}>Match</Text>
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
