import {Platform} from 'react-native';
import RNCallKeep, {CONSTANTS} from 'react-native-callkeep';
import type {CallSocketIncoming} from '../services/socketService';

let setupDone = false;
const incoming = new Map<string, CallSocketIncoming>();

export function setupNativeCallBridge(handlers: {
  onAnswer: (payload: CallSocketIncoming) => void;
  onEnd: (payload: CallSocketIncoming) => void;
}): () => void {
  if (!setupDone) {
    setupDone = true;
    RNCallKeep.setup({
      ios: {
        appName: 'BROMO',
        supportsVideo: true,
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: 'Phone account permission',
        alertDescription: 'BROMO needs call account access for incoming calls.',
        cancelButton: 'Cancel',
        okButton: 'OK',
        additionalPermissions: [],
        foregroundService: {
          channelId: 'bromo-calls',
          channelName: 'BROMO calls',
          notificationTitle: 'BROMO call in progress',
        },
      },
    }).catch(() => null);
    if (Platform.OS === 'android') {
      RNCallKeep.registerAndroidEvents();
      RNCallKeep.setAvailable(true);
    }
  }

  const answerSub = RNCallKeep.addEventListener('answerCall', ({callUUID}) => {
    const payload = incoming.get(callUUID);
    if (payload) handlers.onAnswer(payload);
  });
  const endSub = RNCallKeep.addEventListener('endCall', ({callUUID}) => {
    const payload = incoming.get(callUUID);
    if (payload) handlers.onEnd(payload);
    incoming.delete(callUUID);
  });

  return () => {
    answerSub.remove();
    endSub.remove();
  };
}

export function displayNativeIncomingCall(payload: CallSocketIncoming): void {
  incoming.set(payload.callId, payload);
  RNCallKeep.displayIncomingCall(
    payload.callId,
    payload.fromUserId,
    payload.callerName || 'BROMO',
    'generic',
    payload.callType === 'video',
  );
}

export function markNativeCallEnded(callId: string): void {
  RNCallKeep.reportEndCallWithUUID(callId, CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
  incoming.delete(callId);
}
