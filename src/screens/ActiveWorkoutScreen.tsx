/**
 * ActiveWorkoutScreen - Interactive Workout Session Interface
 * 
 * A full-screen, timer-driven workout experience with:
 * - Prominent exercise and rest timers
 * - Phase-based visual themes (warmup: orange, strength: blue, core: green, cooldown: purple)
 * - Interactive controls with gesture support
 * - Apple Watch integration for health tracking
 * - Smooth transitions and visual feedback
 * 
 * Requirements: 1.1, 1.3, 1.5, 2.3, 4.5
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  Modal,
  Linking,
  Animated,
  Dimensions,
  StatusBar,
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
  WorkoutTemplate,
} from '../types/fitness';
import {
  ActiveTimer,
  WorkoutPhase,
  InteractiveSessionState,
  WorkoutTheme,
  PHASE_THEMES,
} from '../types/timer';
import { fitnessService } from '../services/fitnessService';
import { templateService } from '../services/templateService';
import {
  generateUUID,
  addSetToExercise,
  removeSetFromExercise,
  updateSet,
  toggleSetCompletion,
} from '../utils/fitnessUtils';
import { healthKitService } from '../services/healthKitService';
import { workoutSessionManager } from '../services/workoutSessionManager';
import { watchConnectivityService } from '../services/watchConnectivityService';
import { interactiveWorkoutSession, InteractiveWorkoutSession } from '../services/interactiveWorkoutSession';
import { TimerManager } from '../services/timerManager';
import { visualFeedbackManager } from '../services/visualFeedbackManager';
import { audioFeedbackManager } from '../services/audioFeedbackManager';
import { InteractiveTimer } from '../components/InteractiveTimer';
import { WorkoutProgressRing } from '../components/WorkoutProgressRing';
import { TimerControls } from '../components/TimerControls';
import type { AuthorizationStatus, WorkoutSummary, RealTimeMetrics, WatchConnectionState } from '../types/health';

type Props = StackScreenProps<FitnessStackParamList, 'ActiveWorkout'>;

// Screen dimensions for responsive layout
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Workout phases with and without focus selection
type WorkoutPhaseType = 'focus' | 'cardio' | 'warmup' | 'strength' | 'core' | 'cooldown';
const PHASES_WITH_FOCUS: WorkoutPhaseType[] = ['focus', 'cardio', 'warmup', 'strength', 'core', 'cooldown'];
const PHASES_WITHOUT_FOCUS: WorkoutPhaseType[] = ['cardio', 'warmup', 'strength', 'core', 'cooldown'];
const PHASE_LABELS: Record<WorkoutPhaseType, string> = {
  focus: 'Focus',
  cardio: 'Cardio',
  warmup: 'Warmup',
  strength: 'Strength',
  core: 'Core',
  cooldown: 'Cooldown',
};

const STRENGTH_MUSCLE_GROUPS: MuscleGroup[] = ['LEGS', 'SHOULDERS', 'CHEST', 'TRICEPS', 'BACK', 'BICEPS'];

// Map workout phase to timer phase
const mapPhaseToTimerPhase = (phase: WorkoutPhaseType): WorkoutPhase => {
  switch (phase) {
    case 'warmup':
    case 'cardio':
      return 'warmup';
    case 'strength':
      return 'strength';
    case 'core':
      return 'core';
    case 'cooldown':
      return 'cooldown';
    default:
      return 'warmup';
  }
};

/**
 * Get the matching template for selected focus areas
 */
function getTemplateForFocusAreas(focusAreas: MuscleGroup[]): WorkoutTemplate | undefined {
  const templates = templateService.getAllTemplates();
  
  const exactMatch = templates.find(t => {
    if (t.focusAreas.length !== focusAreas.length) return false;
    return t.focusAreas.every(area => focusAreas.includes(area));
  });
  
  if (exactMatch) return exactMatch;
  
  let bestMatch: WorkoutTemplate | undefined;
  let bestScore = 0;
  
  for (const template of templates) {
    const matchingAreas = template.focusAreas.filter(area => focusAreas.includes(area));
    if (matchingAreas.length > bestScore) {
      bestScore = matchingAreas.length;
      bestMatch = template;
    }
  }
  
  return bestMatch;
}

/**
 * Get core exercises from templates
 */
function getCoreExercisesFromTemplates(): { id: string; name: string; icon: string; duration?: number }[] {
  const templates = templateService.getAllTemplates();
  const coreExercises: { id: string; name: string; icon: string; duration?: number }[] = [];
  const seenNames = new Set<string>();
  
  for (const template of templates) {
    if (template.core) {
      for (const exercise of template.core) {
        if (!seenNames.has(exercise.name)) {
          seenNames.add(exercise.name);
          coreExercises.push({
            id: exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: exercise.name,
            icon: exercise.name.toLowerCase().includes('plank') ? 'body' : 
                  exercise.name.toLowerCase().includes('crunch') || exercise.name.toLowerCase().includes('bicycle') ? 'fitness' :
                  exercise.name.toLowerCase().includes('dead bug') ? 'bug' : 'body',
            duration: exercise.durationSecs,
          });
        }
      }
    }
  }
  
  if (coreExercises.length === 0) {
    return [
      { id: 'plank', name: 'Plank', icon: 'body', duration: 60 },
      { id: 'bicycle-crunches', name: 'Bicycle Crunches', icon: 'fitness' },
      { id: 'dead-bug', name: 'Dead Bug', icon: 'body', duration: 45 },
    ];
  }
  
  return coreExercises;
}

/**
 * Get warmup exercises from templates based on focus areas
 */
function getWarmupExercisesFromTemplates(focusAreas: MuscleGroup[]): { id: string; name: string; duration?: string; durationSecs?: number }[] {
  const template = getTemplateForFocusAreas(focusAreas);
  const warmupExercises: { id: string; name: string; duration?: string; durationSecs?: number }[] = [];
  
  if (template?.warmUp?.warmup) {
    for (const exercise of template.warmUp.warmup) {
      warmupExercises.push({
        id: exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: exercise.name,
        duration: exercise.durationSecs ? `${exercise.durationSecs}s` : exercise.reps ? `${exercise.reps} reps` : undefined,
        durationSecs: exercise.durationSecs,
      });
    }
  }
  
  if (warmupExercises.length === 0) {
    return [
      { id: 'arm-circles', name: 'Arm Circles', duration: '30s', durationSecs: 30 },
      { id: 'leg-swings', name: 'Leg Swings', duration: '15 reps' },
      { id: 'bodyweight-squats', name: 'Bodyweight Squats', duration: '15 reps' },
    ];
  }
  
  return warmupExercises;
}

/**
 * Get cooldown exercises from templates based on focus areas
 */
function getCooldownExercisesFromTemplates(focusAreas: MuscleGroup[]): { id: string; name: string; duration?: string; durationSecs?: number }[] {
  const template = getTemplateForFocusAreas(focusAreas);
  const cooldownExercises: { id: string; name: string; duration?: string; durationSecs?: number }[] = [];
  
  if (template?.cooldown) {
    for (const exercise of template.cooldown) {
      cooldownExercises.push({
        id: exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: exercise.name,
        duration: exercise.durationSecs ? `${exercise.durationSecs}s` : exercise.reps ? `${exercise.reps} reps` : undefined,
        durationSecs: exercise.durationSecs,
      });
    }
  }
  
  if (cooldownExercises.length === 0) {
    return [
      { id: 'foam-roll', name: 'Foam Rolling', duration: '60s', durationSecs: 60 },
      { id: 'deep-breathing', name: 'Deep Breathing', duration: '60s', durationSecs: 60 },
    ];
  }
  
  return cooldownExercises;
}

function getMuscleGroupColor(group: MuscleGroup): string {
  const colors: Record<MuscleGroup, string> = {
    LEGS: '#8B5CF6', SHOULDERS: '#EC4899', CHEST: '#EF4444', TRICEPS: '#F97316',
    BACK: '#14B8A6', BICEPS: '#3B82F6', CORE: '#10B981', CARDIO: '#6366F1',
  };
  return colors[group] || '#6B7280';
}

/**
 * Initialize exercises from template based on focus areas
 */
