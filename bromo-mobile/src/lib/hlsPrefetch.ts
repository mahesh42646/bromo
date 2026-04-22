/**
 * HLS prefetch — DISABLED.
 *
 * Prior impl issued extra fetches for master playlist + variant + N segments
 * per upcoming reel. Combined with ABR probing, caused hundreds of concurrent
 * server requests for a single reel view. AVPlayer (iOS) and ExoPlayer
 * (Android) already manage their own network pipeline and on-disk cache when
 * Cache-Control headers are correct — manual warming is strictly additive load.
 *
 * All exports kept as no-ops for API compatibility with callers.
 */

export function prefetchHlsSegments(
  _masterUrl: string,
  _postId: string,
  _isCellular: boolean,
  _segmentLimit: number | null = null,
): void {
  // no-op
}

export function cancelAllPrefetch(): void {
  // no-op
}

export async function clearHlsCache(): Promise<void> {
  // no-op
}
