import { StackScreenProps } from '@react-navigation/stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Define the parameter list for the root stack
export type RootStackParamList = {
  HomeList: undefined;
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
    defaultTab?: 'info' | 'scorecard';
    // Add any other params that MatchDetailScreen expects
  };
};

// Define the parameter list for the bottom tabs
export type TabParamList = {
  Home: undefined;
  Stats: undefined;
};

// Navigation props for each screen
export type HomeScreenNavigationProp = StackScreenProps<RootStackParamList, 'HomeList'>;
export type MatchDetailScreenNavigationProp = StackScreenProps<RootStackParamList, 'MatchDetail'>;
export type StatsScreenNavigationProp = BottomTabScreenProps<TabParamList, 'Stats'>;

