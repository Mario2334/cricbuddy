import React, { useState, useEffect } from 'react';
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

interface MatchCalendarProps {
  matches: Match[];
  loading: boolean;
  onMatchPress: (match: Match) => void;
  onRefresh: () => void;
  onRemoveMatch?: (match: Match) => void;
}

interface CalendarDay {
  date: Date;
  matches: Match[];
  isCurrentMonth: boolean;
}

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
  const swipeThreshold = screenWidth * 0.3; // 30% of screen width
  const deleteButtonWidth = 80;

  const translateX = new Animated.Value(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only respond to horizontal swipes and if onRemove is provided
      return onRemove && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
    },
    onPanResponderGrant: () => {
      setIsSwipeActive(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      // Only allow left swipe (negative dx)
      if (gestureState.dx < 0) {
        const clampedDx = Math.max(gestureState.dx, -deleteButtonWidth);
        translateX.setValue(clampedDx);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      setIsSwipeActive(false);

      if (gestureState.dx < -swipeThreshold) {
        // Swipe far enough to show delete button
        Animated.spring(translateX, {
          toValue: -deleteButtonWidth,
          useNativeDriver: true,
        }).start();
      } else {
        // Snap back to original position
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
      {/* Delete button (behind the item) */}
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

      {/* Main match item */}
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
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    generateCalendar();
  }, [currentDate, matches]);

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get the day of week for the first day (0 = Sunday)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Generate 42 days (6 weeks) for the calendar grid
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

      days.push({
        date: new Date(currentDateObj),
        matches: dayMatches,
        isCurrentMonth: currentDateObj.getMonth() === month,
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
        onPress={() => {
          if (day.matches.length > 0) {
            // For now, just open the first match of the day
            onMatchPress(day.matches[0]);
          }
        }}
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

        {day.matches.length > 0 && (
          <View style={styles.matchIndicators}>
            {day.matches.slice(0, 3).map((match, matchIndex) => (
              <View
                key={matchIndex}
                style={[
                  styles.matchDot,
                  { backgroundColor: getMatchStatusColor(match.status) }
                ]}
              />
            ))}
            {day.matches.length > 3 && (
              <Text style={styles.moreMatches}>+{day.matches.length - 3}</Text>
            )}
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

  const renderMatchList = () => {
    const todayMatches = matches.filter(match => {
      const matchDate = new Date(match.match_start_time || match.start_time || '');
      const today = new Date();
      return (
        matchDate.getDate() === today.getDate() &&
        matchDate.getMonth() === today.getMonth() &&
        matchDate.getFullYear() === today.getFullYear()
      );
    });

    const upcomingMatches = matches
      .filter(match => {
        const matchDate = new Date(match.match_start_time || match.start_time || '');
        return matchDate > new Date();
      })
      .slice(0, 5);

    return (
      <View style={styles.matchListContainer}>
        {todayMatches.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.sectionTitle}>Today's Matches</Text>
            {todayMatches.map((match, index) => (
              <SwipeableMatchItem
                key={index}
                match={match}
                onPress={() => onMatchPress(match)}
                onRemove={onRemoveMatch ? () => onRemoveMatch(match) : undefined}
              />
            ))}
          </View>
        )}

        {upcomingMatches.length > 0 && (
          <View style={styles.matchSection}>
            <Text style={styles.sectionTitle}>Upcoming Matches</Text>
            {upcomingMatches.map((match, index) => (
              <SwipeableMatchItem
                key={index}
                match={match}
                onPress={() => onMatchPress(match)}
                onRemove={onRemoveMatch ? () => onRemoveMatch(match) : undefined}
              />
            ))}
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
      {renderMatchList()}
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
    minHeight: 60,
    padding: 8,
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
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
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
