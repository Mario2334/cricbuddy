import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 64;

export function tabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12);
}

/** Space to leave under scroll content, FABs and toasts for the floating tab bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + tabBarBottom(insets.bottom) + 16;
}