function initializeExercisesFromTemplate(areas: MuscleGroup[]): ExerciseLog[] {
  const template = getTemplateForFocusAreas(areas);
  
  if (template) {
    return template.exercises
      .filter(ex => areas.includes(ex.targetGroup) || areas.length === 0)
      .map(exercise => {
        const sets: ExerciseSet[] = [];
        for (let i = 0; i < exercise.defaultSets; i++) {
          sets.push({
            id: generateUUID(),
            weight: exercise.defaultWeight?.[i] ?? 0,
            reps: exercise.defaultReps?.[i] ?? 10,
            completed: false,
          });
        }
        return {
          id: generateUUID(),
          exerciseName: exercise.name,
          targetGroup: exercise.targetGroup,
          sets,
        };
      });
  }
  
  const templates = templateService.getAllTemplates();
  const exerciseList: ExerciseLog[] = [];
  const seenExercises = new Set<string>();
  
  for (const area of areas) {
    if (area !== 'CARDIO' && area !== 'CORE') {
      for (const tmpl of templates) {
        const areaExercises = tmpl.exercises.filter(ex => ex.targetGroup === area);
        for (const exercise of areaExercises) {
          if (!seenExercises.has(exercise.name)) {
            seenExercises.add(exercise.name);
            const sets: ExerciseSet[] = [];
            for (let i = 0; i < exercise.defaultSets; i++) {
              sets.push({
                id: generateUUID(),
                weight: exercise.defaultWeight?.[i] ?? 0,
                reps: exercise.defaultReps?.[i] ?? 10,
                completed: false,
              });
            }
            exerciseList.push({
              id: generateUUID(),
              exerciseName: exercise.name,
              targetGroup: area,
              sets,
            });
          }
        }
      }
    }
  }
  
  return exerciseList;
}

/**
 * ActiveWorkoutScreen - Interactive workout session with timer-driven UI
 * Requirements: 1.1, 1.3, 1.5, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.5
 */
