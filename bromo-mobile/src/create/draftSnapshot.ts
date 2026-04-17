import type {CreateDraftState} from './CreateDraftContext';

const SNAP_KEY = 'clientSnapshot';

/** Slim JSON for upload: edit intent (filters, trim, overlays). Server stores; feed can use later. Does not bake pixels into video. */
export function packEditMetaForUpload(d: CreateDraftState): string {
  const snap = {
    v: 1 as const,
    mode: d.mode,
    activeAssetIndex: d.activeAssetIndex,
    filterByAsset: d.filterByAsset,
    adjustByAsset: d.adjustByAsset,
    rotationByAsset: d.rotationByAsset,
    cropByAsset: d.cropByAsset,
    trimStartByAsset: d.trimStartByAsset,
    trimEndByAsset: d.trimEndByAsset,
    playbackSpeed: d.playbackSpeed,
    textOverlays: d.textOverlays,
    stickers: d.stickers,
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
