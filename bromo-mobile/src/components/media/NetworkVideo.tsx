import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
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

/** Fast-start presets — start on first 1-2 segments (~200-400ms), let ABR handle quality. */
const BUFFER_PRESETS: Record<string, BufferConfig> = {
  reel: {
    minBufferMs: 1000,
    maxBufferMs: 10000,
    bufferForPlaybackMs: 200,       // start after ~1 segment buffered
    bufferForPlaybackAfterRebufferMs: 600,
    backBufferDurationMs: 0,
  },
  'reel-hls': {
    minBufferMs: 2000,
    maxBufferMs: 15000,
    bufferForPlaybackMs: 300,
    bufferForPlaybackAfterRebufferMs: 800,
    backBufferDurationMs: 2000,
  },
  /** Adjacent (pre-buffer) reels — mounted & paused, buffer as much as possible while user watches current reel. */
  'reel-hls-prebuffer': {
    minBufferMs: 10000,
    maxBufferMs: 30000,
    bufferForPlaybackMs: 300,
    bufferForPlaybackAfterRebufferMs: 800,
    backBufferDurationMs: 0,
  },
  feed: {
    minBufferMs: 3000,
    maxBufferMs: 12000,
    bufferForPlaybackMs: 1200,
    bufferForPlaybackAfterRebufferMs: 2000,
    backBufferDurationMs: 1000,
  },
  'feed-hls': {
    minBufferMs: 4000,
    maxBufferMs: 20000,
    bufferForPlaybackMs: 1200,
    bufferForPlaybackAfterRebufferMs: 2500,
    backBufferDurationMs: 4000,
  },
  story: {
    minBufferMs: 1200,
    maxBufferMs: 12000,
    bufferForPlaybackMs: 500,
    bufferForPlaybackAfterRebufferMs: 1200,
    backBufferDurationMs: 0,
  },
  'story-hls': {
    minBufferMs: 2000,
    maxBufferMs: 15000,
    bufferForPlaybackMs: 800,
    bufferForPlaybackAfterRebufferMs: 1500,
    backBufferDurationMs: 0,
  },
};

/** Safety-net delay per context: time before we force-unblock the poster if native callbacks stall. */
const SAFETY_MS: Record<string, number> = {
  story: 3500,
  reel:  10000,  // extended — reel has no poster overlay, only fires onDecoderReady
  'reel-hls': 10000,
  feed:  1500,
  'feed-hls': 2000,
};

export type NetworkVideoProps = {
  uri: string;
  posterUri?: string;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
  paused?: boolean;
  repeat?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'none';
  /** Included in Metro logs to locate the surface (e.g. feed, reel, story, reel-hls, story-hls). */
  context?: string;
  bufferConfig?: BufferConfig;
  ignoreSilentSwitch?: 'ignore' | 'obey';
  rate?: number;
  preventsDisplaySleepDuringVideoPlayback?: boolean;
  /** When true, show `posterUri` in an overlay until the first frame is ready (avoids black frame + deprecated poster quirks). */
  posterOverlayUntilReady?: boolean;
  /**
   * Max bitrate cap in bps — for ABR ceiling on cellular.
   * Pass from usePlaybackNetworkCap().maxBitRate.
   * Only applies when uri is an HLS master playlist.
   */
  maxBitRate?: number | null;
  /**
   * Progressive MP4 (or other non-HLS) URL — if the primary `uri` (e.g. HLS) errors, retry once with this.
   */
  fallbackUri?: string;
  /** Fires once when the first frame is ready or playback has started (whichever comes first). */
  onDecoderReady?: () => void;
  /** Notified when playback fails after any fallback attempt (after logging to Metro). */
  onPlaybackError?: (detail: string) => void;
  /** Passthrough from `react-native-video` (throttle in parent if needed). */
  onLoad?: (d: OnLoadData) => void;
  onProgress?: (d: OnProgressData) => void;
  onEnd?: () => void;
};

export type NetworkVideoHandle = {
  seek: (seconds: number) => void;
};

/**
 * Remote (or file://) video with correct Android rendering (TextureView, not SurfaceView)
 * and explicit error reporting. Omits `source.type` so the native stack infers format.
 *
 * On Android, `viewType=ViewType.TEXTURE` is mandatory: SurfaceView renders behind ALL
 * React Native views (including transparent wrappers), making every video black.
 */
