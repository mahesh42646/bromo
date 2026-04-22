import {AppState} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import {settings} from '../config/settings';

type PerfEventName =
  | 'app_open'
  | 'home_first_feed_response'
  | 'home_first_paint'
  | 'reels_first_feed_response'
  | 'reels_first_frame'
  | 'network_request'
  | 'video_qoe';

type PerfPayload = Record<string, unknown> & {
  event: PerfEventName;
  ts: number;
  sessionId: string;
};

const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const marks = new Map<string, number>();
let flushedAppState = AppState.currentState;

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

export async function trackPerfEvent(event: PerfEventName, data: Record<string, unknown> = {}): Promise<void> {
  const payload: PerfPayload = {
    event,
    ts: now(),
    sessionId,
    appState: flushedAppState,
    ...data,
  };
  try {
    const token = await getAuth().currentUser?.getIdToken().catch(() => null);
    await fetch(`${apiBase()}/posts/perf-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry must never block UX.
  }
}

export function trackNetworkRequest(name: string, durationMs: number, ok: boolean): void {
  void trackPerfEvent('network_request', {name, durationMs, ok});
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
