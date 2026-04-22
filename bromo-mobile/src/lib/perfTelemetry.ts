import {AppState} from 'react-native';
import {getAuth, getIdToken as firebaseGetIdToken} from '@react-native-firebase/auth';
import {settings} from '../config/settings';

type PerfEventName =
  | 'app_open'
  | 'home_first_feed_response'
  | 'home_first_paint'
  | 'reels_first_feed_response'
  | 'reels_first_frame'
  | 'video_qoe';

type PerfPayload = Record<string, unknown> & {
  event: PerfEventName;
  ts: number;
  sessionId: string;
};

const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const marks = new Map<string, number>();
let flushedAppState = AppState.currentState;
/** Avoid one perf POST per reel during scroll — keep a single cold-start sample. */
let reelsFirstFrameTelemetrySent = false;

function now(): number {
  return Date.now();
}

export function perfMark(name: string): void {
  marks.set(name, now());
}

export function perfMeasure(name: string, fromMark: string): number | null {
  const from = marks.get(fromMark);
  if (!from) return null;
  const ms = now() - from;
  marks.set(name, ms);
  return ms;
}

function apiBase(): string {
  const base = settings.apiBaseUrl?.trim().replace(/\/+$/, '');
  return base || 'https://bromo.darkunde.in';
}

export function trackPerfEvent(event: PerfEventName, data: Record<string, unknown> = {}): void {
  if (event === 'reels_first_frame') {
    if (reelsFirstFrameTelemetrySent) return;
    reelsFirstFrameTelemetrySent = true;
  }
  const payload: PerfPayload = {
    event,
    ts: now(),
    sessionId,
    appState: flushedAppState,
    ...data,
  };
  void (async () => {
    try {
      const user = getAuth().currentUser;
      const token = user ? await firebaseGetIdToken(user, false).catch(() => null) : null;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      try {
        await fetch(`${apiBase()}/posts/perf-event`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
          },
          body: JSON.stringify(payload),
        });
      } finally {
        clearTimeout(t);
      }
    } catch {
      // Telemetry must never block UX.
    }
  })();
}

export function trackVideoQoe(data: {
  postId?: string;
  context: 'feed' | 'reel' | 'story';
  firstFrameMs?: number;
  rebufferCount?: number;
  rebufferDurationMs?: number;
  startupError?: string | null;
  networkType?: string;
}): void {
  void trackPerfEvent('video_qoe', data);
}

AppState.addEventListener('change', nextState => {
  flushedAppState = nextState;
});
