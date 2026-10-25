import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from '../theme';

// Screens draw their own playful headers, so native headers are off. Native
// push/pop (UINavigationController) instead of a JS card animation, and screens
// that aren't on show are frozen so timers and data updates don't re-render them.
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg },
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animation: 'slide_from_right',
  freezeOnBlur: true,
};
