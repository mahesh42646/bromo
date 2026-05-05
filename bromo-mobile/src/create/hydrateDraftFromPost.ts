import type {CreateDraftState} from './CreateDraftContext';
import type {Post} from '../api/postsApi';
import type {
  AudioTrack,
  CreateMode,
  FeedCategoryPreset,
  LocationTag,
  PollState,
  TaggedUser,
  Visibility,
} from './createTypes';
import {DEFAULT_ADVANCED, defaultCropForMode} from './createTypes';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';

const FEED_PRESETS: FeedCategoryPreset[] = ['general', 'politics', 'sports', 'shopping', 'tech'];

const initialPoll: PollState = {
  enabled: false,
  question: '',
  options: ['Yes', 'No'],
  votes: [0, 0],
};

function splitCaptionAndHashtags(raw: string): {caption: string; hashtags: string[]} {
  const hashtags = raw.match(/#[\w\u0080-\uFFFF]+/g) ?? [];
  let caption = raw;
  for (const h of hashtags) {
    const esc = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    caption = caption.replace(new RegExp(`${esc}\\s*`, 'g'), '');
  }
  caption = caption.replace(/\s+/g, ' ').trim();
  return {caption, hashtags};
}

/** Build full draft state from an existing post (edit mode — remote media URI, no editor pipeline). */
export function hydrateDraftFromPost(post: Post): CreateDraftState {
  const mode: CreateMode = post.type === 'reel' ? 'reel' : post.type === 'story' ? 'story' : 'post';
  const uri = resolveMediaUrl(post.mediaUrl) || post.mediaUrl;
  const assets = [{uri, type: post.mediaType}];

  const tagged: TaggedUser[] = (post.taggedPreview ?? []).map(u => ({
    id: u._id,
    username: u.username,
    avatar: u.profilePicture,
  }));

  const capRaw = mode === 'story' ? '' : (post.caption ?? '');
  const {caption, hashtags} =
    mode === 'story' ? {caption: '', hashtags: []} : splitCaptionAndHashtags(capRaw);

  const products =
    post.productPreview?.map(p => ({
      id: p._id,
      name: p.title,
      priceLabel: `${p.currency} ${p.price.toLocaleString()}`,
      imageUri: p.imageUrl,
      productUrl: p.productUrl,
    })) ?? [];

  let location: LocationTag | null = null;
  if (post.locationMeta?.name) {
    const pid = post.locationMeta.placeId?.trim();
    location = {
      id: pid || `legacy:${post.locationMeta.name}`,
      name: post.locationMeta.name,
      lat: post.locationMeta.lat,
      lng: post.locationMeta.lng,
      address: post.locationMeta.address,
      placeId: post.locationMeta.placeId,
    };
  } else if (post.location?.trim()) {
    const n = post.location.trim();
    location = {id: `text:${n}`, name: n};
  }

  const selectedAudio: AudioTrack | null =
    post.music?.trim() ? {id: 'existing', title: post.music.trim(), artist: ''} : null;

  const fcRaw = (post.feedCategory ?? 'general').toLowerCase();
  const feedCategoryPreset: FeedCategoryPreset = FEED_PRESETS.includes(fcRaw as FeedCategoryPreset)
    ? (fcRaw as FeedCategoryPreset)
    : 'general';
  const feedCategoryManual =
    feedCategoryPreset === fcRaw || mode === 'story' ? '' : (post.feedCategory ?? '').replace(/-/g, ' ');

  let visibility: Visibility = 'public';
  if (post.settings?.closeFriendsOnly) visibility = 'close_friends';
  else if (mode !== 'story' && post.feedCategory === 'followers') visibility = 'followers';

  let poll: PollState = {...initialPoll};
  if (post.poll?.options?.length && post.poll.options.length >= 2) {
    poll = {
      enabled: true,
      question: post.poll.question ?? '',
      options: post.poll.options.slice(0, 4),
      votes: post.poll.votes?.length === post.poll.options.length ? [...post.poll.votes] : post.poll.options.map(() => 0),
    };
  }

  const defCrop = defaultCropForMode(mode);

  return {
    mode,
    assets,
    activeAssetIndex: 0,
    filterByAsset: {},
    adjustByAsset: {},
    rotationByAsset: {},
    cropByAsset: {0: defCrop},
    trimStartByAsset: {},
    trimEndByAsset: {},
    playbackSpeed: 1,
    selectedAudio,
    audioStartOffsetMs: 0,
    clipDurationMs: undefined,
    loopVideoToAudio: undefined,
    textOverlays: [],
    caption,
    hashtags,
    tagged,
    collaborators: [],
    location,
    products,
    stickers: [],
    poll,
    visibility,
    advanced: {
      ...DEFAULT_ADVANCED,
      commentsOff: Boolean(post.settings?.commentsOff),
      hideLikeCount: Boolean(post.settings?.hideLikes),
    },
    storyAllowReplies: true,
    storyShareOffPlatform: false,
    liveAudience: 'everyone',
    liveTitle: '',
    feedCategoryPreset,
    feedCategoryManual,
  };
}
