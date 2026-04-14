/**
 * HLS segment prefetch — downloads upcoming segments to disk cache
 * so playback starts instantly without buffering.
 *
 * Strategy:
 *  - For the "next" reel: prefetch full variant playlist (all segments).
 *  - For lookahead items (next+2, +3): prefetch first 6 segments only.
 *  - Cellular: always prefer the lowest-bitrate variant to save data.
 *  - Disk cap: LRU eviction when cache exceeds MAX_CACHE_BYTES.
 *
 * Uses react-native-blob-util for chunked fetch + disk write.
 */

import ReactNativeBlobUtil from 'react-native-blob-util';

const SUBDIR = 'bromo-hls-cache';
const MAX_CACHE_BYTES = 300 * 1024 * 1024; // 300 MB hard cap
const LOOKAHEAD_SEGMENTS = 6;

function cacheRoot(): string {
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${SUBDIR}`;
}

async function ensureCacheDir(): Promise<void> {
  const root = cacheRoot();
  if (!(await ReactNativeBlobUtil.fs.exists(root))) {
    await ReactNativeBlobUtil.fs.mkdir(root).catch(() => null);
  }
}

/** Sanitize a string for use as a file/directory name. */
function safeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

/** Parse an m3u8 playlist text to extract absolute segment URLs. */
function parseSegmentUrls(playlistText: string, baseUrl: string): string[] {
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  return playlistText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => (l.startsWith('http') ? l : `${baseDir}${l}`));
}

/** Parse master playlist to get all variant stream URLs. */
function parseVariantUrls(masterText: string, masterUrl: string): Array<{bandwidth: number; url: string}> {
  const baseDir = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  const variants: Array<{bandwidth: number; url: string}> = [];
  const lines = masterText.split('\n').map((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bwM = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bwM ? Number(bwM[1]) : 0;
      const urlLine = lines[i + 1];
      if (urlLine && !urlLine.startsWith('#')) {
        const url = urlLine.startsWith('http') ? urlLine : `${baseDir}${urlLine}`;
        variants.push({bandwidth, url});
        i++;
      }
    }
  }
  return variants;
}

/** Choose the best variant URL given isCellular flag. */
function selectVariant(variants: Array<{bandwidth: number; url: string}>, isCellular: boolean): string | null {
  if (variants.length === 0) return null;
  const sorted = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
  if (isCellular) {
    // Pick lowest bitrate on cellular
    return sorted[0].url;
  }
  // WiFi: pick highest bitrate
  return sorted[sorted.length - 1].url;
}

const prefetchInProgress = new Set<string>();

/**
 * Prefetch HLS segments for a given master playlist URL.
 * @param masterUrl   - absolute URL to master.m3u8
 * @param postId      - unique ID for cache namespace
 * @param isCellular  - if true, pick lowest quality variant
 * @param segmentLimit - max segments to download (null = all)
 */
export function prefetchHlsSegments(
  masterUrl: string,
  postId: string,
  isCellular: boolean,
  segmentLimit: number | null = LOOKAHEAD_SEGMENTS,
): void {
  if (!masterUrl?.trim()) return;
  const key = `${safeKey(postId)}_${isCellular ? 'cell' : 'wifi'}`;
  if (prefetchInProgress.has(key)) return;
  prefetchInProgress.add(key);

  void (async () => {
    try {
      await ensureCacheDir();
      await runPrefetch(masterUrl, postId, isCellular, segmentLimit);
    } catch (e) {
      if (__DEV__) console.warn('[hlsPrefetch] error:', postId, e);
    } finally {
      prefetchInProgress.delete(key);
    }
  })();
}

async function runPrefetch(
  masterUrl: string,
  postId: string,
  isCellular: boolean,
  segmentLimit: number | null,
): Promise<void> {
  // Fetch master playlist
  const masterResp = await ReactNativeBlobUtil.fetch('GET', masterUrl, {
    'User-Agent': 'BromoMobile/1 (hls-prefetch)',
  });
  const masterText = masterResp.text();
  if (!masterText || !masterText.includes('#EXTM3U')) return;

  // If master has variants, pick appropriate one
  let segmentPlaylistUrl: string;
  if (masterText.includes('#EXT-X-STREAM-INF')) {
    const variants = parseVariantUrls(masterText, masterUrl);
    const chosen = selectVariant(variants, isCellular);
    if (!chosen) return;
    segmentPlaylistUrl = chosen;
  } else {
    // masterUrl IS the segment playlist
    segmentPlaylistUrl = masterUrl;
  }

  // Fetch segment playlist
  const playlistResp = await ReactNativeBlobUtil.fetch('GET', segmentPlaylistUrl, {
    'User-Agent': 'BromoMobile/1 (hls-prefetch)',
  });
  const playlistText = playlistResp.text();
  const segmentUrls = parseSegmentUrls(playlistText, segmentPlaylistUrl);

  const toFetch = segmentLimit !== null ? segmentUrls.slice(0, segmentLimit) : segmentUrls;

  const dir = `${cacheRoot()}/${safeKey(postId)}`;
  if (!(await ReactNativeBlobUtil.fs.exists(dir))) {
    await ReactNativeBlobUtil.fs.mkdir(dir).catch(() => null);
  }

  for (const segUrl of toFetch) {
    const segName = segUrl.split('/').pop()?.split('?')[0] ?? 'seg';
    const segPath = `${dir}/${segName}`;
    if (await ReactNativeBlobUtil.fs.exists(segPath)) continue;
    try {
      await ReactNativeBlobUtil.config({path: segPath, timeout: 10000})
        .fetch('GET', segUrl, {'User-Agent': 'BromoMobile/1 (hls-prefetch)'})
        .catch(() => null);
    } catch {
      // Non-fatal: skip this segment
    }
  }

  // LRU eviction if over limit
  await evictIfOverLimit();
}

async function evictIfOverLimit(): Promise<void> {
  try {
    const root = cacheRoot();
    if (!(await ReactNativeBlobUtil.fs.exists(root))) return;

    const entries = await ReactNativeBlobUtil.fs.ls(root);
    let totalBytes = 0;
    type CacheEntry = {name: string; size: number; mtime: number};
    const fileStats: CacheEntry[] = [];

    for (const name of entries) {
      const fullPath = `${root}/${name}`;
      try {
        const stat = await ReactNativeBlobUtil.fs.stat(fullPath);
        totalBytes += stat.size;
        fileStats.push({name, size: stat.size, mtime: stat.lastModified});
      } catch { /* ignore */ }
    }

    if (totalBytes <= MAX_CACHE_BYTES) return;

    // Evict oldest directories first
    fileStats.sort((a, b) => a.mtime - b.mtime);
    for (const entry of fileStats) {
      if (totalBytes <= MAX_CACHE_BYTES * 0.7) break;
      await ReactNativeBlobUtil.fs.unlink(`${root}/${entry.name}`).catch(() => null);
      totalBytes -= entry.size;
    }
  } catch { /* ignore */ }
}

/** Cancel all in-progress prefetch operations (call on app background). */
export function cancelAllPrefetch(): void {
  prefetchInProgress.clear();
}

/** Clear entire HLS segment cache. */
export async function clearHlsCache(): Promise<void> {
  prefetchInProgress.clear();
  const root = cacheRoot();
  try {
    if (!(await ReactNativeBlobUtil.fs.exists(root))) return;
    await ReactNativeBlobUtil.fs.unlink(root).catch(() => null);
  } catch { /* ignore */ }
}