const ActiveWorkoutScreen: React.FC<Props> = ({ route, navigation }) => {
  const { date, focusAreas: initialFocusAreas, existingWorkout } = route.params;

  // Determine if we need the focus selection phase
  const needsFocusSelection = !existingWorkout && initialFocusAreas.length === 0;
  const PHASES = needsFocusSelection ? PHASES_WITH_FOCUS : PHASES_WITHOUT_FOCUS;

  // Phase and navigation state
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const currentPhase = PHASES[currentPhaseIndex];
  
  // Interactive session state
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [sessionState, setSessionState] = useState<InteractiveSessionState | null>(null);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [currentTheme, setCurrentTheme] = useState<WorkoutTheme>(PHASE_THEMES.warmup);
  
  // Animation values for smooth transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Selected focus areas
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<MuscleGroup[]>(initialFocusAreas);
  const focusAreas = selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas;

  // Exercise data from templates
  const CORE_EXERCISES = useMemo(() => getCoreExercisesFromTemplates(), []);
  const WARMUP_EXERCISES = useMemo(() => getWarmupExercisesFromTemplates(focusAreas), [focusAreas]);
  const COOLDOWN_EXERCISES = useMemo(() => getCooldownExercisesFromTemplates(focusAreas), [focusAreas]);

  // Cardio state
  const [cardioType, setCardioType] = useState<CardioType>(existingWorkout?.cardio?.type || 'RUNNING');
  const [cardioDuration, setCardioDuration] = useState<string>(existingWorkout?.cardio?.durationMinutes?.toString() || '');
  const [cardioDistance, setCardioDistance] = useState<string>(existingWorkout?.cardio?.distanceKm?.toString() || '');
  const [cardioIntensity, setCardioIntensity] = useState<IntensityLevel>(existingWorkout?.cardio?.intensity || 'MODERATE');

  // Exercise state
  const [exercises, setExercises] = useState<ExerciseLog[]>(() => {
    if (existingWorkout?.exercises?.length) return existingWorkout.exercises;
    if (initialFocusAreas.length > 0) return initializeExercisesFromTemplate(initialFocusAreas);
    return [];
  });

  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [coreCompleted, setCoreCompleted] = useState<Set<string>>(new Set(existingWorkout?.coreCompleted || []));
  const [warmupCompleted, setWarmupCompleted] = useState<Set<string>>(new Set());
  const [cooldownCompleted, setCooldownCompleted] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Rest timer state for automatic rest between sets
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [currentRestTimer, setCurrentRestTimer] = useState<ActiveTimer | null>(null);
  const [lastCompletedSetInfo, setLastCompletedSetInfo] = useState<{ exerciseId: string; setIndex: number } | null>(null);

  // Exercise timer state for time-bound exercises (Requirements: 2.1, 2.2, 2.5)
  const [isExerciseTimerActive, setIsExerciseTimerActive] = useState(false);
  const [currentExerciseTimer, setCurrentExerciseTimer] = useState<ActiveTimer | null>(null);
  const [exerciseElapsedTime, setExerciseElapsedTime] = useState<Record<string, number>>({});

  // HealthKit authorization state
  const [healthKitAuthStatus, setHealthKitAuthStatus] = useState<AuthorizationStatus | null>(null);
  const [showHealthKitPrompt, setShowHealthKitPrompt] = useState(false);
  const [healthKitDenied, setHealthKitDenied] = useState(false);

  // Real-time health metrics state
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [currentCalories, setCurrentCalories] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Workout session state
  const [isWorkoutSessionActive, setIsWorkoutSessionActive] = useState(false);
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);

  // Workout summary modal state
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummary | null>(null);

  // Watch connectivity state
  const [watchConnectionState, setWatchConnectionState] = useState<WatchConnectionState>({
    isPaired: false,
    isReachable: false,
    isWatchAppInstalled: false,
  });

  // Initialize watch connectivity
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    watchConnectivityService.initialize();
    const subscription = watchConnectivityService.subscribeToStateChanges((state) => {
      setWatchConnectionState(state);
    });
    return () => subscription.remove();
  }, []);

  // Check HealthKit authorization on mount
  useEffect(() => {
    const checkHealthKitAuthorization = async () => {
      if (Platform.OS !== 'ios') return;
      if (!healthKitService.isHealthKitAvailable()) return;

      try {
        const status = await healthKitService.getAuthorizationStatus();
        setHealthKitAuthStatus(status);

        const needsAuthorization = 
          status.heartRate === 'notDetermined' ||
          status.activeEnergy === 'notDetermined' ||
          status.workout === 'notDetermined';

        const isDenied = 
          status.heartRate === 'denied' ||
          status.activeEnergy === 'denied' ||
          status.workout === 'denied';

        if (needsAuthorization) {
          setShowHealthKitPrompt(true);
        } else if (isDenied) {
          setHealthKitDenied(true);
        }
      } catch (error) {
        console.error('Failed to check HealthKit authorization:', error);
      }
    };

    checkHealthKitAuthorization();
  }, []);

  // Subscribe to interactive session state changes
  useEffect(() => {
    if (!isInteractiveMode) return;

    const stateSubscription = interactiveWorkoutSession.subscribeToStateChanges((state) => {
      setSessionState(state);
      setElapsedSeconds(state.elapsedSeconds);
      
      // Update theme based on phase
      const timerPhase = state.currentPhase;
      setCurrentTheme(PHASE_THEMES[timerPhase]);
    });

    const timerSubscription = interactiveWorkoutSession.subscribeToTimerUpdatesPublic((timers) => {
      setActiveTimers(timers);
      
      // Check for rest timer (Requirements: 3.1, 3.2)
      const restTimer = timers.find(t => t.type === 'rest');
      if (restTimer) {
        setIsRestTimerActive(true);
        setCurrentRestTimer(restTimer);
      } else {
        setIsRestTimerActive(false);
        setCurrentRestTimer(null);
      }
      
      // Check for exercise timer (Requirements: 2.1, 2.2)
      const exerciseTimer = timers.find(t => t.type === 'exercise');
      if (exerciseTimer) {
        setIsExerciseTimerActive(true);
        setCurrentExerciseTimer(exerciseTimer);
      } else {
        setIsExerciseTimerActive(false);
        setCurrentExerciseTimer(null);
      }
    });

    return () => {
      stateSubscription.unsubscribe();
      timerSubscription.unsubscribe();
    };
  }, [isInteractiveMode]);

  // Handle HealthKit authorization request
  const handleRequestHealthKitAuthorization = useCallback(async () => {
    try {
      const result = await healthKitService.requestAuthorization();
      setShowHealthKitPrompt(false);

      if (result.granted) {
        const status = await healthKitService.getAuthorizationStatus();
        setHealthKitAuthStatus(status);
        setHealthKitDenied(false);
      } else {
        setHealthKitDenied(true);
        if (result.deniedTypes.length > 0) {
          Alert.alert(
            'Limited Health Tracking',
            'Some health permissions were denied. You can enable them in Settings > Privacy > Health to get full workout tracking.',
            [
              { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
              { text: 'Continue Anyway', style: 'cancel' },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Failed to request HealthKit authorization:', error);
      setShowHealthKitPrompt(false);
      Alert.alert('Error', 'Failed to request health permissions. Please try again.');
    }
  }, []);

  const handleSkipHealthKitAuthorization = useCallback(() => {
    setShowHealthKitPrompt(false);
    setHealthKitDenied(true);
  }, []);

  // Validation functions
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

  // Start interactive workout session
  const startInteractiveSession = useCallback(async () => {
    try {
      const tempWorkout: DailyWorkout = {
        id: existingWorkout?.id || generateUUID(),
        date,
        type: 'GYM',
        focusAreas: selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas,
        cardio: buildCardioLog(),
        exercises: exercises.length > 0 ? exercises : initializeExercisesFromTemplate(selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas),
        coreCompleted: [],
        isRestDay: false,
        createdAt: existingWorkout?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await interactiveWorkoutSession.startInteractiveSession(tempWorkout, {
        enableAutoRest: true,
        defaultRestDuration: 60,
        enableAudio: true,
        enableHaptics: true,
        enableAdaptiveSuggestions: true,
        backgroundMode: true,
      });

      setIsInteractiveMode(true);
      setIsWorkoutSessionActive(true);

      // Subscribe to real-time metrics
      workoutSessionManager.subscribeToMetrics((metrics: RealTimeMetrics) => {
        setCurrentHeartRate(metrics.heartRate);
        setCurrentCalories(metrics.activeCalories);
      });
    } catch (error) {
      console.error('Failed to start interactive session:', error);
      Alert.alert('Error', 'Failed to start workout session. Please try again.');
    }
  }, [existingWorkout, date, selectedFocusAreas, initialFocusAreas, buildCardioLog, exercises]);

  // Phase transition with animation
  const animatePhaseTransition = useCallback((callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  // Handle navigation between phases
  const handleNext = useCallback(async () => {
    if (currentPhase === 'focus') {
      if (!validateFocusAreas()) return;
      setExercises(initializeExercisesFromTemplate(selectedFocusAreas));
    }
    if (currentPhase === 'cardio' && !validateCardio()) return;
    
    const nextPhaseIndex = currentPhaseIndex + 1;
    const nextPhase = PHASES[nextPhaseIndex];
    
    // Start interactive session when entering strength phase
    if (nextPhase === 'strength' && !isInteractiveMode && !healthKitDenied) {
      await startInteractiveSession();
    }
    
    // Update theme for the new phase
    const timerPhase = mapPhaseToTimerPhase(nextPhase);
    setCurrentTheme(PHASE_THEMES[timerPhase]);
    visualFeedbackManager.setPhaseTheme(timerPhase);
    
    animatePhaseTransition(() => {
      if (currentPhaseIndex < PHASES.length - 1) {
        setCurrentPhaseIndex(currentPhaseIndex + 1);
      }
    });
  }, [currentPhase, currentPhaseIndex, validateCardio, validateFocusAreas, selectedFocusAreas, PHASES, isInteractiveMode, healthKitDenied, startInteractiveSession, animatePhaseTransition]);

  const handleBack = useCallback(() => {
    animatePhaseTransition(() => {
      if (currentPhaseIndex > 0) {
        setCurrentPhaseIndex(currentPhaseIndex - 1);
        const prevPhase = PHASES[currentPhaseIndex - 1];
        const timerPhase = mapPhaseToTimerPhase(prevPhase);
        setCurrentTheme(PHASE_THEMES[timerPhase]);
      }
    });
  }, [currentPhaseIndex, PHASES, animatePhaseTransition]);

  // Exercise management
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

  // Handle set completion with automatic rest timer (Requirements: 3.1, 3.2, 3.3)
  const handleToggleSetCompletion = useCallback((exerciseId: string, setId: string) => {
    setExercises(prev => {
      const updatedExercises = prev.map(ex => ex.id === exerciseId ? toggleSetCompletion(ex, setId) : ex);
      
      if (isInteractiveMode) {
        const exercise = updatedExercises.find(ex => ex.id === exerciseId);
        const set = exercise?.sets.find(s => s.id === setId);
        const setIndex = exercise?.sets.findIndex(s => s.id === setId) ?? -1;
        
        if (set?.completed) {
          // Start tracking this exercise if not already
          if (currentExerciseId !== exerciseId) {
            if (currentExerciseId) {
              interactiveWorkoutSession.completeExercise(currentExerciseId);
            }
            if (exercise) {
              interactiveWorkoutSession.startExercise(exercise);
            }
            setCurrentExerciseId(exerciseId);
          }
          
          // Complete set and trigger rest timer
          interactiveWorkoutSession.completeSet(setIndex);
          setLastCompletedSetInfo({ exerciseId, setIndex });
          
          // Play audio feedback
          audioFeedbackManager.playTimerCompletion('exercise');
        }
      }
      
      return updatedExercises;
    });
  }, [isInteractiveMode, currentExerciseId]);

  // Rest timer controls (Requirements: 3.4, 3.5)
  const handleSkipRestTimer = useCallback(() => {
    interactiveWorkoutSession.skipRestTimer();
    audioFeedbackManager.playMotivationalCue('rest_over');
  }, []);

  const handleAdjustRestTimer = useCallback((seconds: number) => {
    interactiveWorkoutSession.adjustRestTimer(seconds);
    audioFeedbackManager.triggerButtonHaptic();
  }, []);

  // Exercise timer controls (Requirements: 2.1, 2.2, 2.4, 2.5)
  const handlePauseExerciseTimer = useCallback(() => {
    if (isInteractiveMode) {
      interactiveWorkoutSession.pauseSession();
    }
  }, [isInteractiveMode]);

  const handleResumeExerciseTimer = useCallback(() => {
    if (isInteractiveMode) {
      interactiveWorkoutSession.resumeSession();
    }
  }, [isInteractiveMode]);

  const handleSkipExerciseTimer = useCallback(() => {
    if (currentExerciseId) {
      interactiveWorkoutSession.completeExercise(currentExerciseId);
      setCurrentExerciseId(null);
      audioFeedbackManager.playTimerCompletion('exercise');
    }
  }, [currentExerciseId]);

  // Start exercise timer for time-bound exercises (Requirements: 2.1)
  const startTimedExercise = useCallback((exerciseId: string, durationSecs: number, exerciseName: string) => {
    if (!isInteractiveMode) return;
    
    // Find the exercise and start it
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      // Complete previous exercise if any
      if (currentExerciseId && currentExerciseId !== exerciseId) {
        interactiveWorkoutSession.completeExercise(currentExerciseId);
      }
      
      // Start the new exercise with duration
      const exerciseWithDuration = {
        ...exercise,
        suggestedDuration: durationSecs,
      };
      interactiveWorkoutSession.startExercise(exerciseWithDuration);
      setCurrentExerciseId(exerciseId);
      
      // Play start audio
      audioFeedbackManager.playMotivationalCue('start_exercise');
    }
  }, [isInteractiveMode, exercises, currentExerciseId]);

  // Track elapsed time for non-timed exercises (Requirements: 2.5)
  useEffect(() => {
    if (!isInteractiveMode || !currentExerciseId) return;
    
    const interval = setInterval(() => {
      setExerciseElapsedTime(prev => ({
        ...prev,
        [currentExerciseId]: (prev[currentExerciseId] || 0) + 1,
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isInteractiveMode, currentExerciseId]);

  // Core, warmup, cooldown exercise toggles
  const handleToggleCoreExercise = useCallback((exerciseId: string) => {
    setCoreCompleted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  }, []);

  const handleToggleWarmupExercise = useCallback((exerciseId: string) => {
    setWarmupCompleted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  }, []);

  const handleToggleCooldownExercise = useCallback((exerciseId: string) => {
    setCooldownCompleted(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  }, []);

  // Pause/Resume interactive session
  const handlePauseSession = useCallback(() => {
    if (isInteractiveMode) {
      interactiveWorkoutSession.pauseSession();
    }
  }, [isInteractiveMode]);

  const handleResumeSession = useCallback(() => {
    if (isInteractiveMode) {
      interactiveWorkoutSession.resumeSession();
    }
  }, [isInteractiveMode]);

  // Finish workout
  const handleFinishWorkout = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isInteractiveMode && currentExerciseId) {
        interactiveWorkoutSession.completeExercise(currentExerciseId);
        setCurrentExerciseId(null);
      }

      let summary: WorkoutSummary | null = null;
      if (isInteractiveMode) {
        try {
          summary = await interactiveWorkoutSession.endSession();
          setWorkoutSummary(summary);
          setIsWorkoutSessionActive(false);
          setIsInteractiveMode(false);
        } catch (error) {
          console.error('Failed to end interactive session:', error);
        }
      }

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
        workoutMetrics: summary ? {
          averageHeartRate: summary.averageHeartRate,
          maxHeartRate: summary.maxHeartRate,
          totalCalories: summary.totalCalories,
          duration: summary.duration,
        } : undefined,
        interactiveSession: isInteractiveMode ? interactiveWorkoutSession.getSessionData() : undefined,
      };
      
      await fitnessService.saveWorkout(workout);
      
      if (summary && (summary.averageHeartRate > 0 || summary.totalCalories > 0)) {
        setShowSummaryModal(true);
      } else {
        Alert.alert('Workout Saved', 'Your workout has been logged successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
      console.error('Failed to save workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [date, selectedFocusAreas, initialFocusAreas, exercises, coreCompleted, existingWorkout, buildCardioLog, navigation, isInteractiveMode, currentExerciseId]);

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render step indicator with phase-based colors
  const renderStepIndicator = () => (
    <View style={[styles.stepIndicator, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }]}>
      {PHASES.map((phase, index) => {
        const isActive = index === currentPhaseIndex;
        const isCompleted = index < currentPhaseIndex;
        const phaseTheme = PHASE_THEMES[mapPhaseToTimerPhase(phase)];
        return (
          <React.Fragment key={phase}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle, 
                isActive && { backgroundColor: phaseTheme.primaryColor },
                isCompleted && styles.stepCircleCompleted
              ]}>
                {isCompleted ? <Ionicons name="checkmark" size={16} color="#fff" /> :
                  <Text style={[styles.stepNumber, (isActive || isCompleted) && styles.stepNumberActive]}>{index + 1}</Text>}
              </View>
              <Text style={[
                styles.stepLabel, 
                isActive && { color: phaseTheme.primaryColor, fontWeight: '600' },
                isInteractiveMode && { color: currentTheme.textColor }
              ]}>
                {PHASE_LABELS[phase]}
              </Text>
            </View>
            {index < PHASES.length - 1 && (
              <View style={[styles.stepConnector, isCompleted && styles.stepConnectorCompleted]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  // Render interactive workout header with timers and progress
  const renderInteractiveHeader = () => {
    if (!isInteractiveMode || !sessionState) return null;

    const workoutTimer = activeTimers.find(t => t.type === 'workout');
    
    return (
      <View style={[styles.interactiveHeader, { backgroundColor: currentTheme.backgroundColor }]}>
        {/* Overall Progress Ring */}
        <WorkoutProgressRing
          progress={sessionState.overallProgress}
          theme={currentTheme}
          phase={sessionState.currentPhase}
          elapsedTime={formatElapsedTime(sessionState.elapsedSeconds)}
          estimatedRemainingTime={formatElapsedTime(sessionState.estimatedRemainingSeconds)}
          completedExercises={sessionState.completedExercises.length}
          totalExercises={exercises.length}
          size="medium"
          showDetails={true}
        />

        {/* Health Metrics Bar */}
        <View style={styles.healthMetricsBarInteractive}>
          <View style={styles.healthMetricItem}>
            <Ionicons name="heart" size={18} color="#FF3B30" />
            <Text style={[styles.healthMetricValue, { color: currentTheme.textColor }]}>
              {currentHeartRate !== null ? currentHeartRate : '--'}
            </Text>
            <Text style={[styles.healthMetricUnit, { color: currentTheme.textColor }]}>BPM</Text>
          </View>
          <View style={styles.healthMetricItem}>
            <Ionicons name="flame" size={18} color="#F97316" />
            <Text style={[styles.healthMetricValue, { color: currentTheme.textColor }]}>
              {Math.round(currentCalories)}
            </Text>
            <Text style={[styles.healthMetricUnit, { color: currentTheme.textColor }]}>kcal</Text>
          </View>
          <View style={styles.healthMetricItem}>
            <Ionicons name="time" size={18} color={currentTheme.accentColor} />
            <Text style={[styles.healthMetricValue, { color: currentTheme.textColor }]}>
              {workoutTimer?.displayTime || formatElapsedTime(elapsedSeconds)}
            </Text>
          </View>
        </View>

        {/* Session Controls */}
        <View style={styles.sessionControls}>
          <TouchableOpacity
            style={[styles.sessionControlButton, { backgroundColor: `${currentTheme.primaryColor}20` }]}
            onPress={sessionState.isPaused ? handleResumeSession : handlePauseSession}
          >
            <Ionicons
              name={sessionState.isPaused ? 'play' : 'pause'}
              size={20}
              color={currentTheme.primaryColor}
            />
            <Text style={[styles.sessionControlText, { color: currentTheme.primaryColor }]}>
              {sessionState.isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render rest timer overlay (Requirements: 3.1, 3.2, 3.3, 3.5)
  const renderRestTimerOverlay = () => {
    if (!isRestTimerActive || !currentRestTimer) return null;

    return (
      <View style={[styles.restTimerOverlay, { backgroundColor: `${currentTheme.backgroundColor}F0` }]}>
        <View style={styles.restTimerContent}>
          <Text style={[styles.restTimerTitle, { color: currentTheme.textColor }]}>Rest Time</Text>
          
          <InteractiveTimer
            timer={currentRestTimer}
            theme={currentTheme}
            onPause={handlePauseSession}
            onResume={handleResumeSession}
            onSkip={handleSkipRestTimer}
            onAdjust={handleAdjustRestTimer}
            showAdjustControls={true}
            size="large"
            showGestures={true}
          />

          {/* Breathing animation indicator */}
          <Animated.View style={[styles.breathingIndicator, { borderColor: currentTheme.accentColor }]}>
            <Text style={[styles.breathingText, { color: currentTheme.textColor }]}>
              Breathe and recover
            </Text>
          </Animated.View>

          {/* Next set preview */}
          {lastCompletedSetInfo && (
            <View style={[styles.nextSetPreview, { backgroundColor: `${currentTheme.primaryColor}20` }]}>
              <Text style={[styles.nextSetLabel, { color: currentTheme.textColor }]}>Next Up:</Text>
              <Text style={[styles.nextSetText, { color: currentTheme.primaryColor }]}>
                Set {lastCompletedSetInfo.setIndex + 2}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render exercise timer overlay for time-bound exercises (Requirements: 2.1, 2.2, 2.3)
  const renderExerciseTimerOverlay = () => {
    if (!isExerciseTimerActive || !currentExerciseTimer) return null;

    // Find the current exercise name
    const currentExercise = exercises.find(ex => ex.id === currentExerciseId);
    const exerciseName = currentExercise?.exerciseName || 'Exercise';

    return (
      <View style={[styles.exerciseTimerOverlay, { backgroundColor: `${currentTheme.backgroundColor}F0` }]}>
        <View style={styles.exerciseTimerContent}>
          <Text style={[styles.exerciseTimerTitle, { color: currentTheme.textColor }]}>
            {exerciseName}
          </Text>
          <Text style={[styles.exerciseTimerSubtitle, { color: currentTheme.textColor }]}>
            Hold the position
          </Text>
          
          <InteractiveTimer
            timer={currentExerciseTimer}
            theme={currentTheme}
            onPause={handlePauseExerciseTimer}
            onResume={handleResumeExerciseTimer}
            onSkip={handleSkipExerciseTimer}
            showAdjustControls={false}
            size="large"
            showGestures={true}
          />

          {/* Exercise completion indicator */}
          {currentExerciseTimer.state === 'completed' && (
            <View style={[styles.exerciseCompletedBadge, { backgroundColor: currentTheme.primaryColor }]}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.exerciseCompletedText}>Exercise Complete!</Text>
            </View>
          )}

          {/* Skip button for early completion */}
          <TouchableOpacity
            style={[styles.earlyCompleteButton, { borderColor: currentTheme.primaryColor }]}
            onPress={handleSkipExerciseTimer}
          >
            <Ionicons name="checkmark" size={18} color={currentTheme.primaryColor} />
            <Text style={[styles.earlyCompleteText, { color: currentTheme.primaryColor }]}>
              Mark Complete Early
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render focus phase
  const renderFocusPhase = () => (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.phaseTitle, isInteractiveMode && { color: currentTheme.textColor }]}>Select Focus Areas</Text>
      <Text style={[styles.phaseSubtitle, isInteractiveMode && { color: currentTheme.textColor }]}>Choose the muscle groups you want to train today</Text>
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
              <View style={[styles.focusAreaIcon, isSelected && styles.focusAreaIconSelected]}>
                <Ionicons
                  name={isSelected ? 'checkmark' : 'fitness'}
                  size={24}
                  color={isSelected ? '#fff' : getMuscleGroupColor(area)}
                />
              </View>
              <Text style={[styles.focusAreaLabel, isSelected && styles.focusAreaLabelSelected]}>
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

  // Render cardio phase
  const renderCardioPhase = () => (
    <ScrollView style={styles.phaseContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.phaseTitle, isInteractiveMode && { color: currentTheme.textColor }]}>Cardio Warm-up</Text>
      <Text style={[styles.phaseSubtitle, isInteractiveMode && { color: currentTheme.textColor }]}>Log your cardio session</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isInteractiveMode && { color: currentTheme.textColor }]}>Type</Text>
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
        <Text style={[styles.inputLabel, isInteractiveMode && { color: currentTheme.textColor }]}>Duration (minutes) *</Text>
        <View style={styles.largeInputContainer}>
          <TextInput style={styles.largeInput} value={cardioDuration} onChangeText={setCardioDuration}
            keyboardType="numeric" placeholder="0" placeholderTextColor="#ccc" />
          <Text style={styles.inputUnit}>min</Text>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isInteractiveMode && { color: currentTheme.textColor }]}>Distance (km) - Optional</Text>
        <View style={styles.largeInputContainer}>
          <TextInput style={styles.largeInput} value={cardioDistance} onChangeText={setCardioDistance}
            keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor="#ccc" />
          <Text style={styles.inputUnit}>km</Text>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isInteractiveMode && { color: currentTheme.textColor }]}>Intensity</Text>
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

  // Render set row with interactive styling
  const renderSetRow = (exercise: ExerciseLog, set: ExerciseSet, setIndex: number) => {
    const isHighlighted = lastCompletedSetInfo?.exerciseId === exercise.id && 
                          lastCompletedSetInfo?.setIndex === setIndex - 1;
    
    const renderRightActions = () => (
      <TouchableOpacity style={styles.deleteSetButton} onPress={() => handleRemoveSet(exercise.id, set.id)}>
        <Ionicons name="trash" size={20} color="#fff" />
      </TouchableOpacity>
    );
    
    return (
      <Swipeable key={set.id} renderRightActions={renderRightActions} rightThreshold={40}>
        <View style={[
          styles.setRow, 
          set.completed && styles.setRowCompleted,
          isHighlighted && styles.setRowHighlighted,
          isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }
        ]}>
          <TouchableOpacity 
            style={[styles.setCheckbox, set.completed && styles.setCheckboxChecked]}
            onPress={() => handleToggleSetCompletion(exercise.id, set.id)}
          >
            {set.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </TouchableOpacity>
          <Text style={[styles.setNumber, isInteractiveMode && { color: currentTheme.textColor }]}>Set {setIndex + 1}</Text>
          <View style={styles.setInputGroup}>
            <TextInput 
              style={[styles.setInput, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}10`, color: currentTheme.textColor }]} 
              value={set.weight.toString()}
              onChangeText={(text) => handleUpdateSet(exercise.id, set.id, { weight: parseFloat(text) || 0 })}
              keyboardType="decimal-pad" 
              placeholder="0" 
            />
            <Text style={[styles.setInputLabel, isInteractiveMode && { color: currentTheme.textColor }]}>kg</Text>
          </View>
          <Text style={[styles.setMultiplier, isInteractiveMode && { color: currentTheme.textColor }]}>×</Text>
          <View style={styles.setInputGroup}>
            <TextInput 
              style={[styles.setInput, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}10`, color: currentTheme.textColor }]} 
              value={set.reps.toString()}
              onChangeText={(text) => handleUpdateSet(exercise.id, set.id, { reps: parseInt(text, 10) || 0 })}
              keyboardType="numeric" 
              placeholder="0" 
            />
            <Text style={[styles.setInputLabel, isInteractiveMode && { color: currentTheme.textColor }]}>reps</Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  // Render watch connection status
  const renderWatchConnectionStatus = () => {
    if (Platform.OS !== 'ios') return null;
    const isConnected = watchConnectionState.isReachable;
    
    return (
      <View style={[styles.watchStatusContainer, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}10` }]}>
        <View style={[styles.watchStatusDot, isConnected ? styles.watchStatusDotConnected : styles.watchStatusDotDisconnected]} />
        <Ionicons name="watch-outline" size={16} color={isConnected ? '#4CAF50' : '#999'} />
        <Text style={[styles.watchStatusText, isConnected && styles.watchStatusTextConnected, isInteractiveMode && { color: currentTheme.textColor }]}>
          {isConnected ? 'Watch Connected' : 'Watch Disconnected'}
        </Text>
      </View>
    );
  };

  // Render strength phase with interactive UI
  const renderStrengthPhase = () => (
    <ScrollView 
      style={[styles.phaseContent, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }]} 
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.phaseTitle, isInteractiveMode && { color: currentTheme.textColor }]}>Strength Training</Text>
      <Text style={[styles.phaseSubtitle, isInteractiveMode && { color: currentTheme.textColor }]}>
        Focus: {(selectedFocusAreas.length > 0 ? selectedFocusAreas : initialFocusAreas).filter(a => a !== 'CARDIO' && a !== 'CORE').join(', ') || 'General'}
      </Text>
      
      {renderWatchConnectionStatus()}
      
      {exercises.length === 0 ? (
        <View style={styles.emptyExercises}>
          <Ionicons name="barbell-outline" size={48} color={isInteractiveMode ? currentTheme.textColor : '#ccc'} />
          <Text style={[styles.emptyExercisesText, isInteractiveMode && { color: currentTheme.textColor }]}>No exercises added</Text>
          <Text style={[styles.emptyExercisesSubtext, isInteractiveMode && { color: currentTheme.textColor }]}>
            Go back and select focus areas to get exercise suggestions
          </Text>
        </View>
      ) : (
        exercises.map(exercise => {
          const isExpanded = expandedExercises.has(exercise.id);
          const isCurrentExercise = currentExerciseId === exercise.id;
          const completedSets = exercise.sets.filter(s => s.completed).length;
          
          return (
            <View 
              key={exercise.id} 
              style={[
                styles.exerciseCard,
                isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08`, borderColor: `${currentTheme.textColor}20` },
                isCurrentExercise && { borderColor: currentTheme.primaryColor, borderWidth: 2 }
              ]}
            >
              <TouchableOpacity style={styles.exerciseHeader} onPress={() => toggleExerciseExpanded(exercise.id)}>
                <View style={styles.exerciseHeaderLeft}>
                  <View style={[styles.muscleGroupBadge, { backgroundColor: getMuscleGroupColor(exercise.targetGroup) }]}>
                    <Text style={styles.muscleGroupBadgeText}>{exercise.targetGroup.slice(0, 3)}</Text>
                  </View>
                  <View>
                    <Text style={[styles.exerciseName, isInteractiveMode && { color: currentTheme.textColor }]}>
                      {exercise.exerciseName}
                    </Text>
                    <Text style={[styles.exerciseSetsCount, isInteractiveMode && { color: currentTheme.textColor }]}>
                      {completedSets}/{exercise.sets.length} sets completed
                    </Text>
                  </View>
                </View>
                <View style={styles.exerciseHeaderRight}>
                  {isCurrentExercise && (
                    <View style={[styles.activeIndicator, { backgroundColor: currentTheme.primaryColor }]}>
                      <Text style={styles.activeIndicatorText}>ACTIVE</Text>
                    </View>
                  )}
                  <Ionicons 
                    name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={24} 
                    color={isInteractiveMode ? currentTheme.textColor : '#666'} 
                  />
                </View>
              </TouchableOpacity>
              {isExpanded && (
                <View style={[styles.exerciseContent, isInteractiveMode && { borderTopColor: `${currentTheme.textColor}20` }]}>
                  {exercise.sets.map((set, index) => renderSetRow(exercise, set, index))}
                  <TouchableOpacity 
                    style={[styles.addSetButton, isInteractiveMode && { borderColor: currentTheme.primaryColor }]} 
                    onPress={() => handleAddSet(exercise.id)}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={currentTheme.primaryColor} />
                    <Text style={[styles.addSetButtonText, { color: currentTheme.primaryColor }]}>Add Set</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // Render core phase
  const renderCorePhase = () => (
    <ScrollView 
      style={[styles.phaseContent, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }]} 
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.phaseTitle, isInteractiveMode && { color: currentTheme.textColor }]}>Core Finisher</Text>
      <Text style={[styles.phaseSubtitle, isInteractiveMode && { color: currentTheme.textColor }]}>Complete your core exercises</Text>
      <View style={styles.coreExercisesList}>
        {CORE_EXERCISES.map(exercise => {
          const isCompleted = coreCompleted.has(exercise.id);
          const hasTimer = exercise.duration && exercise.duration > 0;
          const elapsedTime = exerciseElapsedTime[exercise.id] || 0;
          
          return (
            <View key={exercise.id}>
              <TouchableOpacity 
                style={[
                  styles.coreExerciseItem, 
                  isCompleted && styles.coreExerciseItemCompleted,
                  isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08`, borderColor: `${currentTheme.textColor}20` }
                ]}
                onPress={() => handleToggleCoreExercise(exercise.id)}
              >
                <View style={[styles.coreCheckbox, isCompleted && { backgroundColor: currentTheme.primaryColor, borderColor: currentTheme.primaryColor }]}>
                  {isCompleted && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
                <Ionicons name={exercise.icon as any} size={24} color={isCompleted ? currentTheme.primaryColor : (isInteractiveMode ? currentTheme.textColor : '#666')} style={styles.coreExerciseIcon} />
                <View style={styles.coreExerciseInfo}>
                  <Text style={[styles.coreExerciseName, isCompleted && { color: currentTheme.primaryColor }, isInteractiveMode && { color: currentTheme.textColor }]}>
                    {exercise.name}
                  </Text>
                  {exercise.duration && (
                    <Text style={[styles.coreExerciseDuration, isInteractiveMode && { color: currentTheme.textColor }]}>
                      {exercise.duration}s
                    </Text>
                  )}
                </View>
                {/* Timer start button for timed exercises (Requirements: 2.1) */}
                {hasTimer && isInteractiveMode && !isCompleted && (
                  <TouchableOpacity
                    style={[styles.startTimerButton, { backgroundColor: `${currentTheme.primaryColor}20` }]}
                    onPress={() => startTimedExercise(exercise.id, exercise.duration!, exercise.name)}
                  >
                    <Ionicons name="timer-outline" size={18} color={currentTheme.primaryColor} />
                    <Text style={[styles.startTimerText, { color: currentTheme.primaryColor }]}>Start</Text>
                  </TouchableOpacity>
                )}
                {/* Elapsed time counter for non-timed exercises (Requirements: 2.5) */}
                {!hasTimer && isInteractiveMode && elapsedTime > 0 && (
                  <View style={[styles.elapsedTimeContainer, { backgroundColor: `${currentTheme.textColor}10` }]}>
                    <Ionicons name="time-outline" size={14} color={currentTheme.textColor} />
                    <Text style={[styles.elapsedTimeText, { color: currentTheme.textColor }]}>
                      {formatElapsedTime(elapsedTime)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <View style={[styles.coreProgress, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08` }]}>
        <Text style={[styles.coreProgressText, isInteractiveMode && { color: currentTheme.textColor }]}>
          {coreCompleted.size} of {CORE_EXERCISES.length} completed
        </Text>
        <View style={[styles.coreProgressBar, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}20` }]}>
          <View style={[styles.coreProgressFill, { width: `${(coreCompleted.size / CORE_EXERCISES.length) * 100}%`, backgroundColor: currentTheme.primaryColor }]} />
        </View>
      </View>
    </ScrollView>
  );

  // Render warmup phase
  const renderWarmupPhase = () => (
    <ScrollView 
      style={[styles.phaseContent, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }]} 
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.phaseTitle, isInteractiveMode && { color: currentTheme.textColor }]}>Warmup</Text>
      <Text style={[styles.phaseSubtitle, isInteractiveMode && { color: currentTheme.textColor }]}>Prepare your muscles for the workout</Text>
      <View style={styles.coreExercisesList}>
        {WARMUP_EXERCISES.map(exercise => {
          const isCompleted = warmupCompleted.has(exercise.id);
          const hasTimer = exercise.durationSecs && exercise.durationSecs > 0;
          const elapsedTime = exerciseElapsedTime[exercise.id] || 0;
          
          return (
            <View key={exercise.id}>
              <TouchableOpacity 
                style={[
                  styles.coreExerciseItem, 
                  isCompleted && styles.coreExerciseItemCompleted,
                  isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08`, borderColor: `${currentTheme.textColor}20` }
                ]}
                onPress={() => handleToggleWarmupExercise(exercise.id)}
              >
                <View style={[styles.coreCheckbox, isCompleted && { backgroundColor: currentTheme.primaryColor, borderColor: currentTheme.primaryColor }]}>
                  {isCompleted && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
                <Ionicons name="body" size={24} color={isCompleted ? currentTheme.primaryColor : (isInteractiveMode ? currentTheme.textColor : '#666')} style={styles.coreExerciseIcon} />
                <View style={styles.warmupExerciseInfo}>
                  <Text style={[styles.coreExerciseName, isCompleted && { color: currentTheme.primaryColor }, isInteractiveMode && { color: currentTheme.textColor }]}>
                    {exercise.name}
                  </Text>
                  {exercise.duration && <Text style={[styles.warmupDuration, isInteractiveMode && { color: currentTheme.textColor }]}>{exercise.duration}</Text>}
                </View>
                {/* Timer start button for timed warmup exercises (Requirements: 2.1) */}
                {hasTimer && isInteractiveMode && !isCompleted && (
                  <TouchableOpacity
                    style={[styles.startTimerButton, { backgroundColor: `${currentTheme.primaryColor}20` }]}
                    onPress={() => startTimedExercise(exercise.id, exercise.durationSecs!, exercise.name)}
                  >
                    <Ionicons name="timer-outline" size={18} color={currentTheme.primaryColor} />
                    <Text style={[styles.startTimerText, { color: currentTheme.primaryColor }]}>Start</Text>
                  </TouchableOpacity>
                )}
                {/* Elapsed time counter for non-timed exercises (Requirements: 2.5) */}
                {!hasTimer && isInteractiveMode && elapsedTime > 0 && (
                  <View style={[styles.elapsedTimeContainer, { backgroundColor: `${currentTheme.textColor}10` }]}>
                    <Ionicons name="time-outline" size={14} color={currentTheme.textColor} />
                    <Text style={[styles.elapsedTimeText, { color: currentTheme.textColor }]}>
                      {formatElapsedTime(elapsedTime)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <View style={[styles.coreProgress, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08` }]}>
        <Text style={[styles.coreProgressText, isInteractiveMode && { color: currentTheme.textColor }]}>
          {warmupCompleted.size} of {WARMUP_EXERCISES.length} completed
        </Text>
        <View style={[styles.coreProgressBar, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}20` }]}>
          <View style={[styles.warmupProgressFill, { width: `${(warmupCompleted.size / WARMUP_EXERCISES.length) * 100}%`, backgroundColor: currentTheme.primaryColor }]} />
        </View>
      </View>
    </ScrollView>
  );

  // Render cooldown phase
  const renderCooldownPhase = () => (
    <ScrollView 
      style={[styles.phaseContent, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }]} 
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.phaseTitle, isInteractiveMode && { color: currentTheme.textColor }]}>Cooldown</Text>
      <Text style={[styles.phaseSubtitle, isInteractiveMode && { color: currentTheme.textColor }]}>Help your body recover</Text>
      <View style={styles.coreExercisesList}>
        {COOLDOWN_EXERCISES.map(exercise => {
          const isCompleted = cooldownCompleted.has(exercise.id);
          const hasTimer = exercise.durationSecs && exercise.durationSecs > 0;
          const elapsedTime = exerciseElapsedTime[exercise.id] || 0;
          
          return (
            <View key={exercise.id}>
              <TouchableOpacity 
                style={[
                  styles.coreExerciseItem, 
                  isCompleted && styles.coreExerciseItemCompleted,
                  isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08`, borderColor: `${currentTheme.textColor}20` }
                ]}
                onPress={() => handleToggleCooldownExercise(exercise.id)}
              >
                <View style={[styles.coreCheckbox, isCompleted && { backgroundColor: currentTheme.primaryColor, borderColor: currentTheme.primaryColor }]}>
                  {isCompleted && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
                <Ionicons name="snow" size={24} color={isCompleted ? currentTheme.primaryColor : (isInteractiveMode ? currentTheme.textColor : '#666')} style={styles.coreExerciseIcon} />
                <View style={styles.warmupExerciseInfo}>
                  <Text style={[styles.coreExerciseName, isCompleted && { color: currentTheme.primaryColor }, isInteractiveMode && { color: currentTheme.textColor }]}>
                    {exercise.name}
                  </Text>
                  {exercise.duration && <Text style={[styles.warmupDuration, isInteractiveMode && { color: currentTheme.textColor }]}>{exercise.duration}</Text>}
                </View>
                {/* Timer start button for timed cooldown exercises (Requirements: 2.1) */}
                {hasTimer && isInteractiveMode && !isCompleted && (
                  <TouchableOpacity
                    style={[styles.startTimerButton, { backgroundColor: `${currentTheme.primaryColor}20` }]}
                    onPress={() => startTimedExercise(exercise.id, exercise.durationSecs!, exercise.name)}
                  >
                    <Ionicons name="timer-outline" size={18} color={currentTheme.primaryColor} />
                    <Text style={[styles.startTimerText, { color: currentTheme.primaryColor }]}>Start</Text>
                  </TouchableOpacity>
                )}
                {/* Elapsed time counter for non-timed exercises (Requirements: 2.5) */}
                {!hasTimer && isInteractiveMode && elapsedTime > 0 && (
                  <View style={[styles.elapsedTimeContainer, { backgroundColor: `${currentTheme.textColor}10` }]}>
                    <Ionicons name="time-outline" size={14} color={currentTheme.textColor} />
                    <Text style={[styles.elapsedTimeText, { color: currentTheme.textColor }]}>
                      {formatElapsedTime(elapsedTime)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <View style={[styles.coreProgress, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}08` }]}>
        <Text style={[styles.coreProgressText, isInteractiveMode && { color: currentTheme.textColor }]}>
          {cooldownCompleted.size} of {COOLDOWN_EXERCISES.length} completed
        </Text>
        <View style={[styles.coreProgressBar, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}20` }]}>
          <View style={[styles.cooldownProgressFill, { width: `${(cooldownCompleted.size / COOLDOWN_EXERCISES.length) * 100}%`, backgroundColor: currentTheme.primaryColor }]} />
        </View>
      </View>
    </ScrollView>
  );

  // Render phase content with animation
  const renderPhaseContent = () => {
    const content = (() => {
      switch (currentPhase) {
        case 'focus': return renderFocusPhase();
        case 'cardio': return renderCardioPhase();
        case 'warmup': return renderWarmupPhase();
        case 'strength': return renderStrengthPhase();
        case 'core': return renderCorePhase();
        case 'cooldown': return renderCooldownPhase();
        default: return null;
      }
    })();

    return (
      <Animated.View 
        style={[
          styles.animatedContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }
        ]}
      >
        {content}
      </Animated.View>
    );
  };

  // Render footer with navigation buttons
  const renderFooter = () => (
    <View style={[styles.footer, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor, borderTopColor: `${currentTheme.textColor}20` }]}>
      {currentPhaseIndex > 0 && (
        <TouchableOpacity style={[styles.backButton, isInteractiveMode && { backgroundColor: `${currentTheme.textColor}10` }]} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={isInteractiveMode ? currentTheme.textColor : '#666'} />
          <Text style={[styles.backButtonText, isInteractiveMode && { color: currentTheme.textColor }]}>Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.footerSpacer} />
      {currentPhaseIndex < PHASES.length - 1 ? (
        <TouchableOpacity 
          style={[styles.nextButton, { backgroundColor: currentTheme.primaryColor }]} 
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={[styles.finishButton, isSaving && styles.finishButtonDisabled]}
          onPress={handleFinishWorkout} 
          disabled={isSaving}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.finishButtonText}>{isSaving ? 'Saving...' : 'Finish Workout'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render HealthKit authorization prompt modal
  const renderHealthKitPromptModal = () => (
    <Modal visible={showHealthKitPrompt} transparent animationType="fade" onRequestClose={() => setShowHealthKitPrompt(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.healthKitPromptModal}>
          <View style={styles.healthKitIconContainer}>
            <Ionicons name="heart" size={48} color="#FF3B30" />
          </View>
          <Text style={styles.healthKitPromptTitle}>Track Your Health</Text>
          <Text style={styles.healthKitPromptDescription}>
            Allow CricBuddy to access your health data to track heart rate and calories during workouts. This data will be saved to Apple Health.
          </Text>
          <View style={styles.healthKitPromptButtons}>
            <TouchableOpacity style={styles.healthKitPromptButtonPrimary} onPress={handleRequestHealthKitAuthorization}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.healthKitPromptButtonPrimaryText}>Enable Health Tracking</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.healthKitPromptButtonSecondary} onPress={handleSkipHealthKitAuthorization}>
              <Text style={styles.healthKitPromptButtonSecondaryText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Render health metrics denied banner
  const renderHealthKitDeniedBanner = () => {
    if (!healthKitDenied || Platform.OS !== 'ios') return null;
    
    return (
      <TouchableOpacity style={styles.healthKitDeniedBanner} onPress={() => Linking.openURL('app-settings:')}>
        <Ionicons name="heart-dislike" size={16} color="#F97316" />
        <Text style={styles.healthKitDeniedText}>Health tracking disabled. Tap to enable in Settings.</Text>
        <Ionicons name="chevron-forward" size={16} color="#F97316" />
      </TouchableOpacity>
    );
  };

  const handleCloseSummaryModal = useCallback(() => {
    setShowSummaryModal(false);
    navigation.goBack();
  }, [navigation]);

  // Render workout summary modal
  const renderWorkoutSummaryModal = () => {
    if (!workoutSummary) return null;

    return (
      <Modal visible={showSummaryModal} transparent animationType="slide" onRequestClose={handleCloseSummaryModal}>
        <View style={styles.summaryModalOverlay}>
          <View style={styles.summaryModalContent}>
            <View style={styles.summaryModalHeader}>
              <View style={styles.summarySuccessIcon}>
                <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
              </View>
              <Text style={styles.summaryModalTitle}>Workout Complete!</Text>
              <Text style={styles.summaryModalSubtitle}>Great job! Here's your workout summary</Text>
            </View>

            <ScrollView style={styles.summaryScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryMetricsGrid}>
                <View style={styles.summaryMetricCard}>
                  <View style={[styles.summaryMetricIcon, { backgroundColor: '#FFF0F0' }]}>
                    <Ionicons name="heart" size={24} color="#FF3B30" />
                  </View>
                  <Text style={styles.summaryMetricValue}>
                    {workoutSummary.averageHeartRate > 0 ? workoutSummary.averageHeartRate : '--'}
                  </Text>
                  <Text style={styles.summaryMetricLabel}>Avg BPM</Text>
                </View>

                <View style={styles.summaryMetricCard}>
                  <View style={[styles.summaryMetricIcon, { backgroundColor: '#FFF0F5' }]}>
                    <Ionicons name="trending-up" size={24} color="#EC4899" />
                  </View>
                  <Text style={styles.summaryMetricValue}>
                    {workoutSummary.maxHeartRate > 0 ? workoutSummary.maxHeartRate : '--'}
                  </Text>
                  <Text style={styles.summaryMetricLabel}>Max BPM</Text>
                </View>

                <View style={styles.summaryMetricCard}>
                  <View style={[styles.summaryMetricIcon, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="flame" size={24} color="#F97316" />
                  </View>
                  <Text style={styles.summaryMetricValue}>{Math.round(workoutSummary.totalCalories)}</Text>
                  <Text style={styles.summaryMetricLabel}>Calories</Text>
                </View>

                <View style={styles.summaryMetricCard}>
                  <View style={[styles.summaryMetricIcon, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="time" size={24} color="#3B82F6" />
                  </View>
                  <Text style={styles.summaryMetricValue}>{formatElapsedTime(workoutSummary.duration)}</Text>
                  <Text style={styles.summaryMetricLabel}>Duration</Text>
                </View>
              </View>

              {workoutSummary.exerciseMetrics.length > 0 && (
                <View style={styles.exerciseMetricsSection}>
                  <Text style={styles.exerciseMetricsSectionTitle}>Exercise Breakdown</Text>
                  {workoutSummary.exerciseMetrics.map((metrics, index) => {
                    const exercise = exercises.find((_, i) => i === index);
                    return (
                      <View key={index} style={styles.exerciseMetricRow}>
                        <View style={styles.exerciseMetricInfo}>
                          <Text style={styles.exerciseMetricName}>{exercise?.exerciseName || `Exercise ${index + 1}`}</Text>
                          <View style={styles.exerciseMetricDetails}>
                            {metrics.averageHeartRate !== undefined && (
                              <View style={styles.exerciseMetricDetail}>
                                <Ionicons name="heart" size={12} color="#FF3B30" />
                                <Text style={styles.exerciseMetricDetailText}>{metrics.averageHeartRate} avg</Text>
                              </View>
                            )}
                            {metrics.maxHeartRate !== undefined && (
                              <View style={styles.exerciseMetricDetail}>
                                <Ionicons name="trending-up" size={12} color="#EC4899" />
                                <Text style={styles.exerciseMetricDetailText}>{metrics.maxHeartRate} max</Text>
                              </View>
                            )}
                            {metrics.caloriesBurned !== undefined && (
                              <View style={styles.exerciseMetricDetail}>
                                <Ionicons name="flame" size={12} color="#F97316" />
                                <Text style={styles.exerciseMetricDetailText}>{Math.round(metrics.caloriesBurned)} kcal</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.healthKitSaveConfirmation}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.healthKitSaveText}>Saved to Apple Health</Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.summaryDoneButton} onPress={handleCloseSummaryModal}>
              <Text style={styles.summaryDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Main render
  return (
    <GestureHandlerRootView style={[styles.container, isInteractiveMode && { backgroundColor: currentTheme.backgroundColor }]}>
      <StatusBar barStyle={isInteractiveMode ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderHealthKitDeniedBanner()}
        {renderStepIndicator()}
        {renderInteractiveHeader()}
        {renderPhaseContent()}
        {renderFooter()}
        {renderRestTimerOverlay()}
        {renderExerciseTimerOverlay()}
      </KeyboardAvoidingView>
      {renderHealthKitPromptModal()}
      {renderWorkoutSummaryModal()}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  animatedContent: { flex: 1 },
  
  // Step indicator styles
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepCircleCompleted: { backgroundColor: '#4CAF50' },
  stepNumber: { fontSize: 12, fontWeight: '600', color: '#666' },
  stepNumberActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: '#666' },
  stepConnector: { width: 24, height: 2, backgroundColor: '#e0e0e0', marginHorizontal: 4, marginBottom: 16 },
  stepConnectorCompleted: { backgroundColor: '#4CAF50' },
  
  // Interactive header styles
  interactiveHeader: { paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  healthMetricsBarInteractive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%', paddingVertical: 12, marginTop: 12 },
  healthMetricItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthMetricValue: { fontSize: 18, fontWeight: '700' },
  healthMetricUnit: { fontSize: 12, opacity: 0.7 },
  sessionControls: { flexDirection: 'row', marginTop: 12 },
  sessionControlButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 8 },
  sessionControlText: { fontSize: 14, fontWeight: '600' },
  
  // Rest timer overlay styles
  restTimerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  restTimerContent: { alignItems: 'center', padding: 24 },
  restTimerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  breathingIndicator: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20, borderWidth: 2 },
  breathingText: { fontSize: 14, fontWeight: '500' },
  nextSetPreview: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextSetLabel: { fontSize: 14, opacity: 0.8 },
  nextSetText: { fontSize: 16, fontWeight: '700' },

  // Exercise timer overlay styles (Requirements: 2.1, 2.2, 2.3)
  exerciseTimerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  exerciseTimerContent: { alignItems: 'center', padding: 24 },
  exerciseTimerTitle: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  exerciseTimerSubtitle: { fontSize: 16, opacity: 0.8, marginBottom: 16 },
  exerciseCompletedBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, marginTop: 16, gap: 8 },
  exerciseCompletedText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  earlyCompleteButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginTop: 16, gap: 6 },
  earlyCompleteText: { fontSize: 14, fontWeight: '600' },
  
  // Timer start button styles
  startTimerButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, gap: 4 },
  startTimerText: { fontSize: 12, fontWeight: '600' },
  
  // Elapsed time counter styles (Requirements: 2.5)
  elapsedTimeContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, gap: 4 },
  elapsedTimeText: { fontSize: 12, fontWeight: '500', fontFamily: 'monospace' },

  // Phase content styles
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
  
  // Exercise card styles
  exerciseCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  exerciseHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  exerciseHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleGroupBadge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  muscleGroupBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  exerciseName: { fontSize: 16, fontWeight: '600', color: '#333' },
  exerciseSetsCount: { fontSize: 12, color: '#666', marginTop: 2 },
  activeIndicator: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  activeIndicatorText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  exerciseContent: { borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingVertical: 8 },
  emptyExercises: { alignItems: 'center', paddingVertical: 48 },
  emptyExercisesText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptyExercisesSubtext: { fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' },

  // Set row styles
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fff' },
  setRowCompleted: { backgroundColor: '#f0fdf4' },
  setRowHighlighted: { backgroundColor: '#FFF7ED', borderLeftWidth: 3, borderLeftColor: '#F97316' },
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
  
  // Core/warmup/cooldown exercise styles
  coreExercisesList: { marginBottom: 24 },
  coreExerciseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  coreExerciseItemCompleted: { backgroundColor: '#f0fdf4', borderColor: '#4CAF50' },
  coreCheckbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  coreExerciseIcon: { marginRight: 12 },
  coreExerciseInfo: { flex: 1 },
  coreExerciseName: { fontSize: 16, color: '#333', fontWeight: '500' },
  coreExerciseDuration: { fontSize: 12, color: '#666', marginTop: 2 },
  coreProgress: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  coreProgressText: { fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'center' },
  coreProgressBar: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  coreProgressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  warmupProgressFill: { height: '100%', backgroundColor: '#F97316', borderRadius: 4 },
  cooldownProgressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  warmupExerciseInfo: { flex: 1 },
  warmupDuration: { fontSize: 12, color: '#666', marginTop: 2 },
  
  // Watch status styles
  watchStatusContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  watchStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  watchStatusDotConnected: { backgroundColor: '#4CAF50' },
  watchStatusDotDisconnected: { backgroundColor: '#999' },
  watchStatusText: { fontSize: 13, color: '#666', marginLeft: 6 },
  watchStatusTextConnected: { color: '#4CAF50' },

  // Footer styles
  footer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  footerSpacer: { flex: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { fontSize: 16, color: '#666', marginLeft: 4 },
  nextButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F97316', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  nextButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginRight: 4 },
  finishButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  finishButtonDisabled: { opacity: 0.6 },
  finishButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  healthKitPromptModal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
  healthKitIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  healthKitPromptTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 12, textAlign: 'center' },
  healthKitPromptDescription: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  healthKitPromptButtons: { width: '100%' },
  healthKitPromptButtonPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B30', paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  healthKitPromptButtonPrimaryText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
  healthKitPromptButtonSecondary: { alignItems: 'center', paddingVertical: 12 },
  healthKitPromptButtonSecondaryText: { fontSize: 15, color: '#666' },
  healthKitDeniedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#FFEDD5' },
  healthKitDeniedText: { flex: 1, fontSize: 13, color: '#F97316', marginHorizontal: 8 },
  
  // Summary modal styles
  summaryModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  summaryModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 34 },
  summaryModalHeader: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, paddingBottom: 16 },
  summarySuccessIcon: { marginBottom: 12 },
  summaryModalTitle: { fontSize: 24, fontWeight: '700', color: '#333', marginBottom: 4 },
  summaryModalSubtitle: { fontSize: 15, color: '#666' },
  summaryScrollView: { maxHeight: 400, paddingHorizontal: 24 },
  summaryMetricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  summaryMetricCard: { width: '48%', backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12 },
  summaryMetricIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryMetricValue: { fontSize: 28, fontWeight: '700', color: '#333', marginBottom: 2 },
  summaryMetricLabel: { fontSize: 13, color: '#666' },
  exerciseMetricsSection: { marginBottom: 24 },
  exerciseMetricsSectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  exerciseMetricRow: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 8 },
  exerciseMetricInfo: { flex: 1 },
  exerciseMetricName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 6 },
  exerciseMetricDetails: { flexDirection: 'row', flexWrap: 'wrap' },
  exerciseMetricDetail: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  exerciseMetricDetailText: { fontSize: 13, color: '#666', marginLeft: 4 },
  healthKitSaveConfirmation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 16 },
  healthKitSaveText: { fontSize: 14, color: '#4CAF50', fontWeight: '500', marginLeft: 8 },
  summaryDoneButton: { backgroundColor: '#4CAF50', marginHorizontal: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  summaryDoneButtonText: { fontSize: 17, fontWeight: '600', color: '#fff' },
});

export default ActiveWorkoutScreen;
