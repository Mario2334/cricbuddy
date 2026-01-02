import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { FitnessStackParamList } from '../types/navigation';
import { templateService } from '../services/templateService';
import { MuscleGroup, ExerciseDefinition, WarmUpExercise, CoreExercise } from '../types/fitness';

type Props = StackScreenProps<FitnessStackParamList, 'WorkoutTemplateDetail'>;

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
 * Format duration for display
 */
function formatDuration(exercise: WarmUpExercise): string {
  if (exercise.durationMins) {
    return `${exercise.durationMins} min`;
  }
  if (exercise.durationSecs) {
    return `${exercise.durationSecs}s`;
  }
  if (exercise.reps) {
    return `${exercise.reps} reps`;
  }
  return '';
}

/**
 * Format sets/reps for exercise display
 */
function formatSetsReps(exercise: ExerciseDefinition): string {
  const sets = exercise.defaultSets;
  if (exercise.defaultReps && exercise.defaultReps.length > 0) {
    const repsDisplay = exercise.defaultReps.join('/');
    return `${sets} sets × ${repsDisplay} reps`;
  }
  return `${sets} sets`;
}

/**
 * Format core exercise info
 */
function formatCoreExercise(exercise: CoreExercise): string {
  const sets = exercise.defaultSets;
  if (exercise.durationSecs) {
    return `${sets} sets × ${exercise.durationSecs}s`;
  }
  if (exercise.defaultReps && exercise.defaultReps.length > 0) {
    return `${sets} sets × ${exercise.defaultReps.join('/')} reps`;
  }
  return `${sets} sets`;
}

/**
 * WorkoutTemplateDetailScreen
 * 
 * Displays template name and focus areas.
 * Lists all exercises with sets/reps info.
 * Shows warm-up and stretch sections.
 * Provides "Start Workout" button.
 * 
 * Requirements: 3.3, 3.4, 4.1
 */
const WorkoutTemplateDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { templateId } = route.params;
  
  const template = useMemo(() => templateService.getTemplateById(templateId), [templateId]);

  if (!template) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Template not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleStartWorkout = () => {
    const today = new Date().toISOString().split('T')[0];
    const workout = templateService.createWorkoutFromTemplate(template, today);
    
    navigation.navigate('ActiveWorkout', {
      date: today,
      focusAreas: workout.focusAreas || [],
      existingWorkout: workout,
    });
  };

  const renderWarmUpSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="flame" size={20} color="#F97316" />
        <Text style={styles.sectionTitle}>Warm-Up</Text>
      </View>
      
      {/* Cardio */}
      <View style={styles.warmUpItem}>
        <View style={styles.warmUpIcon}>
          <Ionicons name="bicycle" size={18} color="#6366F1" />
        </View>
        <Text style={styles.warmUpName}>{template.warmUp.cardio.name}</Text>
        <Text style={styles.warmUpDuration}>
          {formatDuration(template.warmUp.cardio)}
        </Text>
      </View>

      {/* Circuit */}
      <Text style={styles.circuitLabel}>Circuit:</Text>
      {template.warmUp.circuit.map((exercise, index) => (
        <View key={index} style={styles.warmUpItem}>
          <View style={styles.warmUpIcon}>
            <Ionicons name="repeat" size={18} color="#10B981" />
          </View>
          <Text style={styles.warmUpName}>{exercise.name}</Text>
          <Text style={styles.warmUpDuration}>{formatDuration(exercise)}</Text>
        </View>
      ))}
    </View>
  );

  const renderExercisesSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="barbell" size={20} color="#3B82F6" />
        <Text style={styles.sectionTitle}>
          Main Exercises ({template.exercises.length})
        </Text>
      </View>
      
      {template.exercises.map((exercise, index) => (
        <View key={index} style={styles.exerciseItem}>
          <View style={[styles.muscleGroupBadge, { backgroundColor: getMuscleGroupColor(exercise.targetGroup) }]}>
            <Text style={styles.muscleGroupText}>
              {exercise.targetGroup.slice(0, 3)}
            </Text>
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseSets}>{formatSetsReps(exercise)}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderCoreSection = () => {
    if (!template.core || template.core.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="fitness" size={20} color="#10B981" />
          <Text style={styles.sectionTitle}>Core ({template.core.length})</Text>
        </View>
        
        {template.core.map((exercise, index) => (
          <View key={index} style={styles.coreItem}>
            <View style={styles.coreIcon}>
              <Ionicons name="body" size={18} color="#10B981" />
            </View>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseSets}>{formatCoreExercise(exercise)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderStretchSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="body" size={20} color="#8B5CF6" />
        <Text style={styles.sectionTitle}>
          Stretching ({template.stretch.length})
        </Text>
      </View>
      
      {template.stretch.map((exercise, index) => (
        <View key={index} style={styles.warmUpItem}>
          <View style={styles.stretchIcon}>
            <Ionicons name="leaf" size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.warmUpName}>{exercise.name}</Text>
          <Text style={styles.warmUpDuration}>{formatDuration(exercise)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.templateName}>{template.name}</Text>
          <View style={styles.focusAreasContainer}>
            {template.focusAreas.map((area, index) => (
              <View
                key={index}
                style={[styles.focusAreaTag, { backgroundColor: getMuscleGroupColor(area) }]}
              >
                <Text style={styles.focusAreaText}>{area}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sections */}
        {renderWarmUpSection()}
        {renderExercisesSection()}
        {renderCoreSection()}
        {renderStretchSection()}
      </ScrollView>

      {/* Start Workout Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartWorkout}
          activeOpacity={0.8}
        >
          <Ionicons name="play-circle" size={24} color="#fff" />
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3498db',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  templateName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
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
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  circuitLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 8,
  },
  warmUpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  warmUpIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stretchIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  warmUpName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  warmUpDuration: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  muscleGroupBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  muscleGroupText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  exerciseSets: {
    fontSize: 13,
    color: '#666',
  },
  coreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  coreIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default WorkoutTemplateDetailScreen;
