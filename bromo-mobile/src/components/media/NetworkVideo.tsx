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

type BufferConfig = {
  minBufferMs?: number;
  maxBufferMs?: number;
  bufferForPlaybackMs?: number;
  bufferForPlaybackAfterRebufferMs?: number;
  backBufferDurationMs?: number;
};

/** Fast-start presets — Instagram-like: start after ~1 s of buffered data. */
const BUFFER_PRESETS: Record<string, BufferConfig> = {
  reel: {
    minBufferMs: 2000,
    maxBufferMs: 15000,
    bufferForPlaybackMs: 800,       // start playing after 0.8 s buffered (vs default 2.5 s)
    bufferForPlaybackAfterRebufferMs: 1500,
    backBufferDurationMs: 0,        // don't keep back-buffer; save memory
  },
  feed: {
    minBufferMs: 3000,
    maxBufferMs: 12000,
    bufferForPlaybackMs: 1200,
    bufferForPlaybackAfterRebufferMs: 2000,
    backBufferDurationMs: 1000,
  },
  story: {
    minBufferMs: 1500,
    maxBufferMs: 10000,
    bufferForPlaybackMs: 600,
    bufferForPlaybackAfterRebufferMs: 1200,
    backBufferDurationMs: 0,
  },
};

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
  bufferConfig?: BufferConfig;
  ignoreSilentSwitch?: 'ignore' | 'obey';
  rate?: number;
  preventsDisplaySleepDuringVideoPlayback?: boolean;
  /** When true, show `posterUri` in an overlay until the first frame is ready (avoids black frame + deprecated poster quirks). */
  posterOverlayUntilReady?: boolean;
  /** Fires once when the first frame is ready or playback has started (whichever comes first). */
  onDecoderReady?: () => void;
  /** Notified when playback fails (after logging to Metro). */
  onPlaybackError?: (detail: string) => void;
  /** Passthrough from `react-native-video` (throttle in parent if needed). */
  onLoad?: (d: OnLoadData) => void;
  onProgress?: (d: OnProgressData) => void;
  onEnd?: () => void;
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
  onLoad: onLoadProp,
  onProgress: onProgressProp,
  onEnd,
}: NetworkVideoProps) {
  const resolvedBufferConfig = bufferConfig ?? BUFFER_PRESETS[context] ?? BUFFER_PRESETS.feed;
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

  /** Ref avoids stale timeout + prevents re-arming the safety timer every parent re-render. */
  const fireDecoderReadyRef = useRef(fireDecoderReady);
  fireDecoderReadyRef.current = fireDecoderReady;

  useEffect(() => {
    setReady(false);
    setErrorText(null);
    setBuffering(false);
    progressed.current = false;
    decoderReadyFired.current = false;
  }, [uri]);

  // Safety net: if ready callbacks never fire, unblock poster / parent loading UI after 1 s.
  useEffect(() => {
    if (!uri?.trim()) return;
    const t = setTimeout(() => {
      fireDecoderReadyRef.current();
    }, 1000);
    return () => clearTimeout(t);
  }, [uri]);

  const onLoad = useCallback(
    (d: OnLoadData) => {
      if (__DEV__) {
        console.info(logPrefix, 'onLoad', uri);
      }
      onLoadProp?.(d);
      /** Metadata is ready; unblocks loaders even when `onReadyForDisplay` is delayed (common on Android). */
      fireDecoderReady();
    },
    [fireDecoderReady, logPrefix, onLoadProp, uri],
  );

  const onReadyForDisplay = useCallback(() => {
    fireDecoderReady();
  }, [fireDecoderReady]);

  const onProgress = useCallback(
    (d: OnProgressData) => {
      onProgressProp?.(d);
      if (!progressed.current) {
        progressed.current = true;
        fireDecoderReady();
      }
    },
    [fireDecoderReady, onProgressProp],
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
          headers: {
            'User-Agent': 'BromoMobile/1 (react-native-video)',
          },
          // v6: bufferConfig lives inside source
          bufferConfig: resolvedBufferConfig,
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
        onEnd={onEnd}
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
