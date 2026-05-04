import React, {useEffect, useRef} from 'react';
import {navigationRef} from '../navigation/rootNavigation';
import {useAuth} from '../context/AuthContext';
import {socketService, type CallSocketIncoming} from '../services/socketService';

/**
 * Listens for incoming WebRTC call invites and navigates to VoiceCall / VideoCall on the app stack.
 */
export function CallProvider({children}: {children: React.ReactNode}) {
  const {dbUser} = useAuth();
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dbUser?._id) return;

    socketService.connect().catch(() => {
      /* ignore */
    });

    const off = socketService.on('call:incoming', (payload: CallSocketIncoming) => {
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
    });

    return () => {
      off();
    };
  }, [dbUser?._id]);

  return <>{children}</>;
}
