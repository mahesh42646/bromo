import messaging from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import {registerDeviceToken, removeDeviceToken} from '../api/authApi';
import {openBromoDeepLink} from '../navigation/deepLinks';
import {registerVoipPushToken} from '../calls/voipRegistration';
import {navigationRef} from '../navigation/rootNavigation';
import {displayNativeIncomingCall} from '../calls/nativeCallBridge';
import type {CallSocketIncoming} from './socketService';

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

    if (Platform.OS === 'ios') {
      registerVoipPushToken().catch(() => null);
    }
  } catch {
    // Push registration must never block login.
  }
}

function navigateIncomingCallFromPush(data: Record<string, string | object | undefined>): boolean {
  if (data.type !== 'incoming_call') return false;
  const callId = typeof data.callId === 'string' ? data.callId : '';
  const fromUserId = typeof data.fromUserId === 'string' ? data.fromUserId : '';
  const callType = typeof data.callType === 'string' ? data.callType : 'audio';
  const callerName = typeof data.callerName === 'string' ? data.callerName : '';
  if (!callId || !fromUserId) return true;
  const nativePayload: CallSocketIncoming = {
    callId,
    fromUserId,
    callType: callType === 'video' ? 'video' : 'audio',
    callerName: callerName || undefined,
  };
  displayNativeIncomingCall(nativePayload);
  const routeName = callType === 'video' ? 'VideoCall' : 'VoiceCall';
  const go = () => {
    if (!navigationRef.isReady()) return false;
    navigationRef.navigate('App', {
      screen: routeName,
      params: {
        remoteUserId: fromUserId,
        peerName: callerName || 'Someone',
        direction: 'incoming',
        callId,
        callerName,
      },
    });
    return true;
  };
  if (!go()) setTimeout(go, 400);
  return true;
}

/** Wire notification tap → deep link (chat, posts, calls). Call once from App mount. */
export function setupPushNavigationHandlers(): () => void {
  const handleOpen = (remoteMessage: {data?: Record<string, string | object | undefined>} | null) => {
    if (!remoteMessage) return;
    const data = remoteMessage.data as Record<string, string | object | undefined> | undefined;
    if (!data) return;
    const asStrings: Record<string, string | object | undefined> = {...data};
    if (navigateIncomingCallFromPush(asStrings)) return;
    const raw = data.deepLink ?? data.deeplink ?? data.link ?? data.url;
    const url = typeof raw === 'string' ? raw : undefined;
    if (url && !openBromoDeepLink(url)) {
      setTimeout(() => openBromoDeepLink(url), 500);
    }
  };

  const unsubOpened = messaging().onNotificationOpenedApp(handleOpen);
  /** Foreground: only wake call UI — do not auto-navigate on every data message (chat spam). */
  const unsubForeground = messaging().onMessage(message => {
    const data = message.data as Record<string, string | object | undefined> | undefined;
    if (data?.type === 'incoming_call') {
      navigateIncomingCallFromPush(data);
    }
  });

  messaging()
    .getInitialNotification()
    .then(handleOpen)
    .catch(() => null);

  return () => {
    unsubOpened();
    unsubForeground();
  };
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
