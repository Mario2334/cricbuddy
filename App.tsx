import 'react-native-gesture-handler';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';

import { RootTabs } from './src/navigation/RootTabs';
import { navTheme } from './src/navigation/navTheme';
import { useTabBarSpace } from './src/navigation/useTabBarSpace';
import { ConfettiProvider } from './src/ui/Confetti';
import { MeshClockProvider } from './src/ui/MeshBackground';
import { toastConfig } from './src/ui/PlayToast';
import { colors } from './src/theme';
import { fontAssets } from './src/theme/fontAssets';

// Toasts sit below the notch and above the floating tab bar.
function ThemedToast() {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  return <Toast config={toastConfig} topOffset={insets.top + 8} bottomOffset={tabBarSpace + 8} />;
}

const App: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  if (fontError) {
    console.warn('Failed to load fonts', fontError);
  }

  // Bundled fonts load in a blink; hold a cream frame so text never flashes the system font.
  if (!fontsLoaded && !fontError) {
    return <View style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {/* No root fade: animating an ancestor's opacity breaks iOS blur views. */}
        <MeshClockProvider>
          <ConfettiProvider>
            <NavigationContainer theme={navTheme}>
              <RootTabs />
            </NavigationContainer>
          </ConfettiProvider>
        </MeshClockProvider>
        <ThemedToast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});

export default App;
