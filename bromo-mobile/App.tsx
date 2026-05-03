/**
 * BROMO Mobile App
 */
import './global.css';
import React from 'react';
import {Platform, StatusBar, View} from 'react-native';
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

function AppContent() {
  const {isDark, palette} = useTheme();
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
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <BootstrapNavigator />
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
              <AppContent />
            </PlaybackMuteProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
