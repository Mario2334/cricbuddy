import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { FitnessStackParamList } from '../types/navigation';
import {
  DailyWorkout,
  CardioLog,
  CardioType,
  IntensityLevel,
  ExerciseLog,
  ExerciseSet,
  MuscleGroup,
} from '../types/fitness';
import { fitnessService } from '../services/fitnessService';
import {
  generateUUID,
  addSetToExercise,
  removeSetFromExercise,
  updateSet,
  toggleSetCompletion,
} from '../utils/fitnessUtils';

type Props = StackScreenProps<FitnessStackParamList, 'ActiveWorkout'>;

type WorkoutPhase = 'focus' | 'cardio' | 'strength' | 'core';

const PHASES_WITH_FOCUS: WorkoutPhase[] = ['focus', 'cardio', 'strength', 'core'];
const PHASES_WITHOUT_FOCUS: WorkoutPhase[] = ['cardio', 'strength', 'core'];
const PHASE_LABELS: Record<WorkoutPhase, string> = {
  focus: 'Focus',
  cardio: 'Cardio',
  strength: 'Strength',
  core: 'Core',
};

const STRENGTH_MUSCLE_GROUPS: MuscleGroup[] = ['LEGS', 'SHOULDERS', 'CHEST', 'TRICEPS', 'BACK', 'BICEPS'];

const CORE_EXERCISES = [
  { id: 'plank', name: 'Plank', icon: 'body' },
  { id: 'russian-twists', name: 'Russian Twists', icon: 'sync' },
  { id: 'leg-raises', name: 'Leg Raises', icon: 'arrow-up' },
  { id: 'crunches', name: 'Crunches', icon: 'fitness' },
  { id: 'mountain-climbers', name: 'Mountain Climbers', icon: 'walk' },
];

const EXERCISES_BY_GROUP: Record<MuscleGroup, string[]> = {
  LEGS: ['Barbell Squats', 'Leg Press', 'Lunges', 'Leg Curls', 'Calf Raises'],
  SHOULDERS: ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Rear Delt Flyes', 'Shrugs'],
  CHEST: ['Bench Press', 'Incline Press', 'Dumbbell Flyes', 'Push-ups', 'Cable Crossovers'],
  TRICEPS: ['Tricep Dips', 'Skull Crushers', 'Tricep Pushdowns', 'Close-Grip Bench', 'Overhead Extensions'],
  BACK: ['Deadlifts', 'Pull-ups', 'Barbell Rows', 'Lat Pulldowns', 'Seated Rows'],
  BICEPS: ['Barbell Curls', 'Dumbbell Curls', 'Hammer Curls', 'Preacher Curls', 'Concentration Curls'],
  CORE: ['Plank', 'Russian Twists', 'Leg Raises', 'Crunches', 'Ab Wheel'],
  CARDIO: ['Treadmill', 'Cycling', 'Rowing', 'Jump Rope', 'Elliptical'],
};

function getMuscleGroupColor(group: MuscleGroup): string {
  const colors: Record<MuscleGroup, string> = {
    LEGS: '#8B5CF6', SHOULDERS: '#EC4899', CHEST: '#EF4444', TRICEPS: '#F97316',
    BACK: '#14B8A6', BICEPS: '#3B82F6', CORE: '#10B981', CARDIO: '#6366F1',
  };
  return colors[group] || '#6B7280';
}

function initializeExercises(areas: MuscleGroup[]): ExerciseLog[] {
  const exerciseList: ExerciseLog[] = [];
  areas.forEach(area => {
    if (area !== 'CARDIO' && area !== 'CORE') {
      const areaExercises = EXERCISES_BY_GROUP[area] || [];
      areaExercises.slice(0, 3).forEach(exerciseName => {
        exerciseList.push({
          id: generateUUID(),
          exerciseName,
          targetGroup: area,
          sets: [],
        });
      });
    }
  });
  return exerciseList;
}

