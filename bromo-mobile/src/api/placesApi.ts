import {authedFetch} from './authApi';

export type PlaceItem = {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  type?: string;
};

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  q?: string,
): Promise<{items: PlaceItem[]}> {
  const qs = new URLSearchParams({lat: String(lat), lng: String(lng)});
  if (q?.trim()) qs.set('q', q.trim());
  const res = await authedFetch(`/places/nearby?${qs.toString()}`);
  if (!res.ok) return {items: []};
  return res.json() as Promise<{items: PlaceItem[]}>;
}

export async function searchPlaces(q: string): Promise<{items: PlaceItem[]}> {
  if (!q.trim()) return {items: []};
  const res = await authedFetch(`/places/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return {items: []};
  return res.json() as Promise<{items: PlaceItem[]}>;
}
