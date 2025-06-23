import { registerRootComponent } from 'expo';
import { ComponentType } from 'react';

// Import the App component with proper typing
import App from './App';

// Explicitly type the App component to satisfy TypeScript
const TypedApp: ComponentType = App;

/**
 * Entry point for the React Native application.
 * registerRootComponent ensures the environment is set up correctly
 * for both Expo Go and native builds.
 */
registerRootComponent(TypedApp);
