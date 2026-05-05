/**
 * BROMO Mobile App
 */
import './global.css';
import React, {useEffect} from 'react';
import {registerGlobals} from 'react-native-webrtc';
import {Platform, StatusBar, View} from 'react-native';

registerGlobals();
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider, useTheme} from './src/context/ThemeContext';
import {AuthProvider} from './src/context/AuthContext';
import {PlaybackMuteProvider} from './src/context/PlaybackMuteContext';
import {BootstrapNavigator} from './src/navigation/BootstrapNavigator';
import {navigationRef} from './src/navigation/rootNavigation';
import {CallProvider} from './src/calls/CallProvider';
import {linking} from './src/navigation/deepLinks';
import {setupPushNavigationHandlers} from './src/services/pushRegistration';
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';
import {queryClient, queryPersister} from './src/lib/queryClient';

function AppContent() {
  const {isDark, palette} = useTheme();

  useEffect(() => setupPushNavigationHandlers(), []);
  const baseNav = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNav,
    colors: {
      ...baseNav.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.background,
      text: palette.foreground,
      border: palette.border,
      notification: palette.primary,
    },
  };
  return (
    <View style={{flex: 1, backgroundColor: palette.background}}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={palette.background}
        translucent={Platform.OS === 'android' ? false : true}
      />
      <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking}>
        <CallProvider>
          <BootstrapNavigator />
        </CallProvider>
      </NavigationContainer>
    </View>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <PlaybackMuteProvider>
              <PersistQueryClientProvider
                client={queryClient}
                persistOptions={{persister: queryPersister, maxAge: 24 * 60 * 60 * 1000}}>
                <AppContent />
              </PersistQueryClientProvider>
            </PlaybackMuteProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
