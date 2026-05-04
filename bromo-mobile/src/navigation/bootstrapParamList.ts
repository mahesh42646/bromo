import type {NavigatorScreenParams} from '@react-navigation/native';
import type {AppStackParamList} from './appStackParamList';

export type BootstrapParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
};
