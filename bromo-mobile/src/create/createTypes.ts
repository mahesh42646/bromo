export type CreateMode = 'post' | 'story' | 'reel' | 'live';

/** Post/reel home-feed bucket; manual input overrides preset when non-empty. */
export type FeedCategoryPreset = 'general' | 'politics' | 'sports' | 'shopping' | 'tech';

export type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
  fileName?: string | null;
  width?: number;
  height?: number;
};

export type Visibility = 'public' | 'followers' | 'close_friends' | 'private';

export type TaggedUser = { id: string; username: string; avatar?: string };

export type ProductAttachment = {
  id: string;
  name: string;
  priceLabel: string;
  imageUri?: string;
  productUrl?: string;
};

export type StickerPlacement = {
  id: string;
  productId: string;
  label: string;
  x: number;
  y: number;
};

export type PollState = {
  enabled: boolean;
  question: string;
  options: string[];
  votes: number[];
};

export type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  url?: string;
  /** Community original sound (Mongo id). */
  originalAudioId?: string;
  /** Licensed catalog track (Mongo id) — server may remux into final video. */
  musicTrackId?: string;
  sourcePostId?: string;
};

export type TextOverlay = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontStyle: 'normal' | 'bold' | 'italic';
};

export type AdjustmentState = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpen: number;
  vignette: number;
  fade: number;
};

export const DEFAULT_ADJUSTMENTS: AdjustmentState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpen: 0,
  vignette: 0,
  fade: 0,
};

/** Fixed frame ratios only (no "original"). Mode restricts which values apply. */
export type CropAspect = '1:1' | '4:5' | '16:9' | '9:16';

export function defaultCropForMode(mode: CreateMode): CropAspect {
  if (mode === 'post') return '1:1';
  return '9:16';
}

export function allowedCropsForMode(mode: CreateMode): CropAspect[] {
  switch (mode) {
    case 'reel':
    case 'story':
      return ['9:16', '16:9', '4:5'];
    case 'post':
      return ['1:1', '4:5', '16:9'];
    case 'live':
      return ['9:16'];
  }
}

export function normalizeCropForMode(
  crop: string | undefined | null,
  mode: CreateMode,
): CropAspect {
  const allowed = allowedCropsForMode(mode);
  if (crop && allowed.includes(crop as CropAspect)) return crop as CropAspect;
  return defaultCropForMode(mode);
}

export function aspectRatioFromCrop(crop: CropAspect): number {
  if (crop === '1:1') return 1;
  if (crop === '4:5') return 4 / 5;
  if (crop === '16:9') return 16 / 9;
  return 9 / 16;
}

export type LocationTag = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
};

export type AdvancedPostOptions = {
  commentsOff: boolean;
  hideLikeCount: boolean;
  brandedContent: boolean;
  altText: string;
  shareToStory: boolean;
  scheduledAt: string | null;
};

export const DEFAULT_ADVANCED: AdvancedPostOptions = {
  commentsOff: false,
  hideLikeCount: false,
  brandedContent: false,
  altText: '',
  shareToStory: false,
  scheduledAt: null,
};

export const FILTER_IDS = [
  'normal',
  'clarendon',
  'gingham',
  'lark',
  'reyes',
  'juno',
  'slate',
  'lux',
  'aden',
  'crema',
] as const;

export type FilterId = (typeof FILTER_IDS)[number];

export const TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#FF2D55',
];
