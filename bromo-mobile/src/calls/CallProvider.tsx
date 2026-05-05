import React, {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import {navigationRef} from '../navigation/rootNavigation';
import {useAuth} from '../context/AuthContext';
import {socketService, type CallSocketIncoming} from '../services/socketService';

/**
 * In-app calls only (both users online, socket connected). Incoming `call:incoming` navigates
 * to Voice/Video when the app is in the foreground. Background / CallKit / push wake — coming later
 * (requires Apple Developer Program on iOS for push + associated domains).
 */
export function CallProvider({children}: {children: React.ReactNode}) {
  const {dbUser} = useAuth();
  const seenRef = useRef<string | null>(null);
  const appActiveRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      appActiveRef.current = next === 'active';
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!dbUser?._id) return;
    let cancelled = false;
    let offIncoming: (() => void) | undefined;

    const navigateToCall = (payload: CallSocketIncoming) => {
      if (seenRef.current === payload.callId) return;
      seenRef.current = payload.callId;

      const routeName = payload.callType === 'video' ? 'VideoCall' : 'VoiceCall';
      const peerLabel = payload.callerName?.trim() || 'Someone';

      const go = () => {
        if (!navigationRef.isReady()) return false;
        navigationRef.navigate('App', {
          screen: routeName,
          params: {
            remoteUserId: payload.fromUserId,
            peerName: peerLabel,
            direction: 'incoming',
            callId: payload.callId,
            callerName: payload.callerName,
          },
        });
        return true;
      };
      if (!go()) {
        setTimeout(() => {
          go();
        }, 400);
      }
    };

    void socketService.connect().then(() => {
      if (cancelled) return;
      offIncoming = socketService.on('call:incoming', payload => {
        if (!appActiveRef.current) return;
        navigateToCall(payload);
      });
    });

    return () => {
      cancelled = true;
      offIncoming?.();
    };
  }, [dbUser?._id]);

  return <>{children}</>;
}
