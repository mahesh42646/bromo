import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {BootstrapParamList} from './bootstrapParamList';
import {AuthNavigator} from './AuthNavigator';
import {MainAppNavigator} from './MainAppNavigator';
import {OnboardingScreen, SplashScreen} from '../screens/sop/bootstrap/BootstrapScreens';

const Stack = createNativeStackNavigator<BootstrapParamList>();

export function BootstrapNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="App" component={MainAppNavigator} />
    </Stack.Navigator>
  );
}
