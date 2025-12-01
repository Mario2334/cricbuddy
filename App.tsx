import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import StatsScreen from './src/screens/StatsScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import MyTeamScreen from './src/screens/MyTeamScreen';
import CalendarScreen from './src/screens/CalendarScreen';

// Import navigation types
import { 
  RootStackParamList, 
  TabParamList
} from './src/types/navigation';

// Create stack navigator with proper typing
const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();


// Create a stack navigator for the Home tab
const HomeStack: React.FC = () => {
  return (
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
};

// Create a stack navigator for the MyTeam tab
const MyTeamStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MyTeamList" 
        component={MyTeamScreen} 
        options={{ 
          title: 'My Team',
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
};

// Create a stack navigator for the Calendar tab
const CalendarStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="CalendarList" 
        component={CalendarScreen} 
        options={{ 
          title: 'Calendar',
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
};

// Define the App component with proper typing
const App: React.FC = () => {
  return (
    <>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
              let iconName: keyof typeof Ionicons.glyphMap = 'help';

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Stats') {
                iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              } else if (route.name === 'MyTeam') {
                iconName = focused ? 'people' : 'people-outline';
              } else if (route.name === 'Calendar') {
                iconName = focused ? 'calendar' : 'calendar-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#0066cc',
            tabBarInactiveTintColor: 'gray',
            headerShown: false,
          })}
        >
          <Tab.Screen 
            name="Home" 
            component={HomeStack} 
          />
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
          <Tab.Screen 
            name="MyTeam" 
            component={MyTeamStack}
            options={{
              title: 'My Team',
              headerShown: false,
            }}
          />
          <Tab.Screen 
            name="Calendar" 
            component={CalendarStack}
            options={{
              title: 'Calendar',
              headerShown: false,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
        <Toast />
    </>
  );
};

export default App;
