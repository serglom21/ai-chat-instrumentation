import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';

const Stack = createStackNavigator();

// Create navigation container ref using React Navigation's helper
const navigationRef = createNavigationContainerRef();

// Create navigation integration with the CORRECT API for v7
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Initialize Sentry with automatic UI tracking
Sentry.init({
  dsn: 'https://0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704',
  
  // Performance monitoring
  tracesSampleRate: 1.0,
  propagateTraceparent: true,
  
  // Profiling
  _experiments: {
    profilesSampleRate: 1.0,
  },
  
  // Session tracking
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  
  // Native support
  enableNative: true,
  
  // Debug (reduced to suppress benign warnings)
  debug: false, // Set to true for detailed debugging
  environment: __DEV__ ? 'development' : 'production',
  
  // Enable HTTP client tracking for distributed tracing
  enableCaptureFailedRequests: true,
  
  // Add navigation integration for AUTOMATIC ui.load spans
  integrations: [
    navigationIntegration,
    Sentry.reactNativeTracingIntegration(),
  ],
});

console.log('🔍 Sentry initialized with reactNavigationIntegration');

function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          // Register the navigation container for automatic tracking
          navigationIntegration.registerNavigationContainer(navigationRef);
          console.log('✅ Navigation registered - automatic ui.load tracking enabled');
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
          initialRouteName="Home"
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

// Wrap with Sentry error boundary
export default Sentry.wrap(App);
