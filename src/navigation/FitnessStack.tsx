import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { FitnessStackParamList } from '../types/navigation';

// Placeholder screens - will be implemented in later tasks
import FitnessDashboard from '../screens/FitnessDashboard';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import ExerciseHistoryScreen from '../screens/ExerciseHistoryScreen';

const Stack = createStackNavigator<FitnessStackParamList>();

/**
 * FitnessStack Navigator
 * Contains the navigation structure for the Fitness module:
 * - FitnessDashboard: Main fitness overview screen
 * - ActiveWorkout: Step-wizard for logging workouts
 * - ExerciseHistory: View exercise history and progression
 */
const FitnessStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0066cc',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="FitnessDashboard"
        component={FitnessDashboard}
        options={{
          title: 'Fitness',
        }}
      />
      <Stack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{
          title: 'Log Workout',
        }}
      />
      <Stack.Screen
        name="ExerciseHistory"
        component={ExerciseHistoryScreen}
        options={{
          title: 'Exercise History',
        }}
      />
    </Stack.Navigator>
  );
};

export default FitnessStack;
