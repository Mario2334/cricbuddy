// Hand-written @react-navigation/native mock for the node test environment
// (the package ships ES modules). Outside a navigator every screen counts as focused.
import React, { createContext, useEffect } from 'react';

export const NavigationContext = createContext<any>(undefined);
export const useIsFocused = () => true;
export const useFocusEffect = (effect: () => void | (() => void)) => useEffect(effect, [effect]);
export const useNavigation = () => ({
  navigate: () => undefined,
  goBack: () => undefined,
  setParams: () => undefined,
  getParent: () => undefined,
  addListener: () => () => undefined,
  isFocused: () => true,
});
export const NavigationContainer = ({ children }: { children?: React.ReactNode }) => children ?? null;
export const DefaultTheme = { dark: false, colors: {}, fonts: {} };
export const getFocusedRouteNameFromRoute = () => undefined;
