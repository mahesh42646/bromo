import messaging from '@react-native-firebase/messaging';
import {registerDeviceToken, removeDeviceToken} from '../api/authApi';

let lastToken: string | null = null;
let unsubscribeRefresh: (() => void) | null = null;

export async function registerPushDevice(): Promise<void> {
  try {
    const status = await messaging().requestPermission();
    const enabled =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;

    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    if (token) {
      lastToken = token;
      await registerDeviceToken(token);
    }

    if (!unsubscribeRefresh) {
      unsubscribeRefresh = messaging().onTokenRefresh(next => {
        lastToken = next;
        registerDeviceToken(next).catch(() => null);
      });
    }
  } catch {
    // Push registration must never block login.
  }
}

export async function unregisterPushDevice(): Promise<void> {
  try {
    if (unsubscribeRefresh) {
      unsubscribeRefresh();
      unsubscribeRefresh = null;
    }
    if (lastToken) {
      await removeDeviceToken(lastToken);
      lastToken = null;
    }
  } catch {
    // Best-effort cleanup; server also removes invalid tokens after failed sends.
  }
}