/**
 * ActiveWorkoutScreen - Step-wizard for logging workouts
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5
 */
const ActiveWorkoutScreen: React.FC<Props> = ({ route, navigation }) => {
  const { date, focusAreas: initialFocusAreas, existingWorkout } = route.params;

  // Determine if we need the focus selection phase
  const needsFocusSelection = !existingWorkout && initialFocusAreas.length === 0;
  const PHASES = needsFocusSelection ? PHASES_WITH_FOCUS : PHASES_WITHOUT_FOCUS;

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const currentPhase = PHASES[currentPhaseIndex];
  
  // Selected focus areas (for new workouts without pre-selected areas)
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<MuscleGroup[]>(initialFocusAreas);
  const focusAreas = selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas;

  const [cardioType, setCardioType] = useState<CardioType>(existingWorkout?.cardio?.type || 'RUNNING');
  const [cardioDuration, setCardioDuration] = useState<string>(
    existingWorkout?.cardio?.durationMinutes?.toString() || ''
  );
  const [cardioDistance, setCardioDistance] = useState<string>(
    existingWorkout?.cardio?.distanceKm?.toString() || ''
  );
  const [cardioIntensity, setCardioIntensity] = useState<IntensityLevel>(
    existingWorkout?.cardio?.intensity || 'MODERATE'
  );

  const [exercises, setExercises] = useState<ExerciseLog[]>(() => {
    if (existingWorkout?.exercises?.length) return existingWorkout.exercises;
    if (initialFocusAreas.length > 0) return initializeExercises(initialFocusAreas);
    return []; // Will be initialized after focus selection
  });

  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [coreCompleted, setCoreCompleted] = useState<Set<string>>(
    new Set(existingWorkout?.coreCompleted || [])
  );
  const [isSaving, setIsSaving] = useState(false);

  const validateCardio = useCallback((): boolean => {
    const duration = parseInt(cardioDuration, 10);
    if (!cardioDuration || isNaN(duration) || duration <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid duration in minutes.');
      return false;
    }
    if (cardioDistance) {
      const distance = parseFloat(cardioDistance);
      if (isNaN(distance) || distance < 0) {
        Alert.alert('Invalid Input', 'Please enter a valid distance.');
        return false;
      }
    }
    return true;
  }, [cardioDuration, cardioDistance]);

  const validateFocusAreas = useCallback((): boolean => {
    if (selectedFocusAreas.length === 0) {
      Alert.alert('Select Focus Areas', 'Please select at least one muscle group to focus on.');
      return false;
    }
    return true;
  }, [selectedFocusAreas]);

  const handleToggleFocusArea = useCallback((area: MuscleGroup) => {
    setSelectedFocusAreas(prev => {
      if (prev.includes(area)) {
        return prev.filter(a => a !== area);
      }
      return [...prev, area];
    });
  }, []);

  const handleNext = useCallback(() => {
    if (currentPhase === 'focus') {
      if (!validateFocusAreas()) return;
      // Initialize exercises based on selected focus areas
      setExercises(initializeExercises(selectedFocusAreas));
    }
    if (currentPhase === 'cardio' && !validateCardio()) return;
    if (currentPhaseIndex < PHASES.length - 1) setCurrentPhaseIndex(currentPhaseIndex + 1);
  }, [currentPhase, currentPhaseIndex, validateCardio, validateFocusAreas, selectedFocusAreas, PHASES.length]);

  const handleBack = useCallback(() => {
    if (currentPhaseIndex > 0) setCurrentPhaseIndex(currentPhaseIndex - 1);
  }, [currentPhaseIndex]);

  const toggleExerciseExpanded = useCallback((exerciseId: string) => {
    setExpandedExercises(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  }, []);

  const handleAddSet = useCallback((exerciseId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id === exerciseId) {
        const lastSet = ex.sets[ex.sets.length - 1];
        return addSetToExercise(ex, { weight: lastSet?.weight || 0, reps: lastSet?.reps || 10 });
      }
      return ex;
    }));
  }, []);

  const handleRemoveSet = useCallback((exerciseId: string, setId: string) => {
    setExercises(prev => prev.map(ex => ex.id === exerciseId ? removeSetFromExercise(ex, setId) : ex));
  }, []);

  const handleUpdateSet = useCallback((
    exerciseId: string, setId: string, updates: Partial<Pick<ExerciseSet, 'weight' | 'reps'>>
  ) => {
    setExercises(prev => prev.map(ex => ex.id === exerciseId ? updateSet(ex, setId, updates) : ex));
  }, []);

  const handleToggleSetCompletion = useCallback((exerciseId: string, setId: string) => {
    setExercises(prev => prev.map(ex => ex.id === exerciseId ? toggleSetCompletion(ex, setId) : ex));
  }, []);

  const handleToggleCoreExercise = useCallback((exerciseId: string) => {
    setCoreCompleted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  }, []);

  const buildCardioLog = useCallback((): CardioLog | undefined => {
    const duration = parseInt(cardioDuration, 10);
    if (!duration || duration <= 0) return undefined;
    const log: CardioLog = { type: cardioType, durationMinutes: duration, intensity: cardioIntensity };
    if (cardioDistance) {
      const distance = parseFloat(cardioDistance);
      if (!isNaN(distance) && distance > 0) log.distanceKm = distance;
    }
    return log;
  }, [cardioType, cardioDuration, cardioDistance, cardioIntensity]);

  const handleFinishWorkout = useCallback(async () => {
    setIsSaving(true);
    try {
      const workout: DailyWorkout = {
        id: existingWorkout?.id || generateUUID(),
        date,
        type: 'GYM',
        focusAreas: selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas,
        cardio: buildCardioLog(),
        exercises: exercises.filter(ex => ex.sets.length > 0),
        coreCompleted: Array.from(coreCompleted),
        isRestDay: false,
        createdAt: existingWorkout?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await fitnessService.saveWorkout(workout);
      Alert.alert('Workout Saved', 'Your workout has been logged successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      console.error('Failed to save workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [date, selectedFocusAreas, initialFocusAreas, exercises, coreCompleted, existingWorkout, buildCardioLog, navigation]);

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {PHASES.map((phase, index) => {
        const isActive = index === currentPhaseIndex;
        const isCompleted = index < currentPhaseIndex;
        return (
          <React.Fragment key={phase}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isCompleted && styles.stepCircleCompleted]}>
                {isCompleted ? <Ionicons name="checkmark" size={16} color="#fff" /> :
                  <Text style={[styles.stepNumber, (isActive || isCompleted) && styles.stepNumberActive]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{PHASE_LABELS[phase]}</Text>
            </View>
            {index < PHASES.length - 1 && <View style={[styles.stepConnector, isCompleted && styles.stepConnectorCompleted]} />}
          </React.Fragment>
        );
      })}
    </View>
  );

  const renderFocusPhase = () => (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.phaseTitle}>Select Focus Areas</Text>
      <Text style={styles.phaseSubtitle}>Choose the muscle groups you want to train today</Text>
      <View style={styles.focusAreaGrid}>
        {STRENGTH_MUSCLE_GROUPS.map(area => {
          const isSelected = selectedFocusAreas.includes(area);
          return (
            <TouchableOpacity
              key={area}
              style={[
                styles.focusAreaButton,
                isSelected && styles.focusAreaButtonSelected,
                isSelected && { backgroundColor: getMuscleGroupColor(area) },
              ]}
              onPress={() => handleToggleFocusArea(area)}
            >
              <View style={[
                styles.focusAreaIcon,
                isSelected && styles.focusAreaIconSelected,
              ]}>
                <Ionicons
                  name={isSelected ? 'checkmark' : 'fitness'}
                  size={24}
                  color={isSelected ? '#fff' : getMuscleGroupColor(area)}
                />
              </View>
              <Text style={[
                styles.focusAreaLabel,
                isSelected && styles.focusAreaLabelSelected,
              ]}>
                {area}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selectedFocusAreas.length > 0 && (
        <View style={styles.selectedSummary}>
          <Text style={styles.selectedSummaryText}>
            Selected: {selectedFocusAreas.join(', ')}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderCardioPhase = () => (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.phaseTitle}>Cardio Warm-up</Text>
      <Text style={styles.phaseSubtitle}>Log your cardio session</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Type</Text>
        <View style={styles.cardioTypeRow}>
          {(['RUNNING', 'SWIMMING', 'CYCLING'] as CardioType[]).map(type => (
            <TouchableOpacity key={type} style={[styles.cardioTypeButton, cardioType === type && styles.cardioTypeButtonActive]}
              onPress={() => setCardioType(type)}>
              <Ionicons name={type === 'RUNNING' ? 'walk' : type === 'SWIMMING' ? 'water' : 'bicycle'} size={24}
                color={cardioType === type ? '#fff' : '#666'} />
              <Text style={[styles.cardioTypeText, cardioType === type && styles.cardioTypeTextActive]}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Duration (minutes) *</Text>
        <View style={styles.largeInputContainer}>
          <TextInput style={styles.largeInput} value={cardioDuration} onChangeText={setCardioDuration}
            keyboardType="numeric" placeholder="0" placeholderTextColor="#ccc" />
          <Text style={styles.inputUnit}>min</Text>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Distance (km) - Optional</Text>
        <View style={styles.largeInputContainer}>
          <TextInput style={styles.largeInput} value={cardioDistance} onChangeText={setCardioDistance}
            keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor="#ccc" />
          <Text style={styles.inputUnit}>km</Text>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Intensity</Text>
        <View style={styles.intensityRow}>
          {(['LOW', 'MODERATE', 'HIGH'] as IntensityLevel[]).map(level => (
            <TouchableOpacity key={level} style={[styles.intensityButton, cardioIntensity === level && styles.intensityButtonActive,
              cardioIntensity === level && { backgroundColor: level === 'LOW' ? '#4CAF50' : level === 'MODERATE' ? '#FF9800' : '#F44336' }]}
              onPress={() => setCardioIntensity(level)}>
              <Text style={[styles.intensityText, cardioIntensity === level && styles.intensityTextActive]}>{level}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderSetRow = (exercise: ExerciseLog, set: ExerciseSet, setIndex: number) => {
    const renderRightActions = () => (
      <TouchableOpacity style={styles.deleteSetButton} onPress={() => handleRemoveSet(exercise.id, set.id)}>
        <Ionicons name="trash" size={20} color="#fff" />
      </TouchableOpacity>
    );
    return (
      <Swipeable key={set.id} renderRightActions={renderRightActions} rightThreshold={40}>
        <View style={[styles.setRow, set.completed && styles.setRowCompleted]}>
          <TouchableOpacity style={[styles.setCheckbox, set.completed && styles.setCheckboxChecked]}
            onPress={() => handleToggleSetCompletion(exercise.id, set.id)}>
            {set.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
          <View style={styles.setInputGroup}>
            <TextInput style={styles.setInput} value={set.weight.toString()}
              onChangeText={(text) => handleUpdateSet(exercise.id, set.id, { weight: parseFloat(text) || 0 })}
              keyboardType="decimal-pad" placeholder="0" />
            <Text style={styles.setInputLabel}>kg</Text>
          </View>
          <Text style={styles.setMultiplier}>×</Text>
          <View style={styles.setInputGroup}>
            <TextInput style={styles.setInput} value={set.reps.toString()}
              onChangeText={(text) => handleUpdateSet(exercise.id, set.id, { reps: parseInt(text, 10) || 0 })}
              keyboardType="numeric" placeholder="0" />
            <Text style={styles.setInputLabel}>reps</Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  const renderStrengthPhase = () => (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.phaseTitle}>Strength Training</Text>
      <Text style={styles.phaseSubtitle}>Focus: {(selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas).filter(a => a !== 'CARDIO' && a !== 'CORE').join(', ') || 'General'}</Text>
      {exercises.length === 0 ? (
        <View style={styles.emptyExercises}>
          <Ionicons name="barbell-outline" size={48} color="#ccc" />
          <Text style={styles.emptyExercisesText}>No exercises added</Text>
          <Text style={styles.emptyExercisesSubtext}>Go back and select focus areas to get exercise suggestions</Text>
        </View>
      ) : (
        exercises.map(exercise => {
          const isExpanded = expandedExercises.has(exercise.id);
          return (
            <View key={exercise.id} style={styles.exerciseCard}>
              <TouchableOpacity style={styles.exerciseHeader} onPress={() => toggleExerciseExpanded(exercise.id)}>
                <View style={styles.exerciseHeaderLeft}>
                  <View style={[styles.muscleGroupBadge, { backgroundColor: getMuscleGroupColor(exercise.targetGroup) }]}>
                    <Text style={styles.muscleGroupBadgeText}>{exercise.targetGroup.slice(0, 3)}</Text>
                  </View>
                  <View>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={styles.exerciseSetsCount}>{exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={24} color="#666" />
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.exerciseContent}>
                  {exercise.sets.map((set, index) => renderSetRow(exercise, set, index))}
                  <TouchableOpacity style={styles.addSetButton} onPress={() => handleAddSet(exercise.id)}>
                    <Ionicons name="add-circle-outline" size={20} color="#F97316" />
                    <Text style={styles.addSetButtonText}>Add Set</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const renderCorePhase = () => (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.phaseTitle}>Core Finisher</Text>
      <Text style={styles.phaseSubtitle}>Complete your core exercises</Text>
      <View style={styles.coreExercisesList}>
        {CORE_EXERCISES.map(exercise => {
          const isCompleted = coreCompleted.has(exercise.id);
          return (
            <TouchableOpacity key={exercise.id} style={[styles.coreExerciseItem, isCompleted && styles.coreExerciseItemCompleted]}
              onPress={() => handleToggleCoreExercise(exercise.id)}>
              <View style={[styles.coreCheckbox, isCompleted && styles.coreCheckboxChecked]}>
                {isCompleted && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Ionicons name={exercise.icon as any} size={24} color={isCompleted ? '#4CAF50' : '#666'} style={styles.coreExerciseIcon} />
              <Text style={[styles.coreExerciseName, isCompleted && styles.coreExerciseNameCompleted]}>{exercise.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.coreProgress}>
        <Text style={styles.coreProgressText}>{coreCompleted.size} of {CORE_EXERCISES.length} completed</Text>
        <View style={styles.coreProgressBar}>
          <View style={[styles.coreProgressFill, { width: `${(coreCompleted.size / CORE_EXERCISES.length) * 100}%` }]} />
        </View>
      </View>
    </ScrollView>
  );

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'focus': return renderFocusPhase();
      case 'cardio': return renderCardioPhase();
      case 'strength': return renderStrengthPhase();
      case 'core': return renderCorePhase();
      default: return null;
    }
  };

  const renderFooter = () => (
    <View style={styles.footer}>
      {currentPhaseIndex > 0 && (
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.footerSpacer} />
      {currentPhaseIndex < PHASES.length - 1 ? (
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.finishButton, isSaving && styles.finishButtonDisabled]}
          onPress={handleFinishWorkout} disabled={isSaving}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.finishButtonText}>{isSaving ? 'Saving...' : 'Finish Workout'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderStepIndicator()}
        {renderPhaseContent()}
        {renderFooter()}
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepCircleActive: { backgroundColor: '#F97316' },
  stepCircleCompleted: { backgroundColor: '#4CAF50' },
  stepNumber: { fontSize: 14, fontWeight: '600', color: '#666' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 12, color: '#666' },
  stepLabelActive: { color: '#F97316', fontWeight: '600' },
  stepConnector: { width: 40, height: 2, backgroundColor: '#e0e0e0', marginHorizontal: 8, marginBottom: 20 },
  stepConnectorCompleted: { backgroundColor: '#4CAF50' },
  phaseContent: { flex: 1, padding: 16 },
  phaseTitle: { fontSize: 24, fontWeight: '700', color: '#333', marginBottom: 4 },
  phaseSubtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  // Focus phase styles
  focusAreaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  focusAreaButton: { width: '48%', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0' },
  focusAreaButtonSelected: { borderColor: 'transparent' },
  focusAreaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  focusAreaIconSelected: { backgroundColor: 'rgba(255,255,255,0.3)' },
  focusAreaLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  focusAreaLabelSelected: { color: '#fff' },
  selectedSummary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8 },
  selectedSummaryText: { fontSize: 14, color: '#666', textAlign: 'center' },
  // Input styles
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  largeInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  largeInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#333', textAlign: 'center' },
  inputUnit: { fontSize: 18, color: '#666', marginLeft: 8 },
  cardioTypeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardioTypeButton: { flex: 1, alignItems: 'center', paddingVertical: 16, marginHorizontal: 4, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  cardioTypeButtonActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  cardioTypeText: { fontSize: 12, color: '#666', marginTop: 4 },
  cardioTypeTextActive: { color: '#fff' },
  intensityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityButton: { flex: 1, alignItems: 'center', paddingVertical: 14, marginHorizontal: 4, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  intensityButtonActive: { borderColor: 'transparent' },
  intensityText: { fontSize: 14, fontWeight: '600', color: '#666' },
  intensityTextActive: { color: '#fff' },
  exerciseCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  exerciseHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  muscleGroupBadge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  muscleGroupBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  exerciseName: { fontSize: 16, fontWeight: '600', color: '#333' },
  exerciseSetsCount: { fontSize: 12, color: '#666', marginTop: 2 },
  exerciseContent: { borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingVertical: 8 },
  emptyExercises: { alignItems: 'center', paddingVertical: 48 },
  emptyExercisesText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptyExercisesSubtext: { fontSize: 14, color: '#999', marginTop: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fff' },
  setRowCompleted: { backgroundColor: '#f0fdf4' },
  setCheckbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  setCheckboxChecked: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  setNumber: { fontSize: 14, color: '#666', width: 50 },
  setInputGroup: { flexDirection: 'row', alignItems: 'center' },
  setInput: { width: 60, height: 36, backgroundColor: '#f5f5f5', borderRadius: 8, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333' },
  setInputLabel: { fontSize: 12, color: '#666', marginLeft: 4, width: 30 },
  setMultiplier: { fontSize: 16, color: '#666', marginHorizontal: 8 },
  deleteSetButton: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 60, height: '100%' },
  addSetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 16, marginVertical: 8, borderWidth: 1, borderColor: '#F97316', borderRadius: 8, borderStyle: 'dashed' },
  addSetButtonText: { fontSize: 14, color: '#F97316', fontWeight: '600', marginLeft: 8 },
  coreExercisesList: { marginBottom: 24 },
  coreExerciseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  coreExerciseItemCompleted: { backgroundColor: '#f0fdf4', borderColor: '#4CAF50' },
  coreCheckbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  coreCheckboxChecked: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  coreExerciseIcon: { marginRight: 12 },
  coreExerciseName: { fontSize: 16, color: '#333', fontWeight: '500' },
  coreExerciseNameCompleted: { color: '#4CAF50' },
  coreProgress: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  coreProgressText: { fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'center' },
  coreProgressBar: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  coreProgressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  footerSpacer: { flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  backButtonText: { fontSize: 16, color: '#666', marginLeft: 4 },
  nextButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F97316', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginRight: 4 },
  finishButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  finishButtonDisabled: { opacity: 0.6 },
  finishButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
});

export default ActiveWorkoutScreen;
