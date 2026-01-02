/**
 * NextGymSessionCard Component
 * 
 * Displays the next scheduled gym session with focus areas on the home screen.
 * Shows "No upcoming gym sessions" when empty.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { DailyWorkout, MuscleGroup } from '../types/fitness';
import { fitnessService } from '../services/fitnessService';
import { formatWorkoutDate, DAY_INDICATOR_COLORS } from '../utils/fitnessUtils';

interface NextGymSessionCardProps {
  onPress?: () => void;
}

/**
 * Get display name for a muscle group
 */
const getMuscleGroupDisplayName = (group: MuscleGroup): string => {
  const displayNames: Record<MuscleGroup, string> = {
    LEGS: 'Legs',
    SHOULDERS: 'Shoulders',
    CHEST: 'Chest',
    TRICEPS: 'Triceps',
    BACK: 'Back',
    BICEPS: 'Biceps',
    CORE: 'Core',
    CARDIO: 'Cardio',
  };
  return displayNames[group] || group;
};

const NextGymSessionCard: React.FC<NextGymSessionCardProps> = ({ onPress }) => {
  const [nextSession, setNextSession] = useState<DailyWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  const loadNextSession = useCallback(async () => {
    try {
      setLoading(true);
      const session = await fitnessService.getNextGymSession();
      setNextSession(session);
    } catch (error) {
      console.error('Error loading next gym session:', error);
      setNextSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNextSession();
  }, [loadNextSession]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadNextSession();
    }, [loadNextSession])
  );

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to Fitness tab
      navigation.navigate('Fitness' as never);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="barbell" size={20} color={DAY_INDICATOR_COLORS.GYM} />
          <Text style={styles.title}>Next Gym Session</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={DAY_INDICATOR_COLORS.GYM} />
        </View>
      </View>
    );
  }

  if (!nextSession) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.header}>
          <Ionicons name="barbell" size={20} color={DAY_INDICATOR_COLORS.GYM} />
          <Text style={styles.title}>Next Gym Session</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No upcoming gym sessions</Text>
          <Text style={styles.emptySubtext}>Tap to schedule a workout</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const focusAreas = nextSession.focusAreas || [];
  const formattedDate = formatWorkoutDate(nextSession.date, 'relative');

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Ionicons name="barbell" size={20} color={DAY_INDICATOR_COLORS.GYM} />
        <Text style={styles.title}>Next Gym Session</Text>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {focusAreas.length > 0 ? (
          <View style={styles.focusAreasContainer}>
            <Text style={styles.focusLabel}>Focus Areas:</Text>
            <View style={styles.focusTags}>
              {focusAreas.map((area, index) => (
                <View key={index} style={styles.focusTag}>
                  <Text style={styles.focusTagText}>
                    {getMuscleGroupDisplayName(area)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.noFocusText}>General workout</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.tapHint}>Tap to view details</Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: DAY_INDICATOR_COLORS.GYM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  dateContainer: {
    backgroundColor: DAY_INDICATOR_COLORS.GYM + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: DAY_INDICATOR_COLORS.GYM,
  },
  content: {
    marginBottom: 12,
  },
  focusAreasContainer: {
    flexDirection: 'column',
  },
  focusLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  focusTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  focusTagText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  noFocusText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  tapHint: {
    fontSize: 12,
    color: '#999',
    marginRight: 4,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
  },
});

export default NextGymSessionCard;
