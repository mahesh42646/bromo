import {authedFetch} from './authApi';

export type CatalogSticker = {id: string; label: string; emoji?: string};

export async function fetchStickerCatalog(): Promise<CatalogSticker[]> {
  const res = await authedFetch('/content/stickers');
  if (!res.ok) return [];
  const body = (await res.json()) as {stickers?: CatalogSticker[]};
  return Array.isArray(body.stickers) ? body.stickers : [];
}
