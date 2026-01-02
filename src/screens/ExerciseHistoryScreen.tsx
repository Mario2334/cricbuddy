import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FitnessStackParamList } from '../types/navigation';
import { ExerciseLog, MuscleGroup } from '../types/fitness';
import { fitnessService } from '../services/fitnessService';

type Props = StackScreenProps<FitnessStackParamList, 'ExerciseHistory'>;

/**
 * Exercise with workout date for history display
 */
interface ExerciseWithDate extends ExerciseLog {
  workoutDate: string;
}

/**
 * Unique exercise entry for the list
 */
interface UniqueExercise {
  name: string;
  targetGroup: MuscleGroup;
  totalSessions: number;
  lastPerformed: string;
}

/**
 * Data point for the progression chart
 */
interface ProgressionDataPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;
const CHART_PADDING = 40;

/**
 * ExerciseHistoryScreen
 * 
 * Screen for viewing exercise history and progression:
 * - List of all performed exercises
 * - Weight progression charts per exercise
 * - Personal record display
 * 
 * Requirements: 10.1, 10.2, 10.3
 */
const ExerciseHistoryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { exerciseName: initialExercise } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exercises, setExercises] = useState<UniqueExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(initialExercise || null);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseWithDate[]>([]);
  const [personalRecord, setPersonalRecord] = useState<number>(0);


  /**
   * Load all unique exercises from workout history
   * Requirements: 10.1
   */
  const loadExercises = useCallback(async () => {
    try {
      const history = await fitnessService.getWorkoutHistory();
      const exerciseMap = new Map<string, UniqueExercise>();

      // Iterate through all workouts to collect unique exercises
      Object.entries(history).forEach(([date, workout]) => {
        workout.exercises.forEach(exercise => {
          const existing = exerciseMap.get(exercise.exerciseName);
          
          if (existing) {
            existing.totalSessions += 1;
            if (date > existing.lastPerformed) {
              existing.lastPerformed = date;
            }
          } else {
            exerciseMap.set(exercise.exerciseName, {
              name: exercise.exerciseName,
              targetGroup: exercise.targetGroup,
              totalSessions: 1,
              lastPerformed: date,
            });
          }
        });
      });

      // Convert to array and sort by last performed date (most recent first)
      const exerciseList = Array.from(exerciseMap.values())
        .sort((a, b) => b.lastPerformed.localeCompare(a.lastPerformed));

      setExercises(exerciseList);
    } catch (error) {
      console.error('ExerciseHistoryScreen: Failed to load exercises:', error);
    }
  }, []);

  /**
   * Load history for a specific exercise
   * Requirements: 10.2
   */
  const loadExerciseHistory = useCallback(async (exerciseName: string) => {
    try {
      const history = await fitnessService.getExerciseHistory(exerciseName);
      setExerciseHistory(history);

      // Get personal record
      const pr = await fitnessService.getPersonalRecord(exerciseName);
      setPersonalRecord(pr);
    } catch (error) {
      console.error('ExerciseHistoryScreen: Failed to load exercise history:', error);
    }
  }, []);

  /**
   * Load data on screen focus
   */
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      await loadExercises();
      
      if (selectedExercise) {
        await loadExerciseHistory(selectedExercise);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadExercises, loadExerciseHistory, selectedExercise]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  /**
   * Handle exercise selection
   */
  const handleExerciseSelect = useCallback(async (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    await loadExerciseHistory(exerciseName);
  }, [loadExerciseHistory]);

  /**
   * Handle back to list
   */
  const handleBackToList = useCallback(() => {
    setSelectedExercise(null);
    setExerciseHistory([]);
    setPersonalRecord(0);
  }, []);

  /**
   * Calculate progression data points for the chart
   * Requirements: 10.2
   */
  const progressionData = useMemo((): ProgressionDataPoint[] => {
    return exerciseHistory.map(log => {
      const maxWeight = Math.max(...log.sets.map(s => s.weight), 0);
      const totalVolume = log.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
      
      return {
        date: log.workoutDate,
        maxWeight,
        totalVolume,
      };
    });
  }, [exerciseHistory]);

  /**
   * Format date for display
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  /**
   * Format date for full display
   */
  const formatFullDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  /**
   * Get muscle group color
   */
  const getMuscleGroupColor = (group: MuscleGroup): string => {
    const colors: Record<MuscleGroup, string> = {
      LEGS: '#e74c3c',
      SHOULDERS: '#9b59b6',
      CHEST: '#3498db',
      TRICEPS: '#1abc9c',
      BACK: '#2ecc71',
      BICEPS: '#f39c12',
      CORE: '#e67e22',
      CARDIO: '#e91e63',
    };
    return colors[group] || '#95a5a6';
  };


  /**
   * Render the progression chart
   * Requirements: 10.2
   */
  const renderProgressionChart = () => {
    if (progressionData.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
          <Text style={styles.emptyChartText}>No data to display</Text>
        </View>
      );
    }

    const maxWeight = Math.max(...progressionData.map(d => d.maxWeight), 1);
    const chartWidth = SCREEN_WIDTH - 32 - CHART_PADDING;
    const barWidth = Math.min(40, (chartWidth - 20) / progressionData.length - 8);
    
    // Find the PR data point
    const prIndex = progressionData.findIndex(d => d.maxWeight === personalRecord);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weight Progression (kg)</Text>
        
        {/* Y-axis labels */}
        <View style={styles.chartWrapper}>
          <View style={styles.yAxis}>
            <Text style={styles.yAxisLabel}>{maxWeight}</Text>
            <Text style={styles.yAxisLabel}>{Math.round(maxWeight / 2)}</Text>
            <Text style={styles.yAxisLabel}>0</Text>
          </View>
          
          {/* Chart area */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContent}
          >
            <View style={styles.chartArea}>
              {/* Grid lines */}
              <View style={[styles.gridLine, { top: 0 }]} />
              <View style={[styles.gridLine, { top: CHART_HEIGHT / 2 }]} />
              <View style={[styles.gridLine, { top: CHART_HEIGHT }]} />
              
              {/* Bars */}
              <View style={styles.barsContainer}>
                {progressionData.map((point, index) => {
                  const barHeight = (point.maxWeight / maxWeight) * CHART_HEIGHT;
                  const isPR = index === prIndex && personalRecord > 0;
                  
                  return (
                    <View key={point.date} style={styles.barWrapper}>
                      <View style={styles.barColumn}>
                        {isPR && (
                          <View style={styles.prBadge}>
                            <Ionicons name="trophy" size={12} color="#f39c12" />
                          </View>
                        )}
                        <View
                          style={[
                            styles.bar,
                            {
                              height: barHeight,
                              width: barWidth,
                              backgroundColor: isPR ? '#f39c12' : '#3498db',
                            },
                          ]}
                        />
                        <Text style={styles.barValue}>{point.maxWeight}</Text>
                      </View>
                      <Text style={styles.barLabel}>{formatDate(point.date)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  /**
   * Render personal record badge
   * Requirements: 10.3
   */
  const renderPersonalRecordBadge = () => {
    if (personalRecord === 0) return null;

    return (
      <View style={styles.prCard}>
        <View style={styles.prIconContainer}>
          <Ionicons name="trophy" size={32} color="#f39c12" />
        </View>
        <View style={styles.prInfo}>
          <Text style={styles.prLabel}>Personal Record</Text>
          <Text style={styles.prValue}>{personalRecord} kg</Text>
        </View>
      </View>
    );
  };

  /**
   * Render exercise history list
   */
  const renderHistoryList = () => {
    if (exerciseHistory.length === 0) {
      return (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryText}>No history available</Text>
        </View>
      );
    }

    return (
      <View style={styles.historyList}>
        <Text style={styles.sectionTitle}>Session History</Text>
        {exerciseHistory.map((log, index) => (
          <View key={`${log.workoutDate}-${index}`} style={styles.historyItem}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>{formatFullDate(log.workoutDate)}</Text>
              <Text style={styles.historySets}>{log.sets.length} sets</Text>
            </View>
            <View style={styles.setsContainer}>
              {log.sets.map((set, setIndex) => (
                <View key={set.id} style={styles.setItem}>
                  <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                  <Text style={styles.setDetails}>
                    {set.weight} kg × {set.reps} reps
                  </Text>
                  {set.weight === personalRecord && (
                    <Ionicons name="trophy" size={14} color="#f39c12" />
                  )}
                </View>
              ))}
            </View>
            {log.notes && (
              <Text style={styles.historyNotes}>{log.notes}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };


  /**
   * Render exercise list view
   * Requirements: 10.1
   */
  const renderExerciseList = () => {
    if (exercises.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="barbell-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Exercises Yet</Text>
          <Text style={styles.emptyStateText}>
            Start logging workouts to see your exercise history here
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('FitnessDashboard')}
          >
            <Text style={styles.startButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Group exercises by muscle group
    const groupedExercises = exercises.reduce((acc, exercise) => {
      const group = exercise.targetGroup;
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(exercise);
      return acc;
    }, {} as Record<MuscleGroup, UniqueExercise[]>);

    return (
      <View style={styles.exerciseListContainer}>
        <Text style={styles.pageTitle}>Exercise History</Text>
        <Text style={styles.pageSubtitle}>
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} tracked
        </Text>

        {Object.entries(groupedExercises).map(([group, groupExercises]) => (
          <View key={group} style={styles.muscleGroupSection}>
            <View style={styles.muscleGroupHeader}>
              <View
                style={[
                  styles.muscleGroupIndicator,
                  { backgroundColor: getMuscleGroupColor(group as MuscleGroup) },
                ]}
              />
              <Text style={styles.muscleGroupTitle}>{group}</Text>
              <Text style={styles.muscleGroupCount}>
                {groupExercises.length} exercise{groupExercises.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {groupExercises.map(exercise => (
              <TouchableOpacity
                key={exercise.name}
                style={styles.exerciseItem}
                onPress={() => handleExerciseSelect(exercise.name)}
              >
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exercise.totalSessions} session{exercise.totalSessions !== 1 ? 's' : ''} • 
                    Last: {formatDate(exercise.lastPerformed)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render exercise detail view
   * Requirements: 10.2, 10.3
   */
  const renderExerciseDetail = () => {
    const exercise = exercises.find(e => e.name === selectedExercise);

    return (
      <View style={styles.detailContainer}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToList}
          >
            <Ionicons name="arrow-back" size={24} color="#3498db" />
          </TouchableOpacity>
          <View style={styles.detailTitleContainer}>
            <Text style={styles.detailTitle}>{selectedExercise}</Text>
            {exercise && (
              <View style={styles.detailMeta}>
                <View
                  style={[
                    styles.muscleGroupBadge,
                    { backgroundColor: getMuscleGroupColor(exercise.targetGroup) },
                  ]}
                >
                  <Text style={styles.muscleGroupBadgeText}>{exercise.targetGroup}</Text>
                </View>
                <Text style={styles.detailSessions}>
                  {exercise.totalSessions} session{exercise.totalSessions !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Personal Record */}
        {renderPersonalRecordBadge()}

        {/* Progression Chart */}
        {renderProgressionChart()}

        {/* History List */}
        {renderHistoryList()}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading exercise history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
      }
    >
      {selectedExercise ? renderExerciseDetail() : renderExerciseList()}
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

  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  startButton: {
    marginTop: 24,
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Exercise list styles
  exerciseListContainer: {
    padding: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  muscleGroupSection: {
    marginBottom: 24,
  },
  muscleGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  muscleGroupIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  muscleGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  muscleGroupCount: {
    fontSize: 12,
    color: '#999',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  exerciseMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },

  // Detail view styles
  detailContainer: {
    padding: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  detailTitleContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  muscleGroupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  muscleGroupBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailSessions: {
    fontSize: 14,
    color: '#666',
  },

  // PR card styles
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  prIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  prInfo: {
    flex: 1,
  },
  prLabel: {
    fontSize: 14,
    color: '#666',
  },
  prValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f39c12',
  },


  // Chart styles
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chartWrapper: {
    flexDirection: 'row',
  },
  yAxis: {
    width: CHART_PADDING - 8,
    height: CHART_HEIGHT + 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#999',
  },
  chartScrollContent: {
    paddingRight: 16,
  },
  chartArea: {
    height: CHART_HEIGHT + 30,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#eee',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    paddingTop: 20,
  },
  barWrapper: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  barColumn: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  prBadge: {
    marginBottom: 4,
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },

  // History list styles
  historyList: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  historyItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historySets: {
    fontSize: 12,
    color: '#999',
  },
  setsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  setItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  setNumber: {
    width: 50,
    fontSize: 12,
    color: '#999',
  },
  setDetails: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  historyNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  emptyHistory: {
    padding: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#999',
  },
});

export default ExerciseHistoryScreen;
