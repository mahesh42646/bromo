import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {AuthStackParamList} from './appStackParamList';
import {
  EmailVerificationScreen,
  ForgotPasswordScreen,
  LoginScreen,
  RegisterScreen,
  UsernameSetupScreen,
} from '../screens/sop/auth/AuthScreens';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}} initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} />
    </Stack.Navigator>
  );
}
