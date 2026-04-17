import {Dimensions} from 'react-native';
import type {CreateDraftState} from './CreateDraftContext';

const SNAP_KEY = 'clientSnapshot';

function editorPreviewAspectFromDraft(d: CreateDraftState): number {
  const i = d.activeAssetIndex;
  const crop = d.cropByAsset[i] ?? 'original';
  if (crop === '1:1') return 1;
  if (crop === '4:5') return 4 / 5;
  if (crop === '16:9') return 16 / 9;
  if (crop === '9:16') return 9 / 16;
  return d.mode === 'reel' ? 9 / 16 : 1;
}

/**
 * Full edit intent for API `Post.clientEditMeta` (v2). Server persists as Mixed; workers must not strip it.
 * Feed / reels replay filters & overlays client-side; trim & speed applied in `PostVideoWithClientMeta`.
 */
export function packEditMetaForUpload(d: CreateDraftState): string {
  const W = Dimensions.get('window').width;
  const H = W / editorPreviewAspectFromDraft(d);
  const snap = {
    v: 2 as const,
    mode: d.mode,
    activeAssetIndex: d.activeAssetIndex,
    filterByAsset: d.filterByAsset,
    adjustByAsset: d.adjustByAsset,
    rotationByAsset: d.rotationByAsset,
    cropByAsset: d.cropByAsset,
    trimStartByAsset: d.trimStartByAsset,
    trimEndByAsset: d.trimEndByAsset,
    playbackSpeed: d.playbackSpeed,
    textOverlays: d.textOverlays.map(o => ({
      ...o,
      xPct: (o.x / W) * 100,
      yPct: (o.y / H) * 100,
    })),
    stickers: d.stickers.map(s => ({
      ...s,
      xPct: (s.x / W) * 100,
      yPct: (s.y / H) * 100,
    })),
    layoutRef: {w: W, h: H},
    selectedAudio: d.selectedAudio,
    productIds: d.products.map(p => p.id),
    location: d.location
      ? {
          name: d.location.name,
          lat: d.location.lat,
          lng: d.location.lng,
          placeId: d.location.placeId,
        }
      : undefined,
  };
  return JSON.stringify(snap);
}

/** Stored inside Draft.filters on the API so a device can resume editing. */
export function packClientSnapshot(d: CreateDraftState): Record<string, unknown> {
  return {[SNAP_KEY]: JSON.parse(JSON.stringify(d)) as CreateDraftState};
}

export function unpackClientSnapshot(filters: unknown): CreateDraftState | null {
  if (!filters || typeof filters !== 'object') return null;
  const raw = (filters as Record<string, unknown>)[SNAP_KEY];
  if (!raw || typeof raw !== 'object') return null;
  try {
    return raw as CreateDraftState;
  } catch {
    return null;
  }
}
