import {DEFAULT_ADJUSTMENTS, type AdjustmentState, type CropAspect, type FilterId} from './createTypes';

/** Serialized edit payload (v1 legacy, v2 extended). Stored in Post.clientEditMeta. */
export type ClientEditMetaV2 = {
  v: 2;
  mode?: string;
  activeAssetIndex?: number;
  filterByAsset: Record<string, FilterId | string>;
  adjustByAsset: Record<string, AdjustmentState>;
  rotationByAsset?: Record<string, number>;
  cropByAsset?: Record<string, CropAspect | string>;
  trimStartByAsset?: Record<string, number>;
  trimEndByAsset?: Record<string, number>;
  playbackSpeed?: number;
  textOverlays?: TextOverlayPacked[];
  stickers?: StickerPacked[];
  layoutRef?: {w: number; h: number};
  selectedAudio?: {id: string; title: string; artist: string} | null;
  productIds?: string[];
  location?: {name?: string; lat?: number; lng?: number};
};

export type TextOverlayPacked = {
  id: string;
  text: string;
  x: number;
  y: number;
  xPct?: number;
  yPct?: number;
  color: string;
  fontSize: number;
  fontStyle?: string;
};

export type StickerPacked = {
  id: string;
  productId: string;
  label: string;
  x: number;
  y: number;
  xPct?: number;
  yPct?: number;
};

export function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

export function parseClientEditMeta(raw: unknown): ClientEditMetaV2 | null {
  if (raw == null) return null;
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(o)) return null;
  const v = o.v;
  if (v !== 1 && v !== 2) return null;
  if (!isRecord(o.filterByAsset)) return null;
  const adjustByAsset = isRecord(o.adjustByAsset) ? o.adjustByAsset : {};
  return {...(o as object), adjustByAsset} as unknown as ClientEditMetaV2;
}

export function getMetaForAssetIndex(meta: ClientEditMetaV2, assetIndex: number) {
  const key = String(assetIndex);
  const filter = (meta.filterByAsset[key] ?? meta.filterByAsset[assetIndex]) as FilterId | undefined;
  const adjustRaw = meta.adjustByAsset[key] ?? meta.adjustByAsset[assetIndex];
  const adjust =
    adjustRaw && typeof adjustRaw === 'object'
      ? ({...DEFAULT_ADJUSTMENTS, ...(adjustRaw as AdjustmentState)} as AdjustmentState)
      : DEFAULT_ADJUSTMENTS;
  const trimStart = meta.trimStartByAsset?.[key] ?? meta.trimStartByAsset?.[assetIndex];
  const trimEnd = meta.trimEndByAsset?.[key] ?? meta.trimEndByAsset?.[assetIndex];
  return {
    filter: filter ?? 'normal',
    adjust,
    trimStart: typeof trimStart === 'number' ? trimStart : 0,
    trimEnd: typeof trimEnd === 'number' ? trimEnd : 1,
    playbackSpeed: typeof meta.playbackSpeed === 'number' && meta.playbackSpeed > 0 ? meta.playbackSpeed : 1,
  };
}
