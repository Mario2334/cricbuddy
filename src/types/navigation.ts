import { StackScreenProps } from '@react-navigation/stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MuscleGroup, DailyWorkout } from './fitness';

// Define the parameter list for the root stack
export type RootStackParamList = {
  HomeList: undefined;
  MyTeamList: undefined;
  CalendarList: undefined;
  MatchDetail: { 
    matchId: string; 
    tournamentName: string; 
    teamNames: {
      team1: string;
      team2: string;
    };
    groundName?: string;
    groundId?: number;
    city?: string;
    matchStartTime?: string;
    defaultTab?: 'info' | 'scorecard';
    // Add any other params that MatchDetailScreen expects
  };
};

// Define the parameter list for the Fitness stack
export type FitnessStackParamList = {
  FitnessDashboard: undefined;
  ActiveWorkout: {
    date: string;
    focusAreas: MuscleGroup[];
    existingWorkout?: DailyWorkout;
  };
  ExerciseHistory: {
    exerciseName?: string;
  };
  WorkoutTemplates: undefined;
  WorkoutTemplateDetail: {
    templateId: string;
  };
};

// Define the parameter list for the bottom tabs
export type TabParamList = {
  Home: undefined;
  Stats: undefined;
  MyTeam: undefined;
  Calendar: undefined;
  Fitness: undefined;
};

// Navigation props for each screen
export type HomeScreenNavigationProp = StackScreenProps<RootStackParamList, 'HomeList'>;
export type MatchDetailScreenNavigationProp = StackScreenProps<RootStackParamList, 'MatchDetail'>;
export type StatsScreenNavigationProp = BottomTabScreenProps<TabParamList, 'Stats'>;
export type MyTeamScreenNavigationProp = StackScreenProps<RootStackParamList, 'MyTeamList'>;
export type CalendarScreenNavigationProp = StackScreenProps<RootStackParamList, 'CalendarList'>;
export type FitnessDashboardNavigationProp = StackScreenProps<FitnessStackParamList, 'FitnessDashboard'>;
export type ActiveWorkoutNavigationProp = StackScreenProps<FitnessStackParamList, 'ActiveWorkout'>;
export type ExerciseHistoryNavigationProp = StackScreenProps<FitnessStackParamList, 'ExerciseHistory'>;
export type WorkoutTemplatesNavigationProp = StackScreenProps<FitnessStackParamList, 'WorkoutTemplates'>;
export type WorkoutTemplateDetailNavigationProp = StackScreenProps<FitnessStackParamList, 'WorkoutTemplateDetail'>;
