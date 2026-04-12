import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Video, {ViewType, type OnLoadData, type OnProgressData} from 'react-native-video';

function formatVideoError(e: unknown): string {
  if (e == null) return 'unknown';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'error' in e) {
    const err = (e as {error?: {errorString?: string; localizedDescription?: string; code?: number | string}}).error;
    if (err?.errorString) return err.errorString;
    if (err?.localizedDescription) return String(err.localizedDescription);
    if (err?.code != null) return `code:${err.code}`;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export type NetworkVideoProps = {
  uri: string;
  posterUri?: string;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
  paused?: boolean;
  repeat?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'none';
  /** Included in Metro logs to locate the surface (e.g. feed, reel, story). */
  context?: string;
  bufferConfig?: {
    minBufferMs?: number;
    maxBufferMs?: number;
    bufferForPlaybackMs?: number;
    bufferForPlaybackAfterRebufferMs?: number;
    backBufferDurationMs?: number;
  };
  ignoreSilentSwitch?: 'ignore' | 'obey';
  rate?: number;
  preventsDisplaySleepDuringVideoPlayback?: boolean;
  /** When true, show `posterUri` in an overlay until the first frame is ready (avoids black frame + deprecated poster quirks). */
  posterOverlayUntilReady?: boolean;
  /** Fires once when the first frame is ready or playback has started (whichever comes first). */
  onDecoderReady?: () => void;
  /** Notified when playback fails (after logging to Metro). */
  onPlaybackError?: (detail: string) => void;
};

/**
 * Remote (or file://) video with correct Android rendering (TextureView, not SurfaceView)
 * and explicit error reporting. Omits `source.type` so the native stack infers format.
 *
 * On Android, `viewType=ViewType.TEXTURE` is mandatory: SurfaceView renders behind ALL
 * React Native views (including transparent wrappers), making every video black.
 */
export function NetworkVideo({
  uri,
  posterUri,
  style,
  muted = false,
  paused = false,
  repeat = false,
  resizeMode = 'cover',
  context = 'video',
  bufferConfig,
  ignoreSilentSwitch = 'ignore',
  rate,
  preventsDisplaySleepDuringVideoPlayback,
  posterOverlayUntilReady = true,
  onDecoderReady,
  onPlaybackError,
}: NetworkVideoProps) {
  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const progressed = useRef(false);
  const decoderReadyFired = useRef(false);

  const logPrefix = `[NetworkVideo:${context}]`;

  const fireDecoderReady = useCallback(() => {
    if (decoderReadyFired.current) return;
    decoderReadyFired.current = true;
    setReady(true);
    onDecoderReady?.();
  }, [onDecoderReady]);

  useEffect(() => {
    setReady(false);
    setErrorText(null);
    setBuffering(false);
    progressed.current = false;
    decoderReadyFired.current = false;
  }, [uri]);

  // Safety net: if onReadyForDisplay never fires (e.g. Android surface timing),
  // force-unblock the poster overlay after 6s so users aren't stuck on a black screen.
  useEffect(() => {
    if (!uri?.trim()) return;
    const t = setTimeout(() => {
      if (!decoderReadyFired.current) {
        decoderReadyFired.current = true;
        setReady(true);
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [uri]);

  const onLoad = useCallback((_d: OnLoadData) => {
    if (__DEV__) {
      console.info(logPrefix, 'onLoad', uri);
    }
  }, [logPrefix, uri]);

  const onReadyForDisplay = useCallback(() => {
    fireDecoderReady();
  }, [fireDecoderReady]);

  const onProgress = useCallback(
    (_d: OnProgressData) => {
      if (!progressed.current) {
        progressed.current = true;
        fireDecoderReady();
      }
    },
    [fireDecoderReady],
  );

  const onBuffer = useCallback(({isBuffering}: {isBuffering: boolean}) => {
    setBuffering(isBuffering);
    if (__DEV__ && isBuffering) {
      console.info(logPrefix, 'buffering', uri);
    }
  }, [logPrefix, uri]);

  const onError = useCallback(
    (e: unknown) => {
      const msg = formatVideoError(e);
      setErrorText(msg);
      setReady(true);
      console.error(logPrefix, 'playback failed', {uri, error: msg, raw: e});
      onPlaybackError?.(msg);
    },
    [logPrefix, onPlaybackError, uri],
  );

  if (!uri?.trim()) {
    const msg = 'empty uri';
    console.error(logPrefix, msg);
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.errTitle}>Video URL missing</Text>
        <Text style={styles.errDetail}>{msg}</Text>
      </View>
    );
  }

  if (errorText) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.errTitle}>Video failed</Text>
        <Text style={styles.errDetail} numberOfLines={4}>
          {errorText}
        </Text>
        <Text style={styles.errUri} numberOfLines={2}>
          {uri}
        </Text>
      </View>
    );
  }

  const showPoster = posterOverlayUntilReady && posterUri && !ready;

  return (
    <View style={[styles.wrap, style]}>
      <Video
        source={{
          uri,
          // v6: bufferConfig belongs in source (component-level prop is deprecated)
          ...(bufferConfig ? {bufferConfig} : {}),
        }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        repeat={repeat}
        paused={paused}
        muted={muted}
        ignoreSilentSwitch={ignoreSilentSwitch}
        onLoad={onLoad}
        onReadyForDisplay={onReadyForDisplay}
        onProgress={onProgress}
        onBuffer={onBuffer}
        onError={onError}
        // TextureView renders in the RN view hierarchy (not behind it like SurfaceView).
        // SurfaceView (default) punches through the RN layer → everything above it is black.
        viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
        shutterColor={Platform.OS === 'android' ? 'transparent' : undefined}
        rate={rate}
        preventsDisplaySleepDuringVideoPlayback={preventsDisplaySleepDuringVideoPlayback}
      />
      {showPoster ? (
        <Image
          source={{uri: posterUri}}
          style={[StyleSheet.absoluteFill, styles.poster]}
          resizeMode="cover"
        />
      ) : null}
      {buffering && ready ? (
        <View style={styles.bufferBadge} pointerEvents="none">
          <ActivityIndicator color="#fff" size="small" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  poster: {
    backgroundColor: '#000',
  },
  fallback: {
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  errTitle: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 6,
  },
  errDetail: {
    color: '#a3a3a3',
    fontSize: 11,
    textAlign: 'center',
  },
  errUri: {
    color: '#525252',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
  bufferBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
