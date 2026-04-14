import {authedFetch} from './authApi';

export type AdActionType = 'external_url' | 'in_app';
export type AdType = 'image' | 'carousel' | 'video';
export type AdPlacement = 'feed' | 'reels' | 'stories' | 'explore';

export interface AdCta {
  label: string;
  actionType: AdActionType;
  externalUrl?: string;
  inAppScreen?: string;
  inAppParams?: Record<string, unknown>;
}

export interface Ad {
  _id: string;
  adType: AdType;
  mediaUrls: string[];
  thumbnailUrl?: string;
  caption: string;
  cta?: AdCta;
}

export type AdEventType = 'impression' | 'click' | 'video_view' | 'video_complete';

export async function fetchAds(placement: AdPlacement, limit = 3): Promise<Ad[]> {
  const res = await authedFetch(
    `/ads/serve?placement=${encodeURIComponent(placement)}&limit=${limit}`,
  ).catch(() => null);
  if (!res?.ok) return [];
  const body = await res.json().catch(() => ({})) as {ads?: unknown[]};
  return (body.ads ?? []) as Ad[];
}

export async function trackAdEvent(
  adId: string,
  event: AdEventType,
  opts: {placement: AdPlacement; watchTimeMs?: number},
): Promise<void> {
  await authedFetch(`/ads/${encodeURIComponent(adId)}/event`, {
    method: 'POST',
    body: JSON.stringify({event, placement: opts.placement, watchTimeMs: opts.watchTimeMs}),
  }).catch(() => null); // fire-and-forget — never block UI
}
