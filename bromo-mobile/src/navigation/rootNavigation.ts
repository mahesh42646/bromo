import {CommonActions, createNavigationContainerRef} from '@react-navigation/native';
import type {BootstrapParamList} from './bootstrapParamList';

export const navigationRef = createNavigationContainerRef<BootstrapParamList>();

export function resetToApp() {
  navigationRef.dispatch(
    CommonActions.reset({index: 0, routes: [{name: 'App'}]}),
  );
}

export function resetToAuth() {
  navigationRef.dispatch(
    CommonActions.reset({index: 0, routes: [{name: 'Auth'}]}),
  );
}

export function resetToOnboarding() {
  navigationRef.dispatch(
    CommonActions.reset({index: 0, routes: [{name: 'Onboarding'}]}),
  );
}
