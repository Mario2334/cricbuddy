import { StackScreenProps } from '@react-navigation/stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Match } from './Match';

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
    city?: string;
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

// Extend the navigation prop types for each screen's props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
