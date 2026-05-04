import {authedFetch} from './authApi';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';

export type ActiveLiveStream = {
  streamId: string;
  userId: string;
  displayName: string;
  profilePicture: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  hlsUrl: string;
};

export async function getActiveLiveStreams(): Promise<ActiveLiveStream[]> {
  const res = await authedFetch('/live/active');
  if (!res.ok) return [];
  const body = (await res.json()) as {streams?: ActiveLiveStream[]};
  return Array.isArray(body.streams) ? body.streams : [];
}

export function resolvedLiveHlsUrl(raw: string): string {
  const r = raw.trim();
  if (!r) return '';
  return resolveMediaUrl(r) ?? r;
}
