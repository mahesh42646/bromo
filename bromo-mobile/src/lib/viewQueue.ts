import {AppState} from 'react-native';
import {authedFetch} from '../api/authApi';

/**
 * Batches post view / watch-time updates to cut API traffic (~20–50x fewer requests
 * during fast scrolling). Impressions are deduped per app session per postId.
 */
type Pending = {impression: boolean; watchMs: number};

const pending = new Map<string, Pending>();
const sessionImpression = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 12_000;
const MAX_BATCH = 35;
let useBatchEndpoint = true;

function mergePending(postId: string, watchMs: number): void {
  const id = String(postId);
  const cur = pending.get(id) ?? {impression: false, watchMs: 0};
  if (watchMs <= 0) {
    if (!sessionImpression.has(id)) {
      cur.impression = true;
      sessionImpression.add(id);
    }
  } else {
    cur.watchMs += watchMs;
  }
  if (!cur.impression && cur.watchMs <= 0) return;
  pending.set(id, cur);
}

async function flushNow(): Promise<void> {
  if (pending.size === 0) return;
  const entries = [...pending.entries()];
  pending.clear();
  const chunk = entries.slice(0, MAX_BATCH);

  const items = chunk.map(([postId, p]) => ({
    postId,
    watchMs: p.watchMs,
    impression: p.impression,
  }));

  if (useBatchEndpoint) {
    try {
      const res = await authedFetch('/posts/views/batch', {
        method: 'POST',
        body: JSON.stringify({items}),
      });
      if (res.status === 404) {
        useBatchEndpoint = false;
        await flushLegacy(chunk);
      }
    } catch {
      useBatchEndpoint = false;
      await flushLegacy(chunk);
    }
    return;
  }
  await flushLegacy(chunk);
}

async function flushLegacy(chunk: [string, Pending][]): Promise<void> {
  for (const [postId, p] of chunk) {
    try {
      if (p.impression) {
        await authedFetch(`/posts/${encodeURIComponent(postId)}/view`, {
          method: 'POST',
          body: JSON.stringify({watchMs: 0}),
        });
      }
      if (p.watchMs > 0) {
        await authedFetch(`/posts/${encodeURIComponent(postId)}/view`, {
          method: 'POST',
          body: JSON.stringify({watchMs: Math.round(p.watchMs)}),
        });
      }
    } catch {
      /* ignore */
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, FLUSH_MS);
}

/** Fire-and-forget: coalesces with other views; flushes on timer or app background. */
export function queuePostView(postId: string, watchMs = 0): void {
  mergePending(postId, watchMs);
  if (pending.size >= MAX_BATCH) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushNow();
    return;
  }
  scheduleFlush();
}

export function flushPostViews(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  return flushNow();
}

/** @deprecated use queuePostView — kept for one-off call sites */
export async function recordViewImmediate(postId: string, watchMs = 0): Promise<void> {
  queuePostView(postId, watchMs);
  await flushPostViews();
}

AppState.addEventListener('change', s => {
  if (s === 'background' || s === 'inactive') void flushPostViews();
});

export async function resetViewQueueForLogout(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushNow();
  sessionImpression.clear();
  useBatchEndpoint = true;
}