function uriLooksLikeHls(u: string): boolean {
  return /\.m3u8(\?|$)/i.test(u);
}

export const NetworkVideo = forwardRef<NetworkVideoHandle, NetworkVideoProps>(function NetworkVideo(
  {
    uri,
    fallbackUri,
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
    maxBitRate,
    onDecoderReady,
    onPlaybackError,
    onLoad: onLoadProp,
    onProgress: onProgressProp,
    onEnd,
  },
  ref,
) {
  const [playbackUri, setPlaybackUri] = useState(uri);
  const fallbackTried = useRef(false);
  const videoRef = useRef<React.ElementRef<typeof Video>>(null);
  useImperativeHandle(ref, () => ({
    seek: (seconds: number) => {
      videoRef.current?.seek(seconds);
    },
  }));

  useEffect(() => {
    setPlaybackUri(uri);
    fallbackTried.current = false;
  }, [uri]);

  const bufferKey = uriLooksLikeHls(playbackUri)
    ? context
    : context.replace(/-hls$/, '') || 'reel';
  const resolvedBufferConfig = bufferConfig ?? BUFFER_PRESETS[bufferKey] ?? BUFFER_PRESETS.feed;
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
  }, [playbackUri]);

  // Safety net: if first-frame callbacks never fire (stalled decoder, slow network),
  // unblock poster after a context-appropriate delay. Stories get more time.
  useEffect(() => {
    if (!playbackUri?.trim()) return;
    const ms = SAFETY_MS[bufferKey] ?? SAFETY_MS[context] ?? 2000;
    const t = setTimeout(() => {
      fireDecoderReadyRef.current();
    }, ms);
    return () => clearTimeout(t);
  }, [playbackUri, context, bufferKey]);

  const onLoad = useCallback(
    (d: OnLoadData) => {
      if (__DEV__) {
        console.info(logPrefix, 'onLoad metadata ready', playbackUri);
      }
      // Only propagate metadata (duration, dimensions). Do NOT fire decoder-ready here.
      // onLoad fires when the container/codec headers are parsed — the frame pipeline
      // is not yet running. Unblocking the poster now causes the black-frame flash.
      // We wait for onReadyForDisplay (iOS) or onProgress (Android) instead.
      onLoadProp?.(d);
    },
    [logPrefix, onLoadProp, playbackUri],
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
      console.info(logPrefix, 'buffering', playbackUri);
    }
  }, [logPrefix, playbackUri]);

  const onError = useCallback(
    (e: unknown) => {
      const msg = formatVideoError(e);
      const fb = fallbackUri?.trim();
      if (
        fb &&
        !fallbackTried.current &&
        uriLooksLikeHls(playbackUri) &&
        playbackUri !== fb
      ) {
        fallbackTried.current = true;
        if (__DEV__) {
          console.warn(logPrefix, 'HLS failed, falling back to progressive', {playbackUri, fb, msg});
        }
        setErrorText(null);
        setReady(false);
        setBuffering(false);
        progressed.current = false;
        decoderReadyFired.current = false;
        setPlaybackUri(fb);
        return;
      }
      setErrorText(msg);
      setReady(true);
      console.error(logPrefix, 'playback failed', {uri: playbackUri, error: msg, raw: e});
      onPlaybackError?.(msg);
    },
    [logPrefix, onPlaybackError, playbackUri, fallbackUri],
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
          {playbackUri}
        </Text>
      </View>
    );
  }

  const showPoster = posterOverlayUntilReady && posterUri && !ready;

  return (
    <View style={[styles.wrap, style]}>
      <Video
        ref={videoRef}
        source={{
          uri: playbackUri,
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
        // shutterColor: suppress the black frame that flashes before the first decoded frame.
        shutterColor="transparent"
        rate={rate}
        preventsDisplaySleepDuringVideoPlayback={preventsDisplaySleepDuringVideoPlayback}
        // ABR ceiling: cap bitrate on cellular to prevent buffering stalls.
        // AVPlayer (iOS) + ExoPlayer (Android) both honour maxBitRate on HLS streams.
        maxBitRate={uriLooksLikeHls(playbackUri) ? maxBitRate ?? undefined : undefined}
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
});

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
