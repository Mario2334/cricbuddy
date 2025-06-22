import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

import HomeScreen from './src/screens/HomeScreen';
import StatsScreen from './src/screens/StatsScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Create a stack navigator for the Home tab
const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="HomeList" 
      component={HomeScreen} 
      options={{ 
        title: 'Matches',
        headerStyle: {
          backgroundColor: '#0066cc',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }} 
    />
    <Stack.Screen 
      name="MatchDetail" 
      component={MatchDetailScreen} 
      options={{ 
        title: 'Match Scorecard',
        headerStyle: {
          backgroundColor: '#0066cc',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }} 
    />
  </Stack.Navigator>
);

export default function App() {
  return (
    <GluestackUIProvider config={config}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Stats') {
                iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#0066cc',
            tabBarInactiveTintColor: 'gray',
            headerShown: false, // Hide default header since HomeStack has its own
          })}
        >
          <Tab.Screen name="Home" component={HomeStack} />
          <Tab.Screen 
            name="Stats" 
            component={StatsScreen}
            options={{
              headerShown: true,
              headerStyle: {
                backgroundColor: '#0066cc',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </GluestackUIProvider>
  );
}
