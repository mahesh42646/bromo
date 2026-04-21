/**
 * HLS segment prefetch — warms iOS NSURLCache / Android HTTP cache by issuing
 * standard fetch() calls so AVPlayer / ExoPlayer get cache hits on playback.
 *
 * Previous approach (ReactNativeBlobUtil → custom disk dir) was ineffective:
 * AVPlayer reads from NSURLCache, not arbitrary file paths.
 */

const LOOKAHEAD_SEGMENTS = 3; // 3 × 2s segments = 6 s lead — enough for instant start

const prefetchInProgress = new Set<string>();

function parseSegmentUrls(playlistText: string, baseUrl: string): string[] {
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  return playlistText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
    .map(l => (l.startsWith('http') ? l : `${baseDir}${l}`));
}

function parseVariantUrls(masterText: string, masterUrl: string): Array<{bandwidth: number; url: string}> {
  const baseDir = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  const variants: Array<{bandwidth: number; url: string}> = [];
  const lines = masterText.split('\n').map(l => l.trim());

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

function selectVariant(variants: Array<{bandwidth: number; url: string}>, isCellular: boolean): string | null {
  if (!variants.length) return null;
  const sorted = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
  if (isCellular) return sorted[0].url;
  // WiFi: pick 720p tier (middle) — matches our maxBitRate cap of 2.5Mbps
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid]?.url ?? sorted[0].url;
}

async function warmUrl(url: string): Promise<void> {
  try {
    // fetch() populates NSURLCache (iOS) and the Hermes HTTP cache.
    // AVPlayer will get a cache hit when it requests the same URL.
    await fetch(url, {headers: {'User-Agent': 'BromoMobile/1 (hls-prefetch)'}});
  } catch { /* non-fatal */ }
}

/**
 * Prefetch HLS segments for a given master playlist URL.
 * Fetches warm the iOS NSURLCache so AVPlayer starts without waiting on the network.
 */
export function prefetchHlsSegments(
  masterUrl: string,
  postId: string,
  isCellular: boolean,
  segmentLimit: number | null = LOOKAHEAD_SEGMENTS,
): void {
  if (!masterUrl?.trim()) return;
  const key = `${postId}_${isCellular ? 'cell' : 'wifi'}`;
  if (prefetchInProgress.has(key)) return;
  prefetchInProgress.add(key);

  void (async () => {
    try {
      const masterResp = await fetch(masterUrl, {headers: {'User-Agent': 'BromoMobile/1 (hls-prefetch)'}});
      const masterText = await masterResp.text();
      if (!masterText.includes('#EXTM3U')) return;

      let segmentPlaylistUrl: string;
      if (masterText.includes('#EXT-X-STREAM-INF')) {
        const variants = parseVariantUrls(masterText, masterUrl);
        const chosen = selectVariant(variants, isCellular);
        if (!chosen) return;
        segmentPlaylistUrl = chosen;
      } else {
        segmentPlaylistUrl = masterUrl;
      }

      const playlistResp = await fetch(segmentPlaylistUrl, {headers: {'User-Agent': 'BromoMobile/1 (hls-prefetch)'}});
      const playlistText = await playlistResp.text();
      const segmentUrls = parseSegmentUrls(playlistText, segmentPlaylistUrl);
      const toFetch = segmentLimit !== null ? segmentUrls.slice(0, segmentLimit) : segmentUrls;

      await Promise.all(toFetch.map(warmUrl));
    } catch (e) {
      if (__DEV__) console.warn('[hlsPrefetch] error:', postId, e);
    } finally {
      prefetchInProgress.delete(key);
    }
  })();
}

/** Cancel all in-progress prefetch operations (call on app background). */
export function cancelAllPrefetch(): void {
  prefetchInProgress.clear();
}

/** No-op: cache managed by OS (NSURLCache). Kept for API compatibility. */
export async function clearHlsCache(): Promise<void> {
  prefetchInProgress.clear();
}
