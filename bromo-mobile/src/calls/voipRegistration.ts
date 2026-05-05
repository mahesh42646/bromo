import {Platform} from 'react-native';
import {registerVoipToken as registerVoipTokenApi} from '../api/callsApi';

/**
 * Registers PushKit VoIP token with the API (iOS only). Enables CallKit incoming-call pushes when backend/APNs are configured.
 */
export async function registerVoipPushToken(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const VoipPushNotification = require('react-native-voip-push-notification').default;
    VoipPushNotification.registerVoipToken();
    VoipPushNotification.addEventListener('register', (token: string) => {
      if (token) registerVoipTokenApi(token).catch(() => null);
    });
  } catch {
    /* native module optional until Xcode enables Push Notifications + VoIP */
  }
}
