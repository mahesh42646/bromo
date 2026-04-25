import {Dimensions} from 'react-native';
import type {CreateDraftState} from './CreateDraftContext';
import {
  aspectRatioFromCrop,
  normalizeCropForMode,
  type AdjustmentState,
  type CropAspect,
  type FilterId,
  type PollState,
} from './createTypes';

const SNAP_KEY = 'clientSnapshot';

/** Keep multipart + clientEditMeta under reverse-proxy limits (metadata only, not the video file). */
const MAX_CLIENT_EDIT_META_BYTES = 450_000;
const MAX_OVERLAY_TEXT_CHARS = 2_000;
const MAX_STICKER_LABEL_CHARS = 240;
const MAX_POLL_QUESTION_CHARS = 400;
const MAX_POLL_OPTION_CHARS = 200;

function editorPreviewAspectFromDraft(d: CreateDraftState): number {
  const i = d.activeAssetIndex;
  const crop = normalizeCropForMode(d.cropByAsset[i], d.mode);
  return aspectRatioFromCrop(crop);
}

function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function roundAdjust(a: AdjustmentState): AdjustmentState {
  const r = (n: number) =>
    Math.round(Math.min(1, Math.max(-1, n)) * 10_000) / 10_000;
  return {
    brightness: r(a.brightness),
    contrast: r(a.contrast),
    saturation: r(a.saturation),
    warmth: r(a.warmth),
    sharpen: r(a.sharpen),
    vignette: r(a.vignette),
    fade: r(a.fade),
  };
}

function pruneAssetRecord<T>(
  rec: Record<number, T> | undefined,
  assetCount: number,
): Record<number, T> {
  const out: Record<number, T> = {};
  if (!rec || assetCount <= 0) return out;
  for (let i = 0; i < assetCount; i++) {
    if (rec[i] !== undefined) out[i] = rec[i];
  }
  return out;
}

function slimPollForMeta(p: PollState | undefined): PollState | undefined {
  if (!p?.enabled) return undefined;
  const options = p.options
    .map(o => clampStr(String(o).trim(), MAX_POLL_OPTION_CHARS))
    .filter(Boolean)
    .slice(0, 4);
  if (options.length < 2) return undefined;
  const votes = options.map((_, i) =>
    typeof p.votes?.[i] === 'number' ? p.votes[i]! : 0,
  );
  return {
    enabled: true,
    question: clampStr(p.question.trim(), MAX_POLL_QUESTION_CHARS),
    options,
    votes,
  };
}

type EditMetaSnap = {
  v: 2;
  mode: CreateDraftState['mode'];
  activeAssetIndex: number;
  filterByAsset: Record<number, FilterId>;
  adjustByAsset: Record<number, AdjustmentState>;
  rotationByAsset: Record<number, number>;
  cropByAsset: Record<number, CropAspect>;
  trimStartByAsset: Record<number, number>;
  trimEndByAsset: Record<number, number>;
  playbackSpeed: number;
  poll?: PollState;
  textOverlays: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    xPct: number;
    yPct: number;
    color: string;
    fontSize: number;
    fontStyle: 'normal' | 'bold' | 'italic';
  }>;
  stickers: Array<{
    id: string;
    productId: string;
    label: string;
    x: number;
    y: number;
    xPct: number;
    yPct: number;
  }>;
  layoutRef: {w: number; h: number};
};

function buildEditMetaSnap(
  d: CreateDraftState,
  W: number,
  H: number,
  assetCount: number,
  activeIndex: number,
  includeOverlays: boolean,
  includePoll: boolean,
): EditMetaSnap {
  const textOverlays = includeOverlays
    ? d.textOverlays.map(o => ({
        id: o.id,
        text: clampStr(o.text, MAX_OVERLAY_TEXT_CHARS),
        x: o.x,
        y: o.y,
        xPct: (o.x / W) * 100,
        yPct: (o.y / H) * 100,
        color: o.color,
        fontSize: o.fontSize,
        fontStyle: o.fontStyle,
      }))
    : [];

  const stickers = includeOverlays
    ? d.stickers.map(s => ({
        id: s.id,
        productId: s.productId,
        label: clampStr(s.label, MAX_STICKER_LABEL_CHARS),
        x: s.x,
        y: s.y,
        xPct: (s.x / W) * 100,
        yPct: (s.y / H) * 100,
      }))
    : [];

  const adjustRaw = pruneAssetRecord(d.adjustByAsset, assetCount);
  const adjustByAsset: Record<number, AdjustmentState> = {};
  for (const key of Object.keys(adjustRaw)) {
    const i = Number(key);
    if (!Number.isInteger(i) || i < 0 || i >= assetCount) continue;
    adjustByAsset[i] = roundAdjust(adjustRaw[i]!);
  }

  const snap: EditMetaSnap = {
    v: 2,
    mode: d.mode,
    activeAssetIndex: activeIndex,
    filterByAsset: pruneAssetRecord(d.filterByAsset, assetCount) as Record<number, FilterId>,
    adjustByAsset,
    rotationByAsset: pruneAssetRecord(d.rotationByAsset, assetCount),
    cropByAsset: pruneAssetRecord(d.cropByAsset, assetCount) as Record<number, CropAspect>,
    trimStartByAsset: pruneAssetRecord(d.trimStartByAsset, assetCount),
    trimEndByAsset: pruneAssetRecord(d.trimEndByAsset, assetCount),
    playbackSpeed: d.playbackSpeed,
    textOverlays,
    stickers,
    layoutRef: {w: W, h: H},
  };

  if (includePoll) {
    const sp = slimPollForMeta(d.poll);
    if (sp) snap.poll = sp;
  }

  return snap;
}

/**
 * Compact edit intent for API `Post.clientEditMeta` (v2).
 * Omits fields already sent on the multipart post (music, products, location) to keep request size small.
 */
export function packEditMetaForUpload(d: CreateDraftState): string {
  const W = Dimensions.get('window').width;
  const H = W / editorPreviewAspectFromDraft(d);
  const assetCount = Math.max(1, d.assets.length);
  const activeIndex = Math.min(
    Math.max(0, d.activeAssetIndex),
    Math.max(0, d.assets.length - 1),
  );

  let snap = buildEditMetaSnap(d, W, H, assetCount, activeIndex, true, true);
  let json = JSON.stringify(snap);
  if (json.length > MAX_CLIENT_EDIT_META_BYTES) {
    snap = buildEditMetaSnap(d, W, H, assetCount, activeIndex, true, false);
    json = JSON.stringify(snap);
  }
  if (json.length > MAX_CLIENT_EDIT_META_BYTES) {
    snap = buildEditMetaSnap(d, W, H, assetCount, activeIndex, false, false);
    json = JSON.stringify(snap);
  }
  return json;
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
