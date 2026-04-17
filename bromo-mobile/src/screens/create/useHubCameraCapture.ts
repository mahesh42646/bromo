import {useCallback, useEffect, useRef, useState} from 'react';
import {Linking, Platform} from 'react-native';
import {
  Camera,
  useCameraDevice,
  type PhotoFile,
  type VideoFile,
} from 'react-native-vision-camera';
import type {CreateMode} from '../../create/createTypes';
import type {MediaAsset} from '../../create/createTypes';

const MAX_REEL_MS = 90_000;
/** Story: hold at least this long before we treat it as video instead of photo. */
const STORY_LONG_PRESS_MS = 220;

export type HubCamPermission = 'pending' | 'granted' | 'denied';

export function useHubCameraCapture(opts: {
  mode: CreateMode;
  flashOn: boolean;
  facing: 'front' | 'back';
  /** When false, pause the camera session (e.g. screen blurred). */
  isActive: boolean;
  onCaptured: (assets: MediaAsset[]) => void;
  /** New-post grid: live preview in the hero (tap = photo, hold = video). */
  inlinePostCamera?: boolean;
}) {
  const {mode, flashOn, facing, isActive, onCaptured, inlinePostCamera = false} = opts;
  const inlinePost = mode === 'post' && inlinePostCamera;
  const [permission, setPermission] = useState<HubCamPermission>('pending');
  const cameraRef = useRef<Camera>(null);
  const recordingRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStart = useRef(0);

  const device = useCameraDevice(facing);
  /** iOS: VisionCamera often hits kAudioUnitErr_FormatNotSupported (-10868) when recording with mic; preview then freezes. Video has no mic audio on iOS until upstream fixes. */
  const enableRecordAudio = Platform.OS !== 'ios';
  const [cameraInstanceKey, setCameraInstanceKey] = useState(0);

  const recoverCameraSession = useCallback((error?: unknown) => {
    if (error) console.warn('[HubCamera] recover session after error', error);
    setCameraInstanceKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!isActive || (mode === 'post' && !inlinePost)) return;
    let cancelled = false;
    (async () => {
      const cam = await Camera.getCameraPermissionStatus();
      let camOk = cam === 'granted';
      if (!camOk) {
        const r = await Camera.requestCameraPermission();
        camOk = r === 'granted';
      }
      let micOk = true;
      const wantMic = mode === 'reel' || mode === 'story' || mode === 'live' || inlinePost;
      const needMic = wantMic && enableRecordAudio;
      if (needMic) {
        const mic = await Camera.getMicrophonePermissionStatus();
        micOk = mic === 'granted';
        if (!micOk) {
          const r = await Camera.requestMicrophonePermission();
          micOk = r === 'granted';
        }
      }
      if (!cancelled) {
        setPermission(camOk && micOk ? 'granted' : 'denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enableRecordAudio, isActive, inlinePost, mode]);

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  const stopRecording = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      await cam.stopRecording();
    } catch {
      /* ignore */
    }
  }, []);

  const startRecording = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam || recordingRef.current) return;
    recordingRef.current = true;
    setRecording(true);
    setRecordMs(0);
    recordStart.current = Date.now();
    recordTimer.current = setInterval(() => {
      const elapsed = Date.now() - recordStart.current;
      setRecordMs(elapsed);
      if (elapsed >= MAX_REEL_MS) void stopRecording();
    }, 100);

    const torchWhileRecording =
      flashOn && facing === 'back' ? ('on' as const) : ('off' as const);
    const iosRecording =
      Platform.OS === 'ios'
        ? {fileType: 'mov' as const, videoCodec: 'h264' as const}
        : {};

    cam.startRecording({
      flash: torchWhileRecording,
      ...iosRecording,
      onRecordingFinished: (video: VideoFile) => {
        if (recordTimer.current) {
          clearInterval(recordTimer.current);
          recordTimer.current = null;
        }
        recordingRef.current = false;
        setRecording(false);
        const uri = Platform.OS === 'android' ? `file://${video.path}` : video.path;
        const fileDur =
          typeof (video as {duration?: number}).duration === 'number'
            ? (video as {duration: number}).duration
            : (Date.now() - recordStart.current) / 1000;
        onCaptured([{uri, type: 'video', duration: Math.max(0.1, fileDur)}]);
      },
      onRecordingError: err => {
        if (recordTimer.current) {
          clearInterval(recordTimer.current);
          recordTimer.current = null;
        }
        recordingRef.current = false;
        setRecording(false);
        console.warn('[HubCamera] record error', err);
        recoverCameraSession(err);
      },
    });
  }, [facing, flashOn, onCaptured, recoverCameraSession, stopRecording]);

  const onPhoto = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      const photo: PhotoFile = await cam.takePhoto({
        flash: flashOn && facing === 'back' ? 'on' : 'off',
      });
      const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      onCaptured([{uri, type: 'image'}]);
    } catch (e) {
      console.warn('[HubCamera] photo error', e);
    }
  }, [facing, flashOn, onCaptured]);

  /** Reel: press starts recording immediately; release stops. Story / inline post: short tap = photo, hold = video. */
  const onShutterPressIn = useCallback(() => {
    if (mode === 'live' || (mode === 'post' && !inlinePost)) return;
    if (mode === 'reel') {
      startRecording();
      return;
    }
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      startRecording();
    }, STORY_LONG_PRESS_MS);
  }, [inlinePost, mode, startRecording]);

  const onShutterPressOut = useCallback(() => {
    if (mode === 'live' || (mode === 'post' && !inlinePost)) return;
    if (mode === 'reel') {
      if (recordingRef.current) void stopRecording();
      return;
    }
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      void onPhoto();
      return;
    }
    if (recordingRef.current) void stopRecording();
  }, [inlinePost, mode, onPhoto, stopRecording]);

  useEffect(() => {
    if (!isActive && recordingRef.current) {
      void stopRecording();
    }
  }, [isActive, stopRecording]);

  const needsCamera = mode === 'reel' || mode === 'story' || mode === 'live' || inlinePost;
  const showCamera =
    needsCamera && permission === 'granted' && device != null && isActive;

  return {
    cameraRef,
    device,
    permission,
    recording,
    recordMs,
    showCamera,
    needsCamera,
    cameraInstanceKey,
    enableRecordAudio,
    recoverCameraSession,
    onShutterPressIn,
    onShutterPressOut,
    openSettings: () => Linking.openSettings(),
  };
}
