import React from 'react';
import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, type RouteProp } from '@react-navigation/native';
import StatsScreen from '../screens/StatsScreen';
import LookingForFeedTab from '../features/looking-for-feed/components/LookingForFeedTab';
import type { TabParamList } from '../types/navigation';
import { CalendarStack, HomeStack, MyTeamStack } from './stacks';
import { FloatingTabBar } from './FloatingTabBar';

const Tab = createBottomTabNavigator<TabParamList>();

// The floating bar slides away while a match is open.
const stackTabOptions =
  (title: string) =>
  ({ route }: { route: RouteProp<TabParamList, keyof TabParamList> }): BottomTabNavigationOptions => ({
    title,
    tabBarStyle: getFocusedRouteNameFromRoute(route) === 'MatchDetail' ? { display: 'none' } : undefined,
  });

export function RootTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Tab.Screen name="Home" component={HomeStack} options={stackTabOptions('Home')} />
      <Tab.Screen name="LookingForFeed" component={LookingForFeedTab} options={{ title: 'Find' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'Stats' }} />
      <Tab.Screen name="MyTeam" component={MyTeamStack} options={stackTabOptions('Team')} />
      <Tab.Screen name="Calendar" component={CalendarStack} options={stackTabOptions('Calendar')} />
    </Tab.Navigator>
  );
}

export default RootTabs;
