import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import MyTeamScreen from '../screens/MyTeamScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import type { RootStackParamList } from '../types/navigation';
import { stackScreenOptions } from './screenOptions';

const Stack = createStackNavigator<RootStackParamList>();

type ListRoute = 'HomeList' | 'MyTeamList' | 'CalendarList';

// Each tab is a list screen that can push MatchDetail.
function makeMatchStack(listName: ListRoute, ListComponent: React.ComponentType<any>) {
  function MatchStack() {
    return (
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name={listName} component={ListComponent} />
        <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      </Stack.Navigator>
    );
  }
  MatchStack.displayName = `${listName}Stack`;
  return MatchStack;
}

export const HomeStack = makeMatchStack('HomeList', HomeScreen);
export const MyTeamStack = makeMatchStack('MyTeamList', MyTeamScreen);
export const CalendarStack = makeMatchStack('CalendarList', CalendarScreen);
