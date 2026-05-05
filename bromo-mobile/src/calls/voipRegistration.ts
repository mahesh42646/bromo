import {Platform} from 'react-native';
import {registerVoipToken as registerVoipTokenApi} from '../api/callsApi';
import {displayNativeIncomingCall} from './nativeCallBridge';
import type {CallSocketIncoming} from '../services/socketService';

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function notificationPayload(notification: Record<string, unknown>): CallSocketIncoming | null {
  const callId = stringValue(notification.callId || notification.uuid);
  const fromUserId = stringValue(notification.fromUserId || notification.handle);
  if (!callId || !fromUserId) return null;
  return {
    callId,
    fromUserId,
    callType: stringValue(notification.callType) === 'video' ? 'video' : 'audio',
    callerName: stringValue(notification.callerName || notification.name) || undefined,
  };
}

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
    VoipPushNotification.addEventListener('notification', (notification: Record<string, unknown>) => {
      const payload = notificationPayload(notification);
      if (payload) displayNativeIncomingCall(payload);
      const completedId = payload?.callId || stringValue(notification.uuid);
      if (completedId && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
        VoipPushNotification.onVoipNotificationCompleted(completedId);
      }
    });
  } catch {
    /* native module optional until Xcode enables Push Notifications + VoIP */
  }
}
