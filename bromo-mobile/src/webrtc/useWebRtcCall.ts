import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import RTCIceCandidateEvent from 'react-native-webrtc/lib/typescript/RTCIceCandidateEvent';
import RTCTrackEvent from 'react-native-webrtc/lib/typescript/RTCTrackEvent';
import {fetchTurnCredentials} from '../api/callsApi';
import {socketService} from '../services/socketService';

export type CallMedia = 'audio' | 'video';
export type CallDirection = 'outgoing' | 'incoming';

type MediaStreamT = Awaited<ReturnType<typeof mediaDevices.getUserMedia>>;

type IceServersArg = NonNullable<ConstructorParameters<typeof RTCPeerConnection>[0]>['iceServers'];

const DEFAULT_STUN: IceServersArg = [{urls: 'stun:stun.l.google.com:19302'}];

function newCallId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

async function getIceServers(): Promise<IceServersArg> {
  try {
    const c = await fetchTurnCredentials();
    if (c?.iceServers?.length) return c.iceServers as IceServersArg;
  } catch {
    /* ignore */
  }
  return DEFAULT_STUN;
}

async function ensureAndroidPermissions(video: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const need = video
    ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, PermissionsAndroid.PERMISSIONS.CAMERA]
    : [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  const res = await PermissionsAndroid.requestMultiple(need);
  return need.every(p => res[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export type UseWebRtcCallArgs = {
  media: CallMedia;
  direction: CallDirection;
  remoteUserId: string;
  initialCallId?: string;
  callerLabel?: string;
  selfUserId: string;
};

export type CallUiStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'error';

/** react-native-webrtc extends EventTarget but typings omit `addEventListener`. */
type RNPeerConn = RTCPeerConnection & {
  addEventListener(type: 'icecandidate', listener: (ev: RTCIceCandidateEvent<'icecandidate'>) => void): void;
  addEventListener(type: 'track', listener: (ev: RTCTrackEvent<'track'>) => void): void;
  addEventListener(type: 'connectionstatechange', listener: () => void): void;
};

export function useWebRtcCall(args: UseWebRtcCallArgs) {
  const {media, direction, remoteUserId, initialCallId, callerLabel, selfUserId} = args;

  const [status, setStatus] = useState<CallUiStatus>(() =>
    direction === 'incoming' ? 'ringing' : 'idle',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStreamT | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStreamT | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | null>(
    direction === 'incoming' && initialCallId ? initialCallId : null,
  );
  const remoteUserIdRef = useRef(remoteUserId);
  const directionRef = useRef(direction);
  const mediaRef = useRef(media);
  const selfUserIdRef = useRef(selfUserId);
  const pendingIceRef = useRef<Array<Record<string, unknown>>>([]);
  const statusRef = useRef<CallUiStatus>(status);

  useEffect(() => {
    remoteUserIdRef.current = remoteUserId;
    directionRef.current = direction;
    mediaRef.current = media;
    selfUserIdRef.current = selfUserId;
    statusRef.current = status;
  }, [remoteUserId, direction, media, selfUserId, status]);

  useEffect(() => {
    if (direction === 'incoming' && initialCallId) {
      callIdRef.current = initialCallId;
    }
  }, [direction, initialCallId]);

  const drainIce = useCallback((pc: RTCPeerConnection) => {
    const q = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const raw of q) {
      pc.addIceCandidate(new RTCIceCandidate(raw)).catch(() => {
        /* ignore */
      });
    }
  }, []);

  const tearDown = useCallback(() => {
    try {
      pcRef.current?.getSenders().forEach(s => s.track?.stop());
    } catch {
      /* ignore */
    }
    pcRef.current?.close();
    pcRef.current = null;
    pendingIceRef.current = [];
    setLocalStream(prev => {
      prev?.getTracks().forEach(t => t.stop());
      return null;
    });
    setRemoteStream(null);
  }, []);

  const createPc = useCallback(async (): Promise<RTCPeerConnection> => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({iceServers}) as RNPeerConn;
    pc.addEventListener('icecandidate', (ev: RTCIceCandidateEvent<'icecandidate'>) => {
      const cid = callIdRef.current;
      const target = remoteUserIdRef.current;
      const cand = ev.candidate;
      if (!cid || !target || !cand) return;
      socketService.emitCallIce({
        toUserId: target,
        callId: cid,
        candidate: cand.toJSON(),
      });
    });
    pc.addEventListener('track', (ev: RTCTrackEvent<'track'>) => {
      const rs = ev.streams[0];
      if (rs) setRemoteStream(rs);
    });
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      if (st === 'connected') setStatus('active');
      if (st === 'failed' || st === 'closed') {
        setStatus(prev => (prev === 'ended' ? prev : 'ended'));
      }
    });
    return pc;
  }, []);

  const attachLocalMedia = useCallback(async (pc: RTCPeerConnection) => {
    const video = mediaRef.current === 'video';
    const ok = await ensureAndroidPermissions(video);
    if (!ok) {
      setErrorMessage('Microphone or camera permission denied');
      setStatus('error');
      throw new Error('permission');
    }
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: video ? {facingMode: 'user'} : false,
    });
    setLocalStream(stream);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    return stream;
  }, []);

  const handleRemoteSdp = useCallback(
    async (payload: {
      callId: string;
      fromUserId: string;
      sdp: string;
      sdpType: 'offer' | 'answer';
    }) => {
      if (payload.callId !== callIdRef.current) return;
      if (payload.fromUserId === selfUserIdRef.current) return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription({type: payload.sdpType, sdp: payload.sdp}),
        );
        drainIce(pc);
        if (payload.sdpType === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const sdp = pc.localDescription?.sdp ?? answer.sdp;
          if (!sdp || !callIdRef.current) return;
          socketService.emitCallSdp({
            toUserId: payload.fromUserId,
            callId: callIdRef.current,
            sdp,
            sdpType: 'answer',
          });
        }
      } catch {
        setErrorMessage('Could not complete handshake');
        setStatus('error');
      }
    },
    [drainIce],
  );

  const handleRemoteIce = useCallback(
    async (payload: {callId: string; fromUserId: string; candidate: Record<string, unknown> | null}) => {
      if (payload.callId !== callIdRef.current) return;
      if (payload.fromUserId === selfUserIdRef.current) return;
      if (!payload.candidate) return;
      const pc = pcRef.current;
      if (!pc) {
        pendingIceRef.current.push(payload.candidate);
        return;
      }
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          pendingIceRef.current.push(payload.candidate);
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  /** Outgoing: send invite */
  useEffect(() => {
    if (direction !== 'outgoing') return;
    let cancelled = false;
    (async () => {
      await socketService.connect();
      if (cancelled) return;
      const cid = newCallId();
      callIdRef.current = cid;
      setStatus('ringing');
      socketService.emitCallInvite({
        callId: cid,
        toUserId: remoteUserId,
        callType: media === 'video' ? 'video' : 'audio',
        callerName: callerLabel,
      });
    })().catch(() => {
      /* ignore */
    });
    return () => {
      cancelled = true;
    };
  }, [callerLabel, direction, media, remoteUserId]);

  /** Socket listeners — registered once; forward to latest handlers */
  const handlersRef = useRef({
    handleRemoteSdp,
    handleRemoteIce,
    createPc,
    attachLocalMedia,
    tearDown,
  });
  handlersRef.current = {handleRemoteSdp, handleRemoteIce, createPc, attachLocalMedia, tearDown};

  useEffect(() => {
    socketService.connect().catch(() => {
      /* ignore */
    });

    const onAccepted = async (p: {callId: string; peerUserId: string}) => {
      if (directionRef.current !== 'outgoing') return;
      if (p.callId !== callIdRef.current) return;
      setStatus('connecting');
      try {
        const {createPc: mk, attachLocalMedia: mediaAttach} = handlersRef.current;
        const pc = await mk();
        pcRef.current = pc;
        await mediaAttach(pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdp = pc.localDescription?.sdp ?? offer.sdp;
        if (!sdp || !callIdRef.current) return;
        socketService.emitCallSdp({
          toUserId: remoteUserIdRef.current,
          callId: callIdRef.current,
          sdp,
          sdpType: 'offer',
        });
      } catch {
        if (statusRef.current !== 'ended') {
          setErrorMessage('Could not start media');
          setStatus('error');
        }
      }
    };

    const onRejected = (ev: {callId: string}) => {
      if (ev.callId !== callIdRef.current) return;
      setStatus('ended');
      handlersRef.current.tearDown();
    };

    const onEnded = (ev: {callId: string}) => {
      if (ev.callId !== callIdRef.current) return;
      setStatus('ended');
      handlersRef.current.tearDown();
    };

    const offA = socketService.on('call:accepted', onAccepted);
    const offR = socketService.on('call:rejected', onRejected);
    const offE = socketService.on('call:ended', onEnded);
    const offS = socketService.on('call:sdp', payload =>
      handlersRef.current.handleRemoteSdp(
        payload as {callId: string; fromUserId: string; sdp: string; sdpType: 'offer' | 'answer'},
      ),
    );
    const offI = socketService.on('call:ice', payload =>
      handlersRef.current.handleRemoteIce(
        payload as {callId: string; fromUserId: string; candidate: Record<string, unknown> | null},
      ),
    );

    return () => {
      offA();
      offR();
      offE();
      offS();
      offI();
    };
  }, []);

  /** Leave screen — end session */
  useEffect(() => {
    return () => {
      const cid = callIdRef.current;
      const st = statusRef.current;
      const dir = directionRef.current;
      if (cid) {
        if (dir === 'incoming' && st === 'ringing') {
          socketService.emitCallReject({callId: cid});
        } else if (st !== 'ended' && st !== 'idle') {
          socketService.emitCallEnd({callId: cid});
        }
      }
      pcRef.current?.getSenders().forEach(s => s.track?.stop());
      pcRef.current?.close();
      pcRef.current = null;
      pendingIceRef.current = [];
    };
  }, []);

  const acceptIncoming = useCallback(async () => {
    if (directionRef.current !== 'incoming' || !callIdRef.current) return;
    setStatus('connecting');
    setErrorMessage(null);
    try {
      const pc = await createPc();
      pcRef.current = pc;
      await attachLocalMedia(pc);
      socketService.emitCallAccept({callId: callIdRef.current});
    } catch {
      setErrorMessage('Could not start microphone/camera');
      setStatus('error');
    }
  }, [attachLocalMedia, createPc]);

  const rejectIncoming = useCallback(() => {
    if (callIdRef.current) {
      socketService.emitCallReject({callId: callIdRef.current});
    }
    setStatus('ended');
    tearDown();
  }, [tearDown]);

  const endCall = useCallback(() => {
    if (callIdRef.current) {
      socketService.emitCallEnd({callId: callIdRef.current});
    }
    setStatus('ended');
    tearDown();
  }, [tearDown]);

  return useMemo(
    () => ({
      status,
      errorMessage,
      localStream,
      remoteStream,
      acceptIncoming,
      rejectIncoming,
      endCall,
    }),
    [acceptIncoming, endCall, errorMessage, localStream, rejectIncoming, remoteStream, status],
  );
}
