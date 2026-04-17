import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  type VideoFile,
  type PhotoFile,
} from 'react-native-vision-camera';
import {ChevronLeft, Repeat2, Zap, ZapOff} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList>;

const MAX_REEL_MS = 90_000;
const LONG_PRESS_MS = 220; // hold threshold before record starts

/** See useHubCameraCapture — iOS mic+record often triggers -10868 and freezes preview. */
const ENABLE_RECORD_AUDIO = Platform.OS !== 'ios';

export function InAppCameraScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const {setAssets, draft} = useCreateDraft();

  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [position, setPosition] = useState<'front' | 'back'>('back');
  const [flashOn, setFlashOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [cameraInstanceKey, setCameraInstanceKey] = useState(0);

  const recoverCameraSession = useCallback((error?: unknown) => {
    if (error) console.warn('[InAppCamera] recover session after error', error);
    setCameraInstanceKey(k => k + 1);
  }, []);

  const cameraRef = useRef<Camera>(null);
  const recordingRef = useRef(false);
  const recordStart = useRef<number>(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const device = useCameraDevice(position);

  useEffect(() => {
    (async () => {
      const cam = await Camera.getCameraPermissionStatus();
      let camOk = cam === 'granted';
      if (!camOk) {
        const r = await Camera.requestCameraPermission();
        camOk = r === 'granted';
      }
      let micOk = true;
      if (ENABLE_RECORD_AUDIO) {
        const mic = await Camera.getMicrophonePermissionStatus();
        micOk = mic === 'granted';
        if (!micOk) {
          const r = await Camera.requestMicrophonePermission();
          micOk = r === 'granted';
        }
      }
      setPermission(camOk && micOk ? 'granted' : 'denied');
    })();
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (recordTimer.current) clearInterval(recordTimer.current);
    };
  }, []);

  const onPhoto = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      const photo: PhotoFile = await cam.takePhoto({
        flash: flashOn && position === 'back' ? 'on' : 'off',
      });
      const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      setAssets([{uri, type: 'image'}]);
      navigation.navigate('MediaEditor');
    } catch (e) {
      console.warn('[InAppCamera] photo error', e);
    }
  }, [flashOn, navigation, position, setAssets]);

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
      if (elapsed >= MAX_REEL_MS) stopRecording();
    }, 100);

    const torchWhileRecording =
      flashOn && position === 'back' ? ('on' as const) : ('off' as const);
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
        setAssets([{uri, type: 'video', duration: Math.max(0.1, fileDur)}]);
        navigation.navigate('MediaEditor');
      },
      onRecordingError: (err) => {
        if (recordTimer.current) {
          clearInterval(recordTimer.current);
          recordTimer.current = null;
        }
        recordingRef.current = false;
        setRecording(false);
        console.warn('[InAppCamera] record error', err);
        recoverCameraSession(err);
      },
    });
  }, [flashOn, navigation, position, recoverCameraSession, setAssets, stopRecording]);

  /** Reel: press in starts recording, release stops. Story: tap = photo, hold = video. */
  const onPressIn = useCallback(() => {
    if (draft.mode === 'reel') {
      startRecording();
      return;
    }
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      startRecording();
    }, LONG_PRESS_MS);
  }, [draft.mode, startRecording]);

  const onPressOut = useCallback(() => {
    if (draft.mode === 'reel') {
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
  }, [draft.mode, onPhoto, stopRecording]);

  const recordProgressPct = useMemo(
    () => Math.min(100, (recordMs / MAX_REEL_MS) * 100),
    [recordMs],
  );
  const recordSeconds = useMemo(() => (recordMs / 1000).toFixed(1), [recordMs]);

  if (permission === 'denied') {
    return (
      <ThemedSafeScreen style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 32}}>
        <Text style={{color: palette.foreground, textAlign: 'center', marginBottom: 16}}>
          Camera & microphone access needed to capture photos and record video.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} style={{backgroundColor: palette.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12}}>
          <Text style={{color: palette.primaryForeground, fontWeight: '700'}}>Open settings</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={{marginTop: 12}}>
          <Text style={{color: palette.foregroundSubtle}}>Cancel</Text>
        </Pressable>
      </ThemedSafeScreen>
    );
  }

  if (permission === 'pending' || !device) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <Camera
        key={`inapp-vc-${cameraInstanceKey}`}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        photo
        video
        audio={ENABLE_RECORD_AUDIO}
        onError={recoverCameraSession}
      />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <ChevronLeft size={26} color="#fff" />
        </Pressable>
        <View style={{flex: 1}} />
        <Pressable onPress={() => setFlashOn((f) => !f)} hitSlop={12} style={styles.iconBtn}>
          {flashOn ? <Zap size={22} color="#fff" /> : <ZapOff size={22} color="#fff" />}
        </Pressable>
        <Pressable onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))} hitSlop={12} style={styles.iconBtn}>
          <Repeat2 size={22} color="#fff" />
        </Pressable>
      </View>

      {recording && (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>{recordSeconds}s</Text>
        </View>
      )}

      <View style={[styles.bottomBar, {paddingBottom: Math.max(insets.bottom, 18)}]}>
        <Text style={styles.hint}>
          {draft.mode === 'reel' ? 'Press and release to record' : 'Tap for photo · Hold to record'}
        </Text>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityLabel="Capture"
          style={styles.shutterWrap}>
          <View style={[styles.shutterRing, recording && styles.shutterRingRec]}>
            <View style={[styles.shutterCore, recording && styles.shutterCoreRec]} />
          </View>
          {recording && (
            <View style={[styles.progressArc, {width: `${recordProgressPct}%`}]} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    zIndex: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 3,
  },
  recDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444'},
  recText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 16,
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  hint: {color: '#fff', fontSize: 12, opacity: 0.85},
  shutterWrap: {alignItems: 'center', justifyContent: 'center'},
  shutterRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingRec: {borderColor: '#ef4444'},
  shutterCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  shutterCoreRec: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  progressArc: {
    position: 'absolute',
    bottom: -6,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ef4444',
  },
});
