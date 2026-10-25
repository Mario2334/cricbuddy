import { TransitionPresets, type StackNavigationOptions } from '@react-navigation/stack';
import { colors } from '../theme';

// Screens draw their own playful headers, so native headers are off.
export const stackScreenOptions: StackNavigationOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: colors.bg },
  gestureEnabled: true,
  ...TransitionPresets.SlideFromRightIOS,
};
