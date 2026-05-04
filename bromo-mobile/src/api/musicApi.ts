import {authedFetch} from './authApi';

export type LicensedTrackDto = {
  id: string;
  title: string;
  artist: string;
  durationSec?: number;
  license?: string;
  source?: string;
};

export async function searchLicensedMusic(q: string): Promise<LicensedTrackDto[]> {
  const res = await authedFetch(`/music/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {tracks?: LicensedTrackDto[]};
  return data.tracks ?? [];
}

export async function getLicensedMusicTrending(): Promise<LicensedTrackDto[]> {
  const res = await authedFetch('/music/trending');
  if (!res.ok) return [];
  const data = (await res.json()) as {tracks?: LicensedTrackDto[]};
  return data.tracks ?? [];
}
