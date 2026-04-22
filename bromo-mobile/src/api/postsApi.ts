import auth from '@react-native-firebase/auth';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {authedFetch, apiBase, authorizedFetch, getIdToken} from './authApi';
import type {PromotionObjective} from './promotionsApi';
import {buildMediaUploadPart} from '../lib/mediaUploadPart';
import {queuePostView} from '../lib/viewQueue';

/** Matches server `upload.ts` — larger files rejected before upload starts. */
export const MAX_UPLOAD_BYTES = 600 * 1024 * 1024;

export async function getLocalFileSizeBytes(uri: string): Promise<number | null> {
  const path = uri.replace(/^file:\/\//, '');
  try {
    const stat = await ReactNativeBlobUtil.fs.stat(path);
    return typeof stat.size === 'number' ? stat.size : null;
  } catch {
    return null;
  }
}

export type PostUploadSettings = {
  commentsOff?: boolean;
  hideLikes?: boolean;
  allowRemix?: boolean;
  closeFriendsOnly?: boolean;
};

export type PostLocationMeta = {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
  placeId?: string;
};

export type PostAuthor = {
  _id: string;
  username: string;
  displayName: string;
  profilePicture: string;
  isPrivate: boolean;
  emailVerified: boolean;
};

export type StoryOverlay = {
  id: string;
  type: 'text' | 'emoji' | 'music';
  content: string;
  x: number;
  y: number;
  color?: string;
  fontSize?: number;
};

export type StoryMeta = {
  bgColor?: string;
  overlays?: StoryOverlay[];
};

export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type Post = {
  _id: string;
  author: PostAuthor;
  type: 'post' | 'reel' | 'story';
  mediaUrl: string;
  mediaType: 'image' | 'video';
  /** Server-generated for video; use for grids and `<Image>` previews */
  thumbnailUrl?: string;
  /**
   * HLS master playlist URL — prefer this over mediaUrl for video playback.
   * Pass to NetworkVideo uri prop. Falls back to mediaUrl when absent (legacy posts).
   * On cellular, swap for master_cell.m3u8 (same dir, replace "master" with "master_cell").
   */
  hlsMasterUrl?: string;
  /** HLS processing pipeline status. Post visible in feeds only when 'ready'. */
  processingStatus?: ProcessingStatus;
  caption: string;
  location: string;
  music: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  impressionsCount: number;
  sharesCount: number;
  avgWatchTimeMs: number;
  trendingScore: number;
  isLiked: boolean;
  isFollowing: boolean;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  /** Home feed bucket (post/reel). */
  feedCategory?: string;
  /** Story-only: overlays and background color */
  storyMeta?: StoryMeta;
  /** Story tray: whether the current user has finished this segment (server). */
  seenByMe?: boolean;
  /** v2 packed edit intent: filters, trim, speed, overlays, products, etc. (see `packEditMetaForUpload`). */
  clientEditMeta?: Record<string, unknown>;
  /** Injected sponsored post from PromotionCampaign (API). */
  isPromoted?: boolean;
  promotionId?: string;
  promotionObjective?: PromotionObjective;
  promotionCta?: {label: string; url: string};
};

/** Derive the best video URL from a post — HLS master if available, else legacy mediaUrl. */
export function resolveVideoUrl(post: Post, isCellular = false): string {
  if (post.hlsMasterUrl) {
    if (isCellular) {
      // Use cellular-capped master (≤720p variants) — same dir convention
      return post.hlsMasterUrl.replace(/master\.m3u8$/, 'master_cell.m3u8');
    }
    return post.hlsMasterUrl;
  }
  return post.mediaUrl;
}

export type MediaJobStatus = 'queued' | 'processing' | 'ready' | 'failed';

export type MediaJobPoll = {
  jobId: string;
  status: MediaJobStatus;
  progress: number;
  mediaType: 'video' | 'image';
  category: string;
  hlsMasterUrl?: string;
  cellMasterUrl?: string;
  renditions?: Array<{height: number; bitrate: number}>;
  error?: string;
  postId?: string;
  post?: Post;
};

export type Comment = {
  _id: string;
  author: PostAuthor;
  text: string;
  likesCount: number;
  parentId?: string;
  /** Root comment id for this thread (from API). */
  threadRootId?: string;
  replyingTo?: {userId: string; username: string};
  replies?: Comment[];
  repliesCount?: number;
  hasMoreReplies?: boolean;
  threadReplyCount?: number;
  hasMoreThreadReplies?: boolean;
  createdAt: string;
};

export type FeedResponse = {
  posts: Post[];
  page: number;
  hasMore: boolean;
  nextCursor?: string | null;
  tab?: string;
  forYouPhase?: 'friends' | 'general';
  hasMoreFriends?: boolean;
  hasMoreGeneral?: boolean;
  nextCursorFriends?: string | null;
  nextCursorGeneral?: string | null;
};

export type CommentsResponse = {
  comments: Comment[];
  page: number;
  hasMore: boolean;
  totalCount?: number;
};

export type CommentThreadResponse = {
  replies: Comment[];
  hasMore: boolean;
  nextCursor: string | null;
  totalInThread: number;
};

function feedQuery(opts: {
  tab?: string;
  fyPhase?: 'friends' | 'general';
  cf?: string | null;
  cg?: string | null;
  page?: number;
}): string {
  const q = new URLSearchParams();
  if (opts.tab) q.set('tab', opts.tab);
  if (opts.fyPhase) q.set('fyPhase', opts.fyPhase);
  if (opts.cf) q.set('cf', opts.cf);
  if (opts.cg) q.set('cg', opts.cg);
  if (opts.page != null) q.set('page', String(opts.page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function getFeed(
  pageOrOpts: number | {tab?: string; fyPhase?: 'friends' | 'general'; cf?: string | null; cg?: string | null; page?: number} = 1,
): Promise<FeedResponse> {
  const opts = typeof pageOrOpts === 'number' ? {page: pageOrOpts} : pageOrOpts;
  const res = await authedFetch(`/posts/feed${feedQuery(opts)}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json() as Promise<FeedResponse>;
}

export async function getTrendingReels(limit = 3): Promise<{posts: Post[]}> {
  const res = await authedFetch(`/posts/trending-reels?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch trending reels');
  return res.json() as Promise<{posts: Post[]}>;
}

export async function getReels(page = 1): Promise<FeedResponse> {
  const res = await authedFetch(`/posts/reels?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch reels');
  return res.json() as Promise<FeedResponse>;
}

export async function getReelsInitial(): Promise<{posts: Post[]; hasMore: boolean; nextCursor: string | null}> {
  const res = await authedFetch('/posts/reels/initial');
  if (!res.ok) throw new Error('Failed to fetch initial reels');
  return res.json() as Promise<{posts: Post[]; hasMore: boolean; nextCursor: string | null}>;
}

export async function getReelsNext(cursor: string): Promise<{posts: Post[]; hasMore: boolean; nextCursor: string | null}> {
  const res = await authedFetch(`/posts/reels/next?cursor=${encodeURIComponent(cursor)}`);
  if (!res.ok) throw new Error('Failed to fetch next reels');
  return res.json() as Promise<{posts: Post[]; hasMore: boolean; nextCursor: string | null}>;
}

export async function getFeedInitial(): Promise<{posts: Post[]; tab: string; cursor: string | null; hasMore: boolean}> {
  const res = await authedFetch('/posts/feed/initial');
  if (!res.ok) throw new Error('Failed to fetch initial feed');
  return res.json() as Promise<{posts: Post[]; tab: string; cursor: string | null; hasMore: boolean}>;
}

export async function getFeedNext(cursor: string): Promise<{posts: Post[]; tab: string; cursor: string | null; hasMore: boolean}> {
  const res = await authedFetch(`/posts/feed/next?cursor=${encodeURIComponent(cursor)}`);
  if (!res.ok) throw new Error('Failed to fetch next feed');
  return res.json() as Promise<{posts: Post[]; tab: string; cursor: string | null; hasMore: boolean}>;
}

export async function getExplore(page = 1): Promise<FeedResponse> {
  const res = await authedFetch(`/posts/explore?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch explore');
  return res.json() as Promise<FeedResponse>;
}

export type StoryGroup = {
  author: PostAuthor;
  stories: Post[];
  isPromoted?: boolean;
  promotionId?: string;
};

export type FetchStoriesResult =
  | {notModified: true; etag: string}
  | {notModified: false; stories: StoryGroup[]; etag: string};

/**
 * Conditional GET for `/posts/stories`. Pass previous `etag` as `ifNoneMatch`
 * to receive `{notModified: true}` with an empty body (HTTP 304).
 */
export async function fetchStories(ifNoneMatch?: string | null): Promise<FetchStoriesResult> {
  const headers: Record<string, string> = {};
  if (ifNoneMatch) {
    headers['If-None-Match'] = ifNoneMatch;
  }
  const res = await authedFetch('/posts/stories', {headers});
  if (res.status === 304) {
    const etag = res.headers.get('etag')?.trim() || ifNoneMatch || '';
    return {notModified: true, etag};
  }
  if (!res.ok) throw new Error('Failed to fetch stories');
  const etag = res.headers.get('etag')?.trim() || '';
  const body = (await res.json()) as {stories: StoryGroup[]};
  return {notModified: false, stories: body.stories ?? [], etag};
}

export async function getUserPosts(userId: string, type = 'post', page = 1): Promise<FeedResponse> {
  const uid = encodeURIComponent(userId);
  const res = await authedFetch(`/posts/user/${uid}?type=${encodeURIComponent(type)}&page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch user posts');
  return res.json() as Promise<FeedResponse>;
}

/** Matches profile grid visibility; server syncs User.postsCount to gridTotal. */
export type UserGridStats = {
  postCount: number;
  reelCount: number;
  gridTotal: number;
  totalViews: number;
  totalImpressions: number;
};

export async function getUserGridStats(userId: string): Promise<UserGridStats> {
  const uid = encodeURIComponent(userId);
  const res = await authedFetch(`/posts/user/${uid}/grid-stats`);
  if (!res.ok) throw new Error('Failed to fetch grid stats');
  return res.json() as Promise<UserGridStats>;
}

export async function getPost(id: string): Promise<{post: Post}> {
  const res = await authedFetch(`/posts/${id}`);
  if (!res.ok) throw new Error('Post not found');
  return res.json() as Promise<{post: Post}>;
}

export async function createPost(data: {
  type: 'post' | 'reel' | 'story';
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: 'image' | 'video';
  caption?: string;
  location?: string;
  locationMeta?: PostLocationMeta;
  music?: string;
  tags?: string[];
  taggedUserIds?: string[];
  productIds?: string[];
  settings?: PostUploadSettings;
  durationMs?: number;
  storyMeta?: StoryMeta;
  feedCategory?: string;
  /** JSON string of edit metadata (filters, trim, overlays). */
  clientEditMeta?: string;
}): Promise<{post: Post}> {
  const res = await authedFetch('/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed to create post');
  }
  return res.json() as Promise<{post: Post}>;
}

export async function deletePost(id: string): Promise<void> {
  const res = await authedFetch(`/posts/${id}`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to delete post');
}

export async function toggleLike(postId: string): Promise<{liked: boolean; likesCount: number}> {
  const res = await authedFetch(`/posts/${postId}/like`, {method: 'POST'});
  if (!res.ok) throw new Error('Failed to toggle like');
  return res.json() as Promise<{liked: boolean; likesCount: number}>;
}

export function recordView(postId: string, watchMs = 0): Promise<void> {
  queuePostView(postId, watchMs);
  return Promise.resolve();
}

/** Mark a story post as seen for the current user (tray ring + ordering). */
export async function markStorySeenPost(storyPostId: string): Promise<void> {
  await authedFetch(`/posts/stories/${encodeURIComponent(storyPostId)}/seen`, {
    method: 'POST',
  }).catch(() => null);
}

/** Publish the given reel/video post as your story (server copies file + HLS/MP4 pipeline). */
export async function createStoryFromReel(
  sourcePostId: string,
): Promise<{post: Post; jobId?: string}> {
  const res = await authedFetch('/posts/story-from-reel', {
    method: 'POST',
    body: JSON.stringify({sourcePostId}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Could not add to story');
  }
  return res.json() as Promise<{post: Post; jobId?: string}>;
}

export async function recordShare(postId: string): Promise<void> {
  await authedFetch(`/posts/${postId}/share`, {method: 'POST'}).catch(() => null);
}

export async function likeComment(postId: string, commentId: string): Promise<{liked: boolean; likesCount: number}> {
  const res = await authedFetch(`/posts/${postId}/comments/${commentId}/like`, {method: 'POST'});
  if (!res.ok) throw new Error('Failed to like comment');
  return res.json() as Promise<{liked: boolean; likesCount: number}>;
}

export type PostAnalytics = {
  viewsCount: number;
  impressionsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  avgWatchTimeMs: number;
  trendingScore: number;
  reachRate: number;
  engagementRate: number;
  ageHours: number;
};

export async function getPostAnalytics(postId: string): Promise<PostAnalytics> {
  const res = await authedFetch(`/posts/${postId}/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json() as Promise<PostAnalytics>;
}

export async function getComments(postId: string, page = 1): Promise<CommentsResponse> {
  const res = await authedFetch(`/posts/${postId}/comments?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json() as Promise<CommentsResponse>;
}

export async function getCommentThread(
  postId: string,
  rootId: string,
  opts?: {after?: string; limit?: number},
): Promise<CommentThreadResponse> {
  const q = new URLSearchParams();
  if (opts?.after) q.set('after', opts.after);
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  const qs = q.toString();
  const res = await authedFetch(`/posts/${postId}/comments/thread/${rootId}${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch comment thread');
  return res.json() as Promise<CommentThreadResponse>;
}

export async function addComment(postId: string, text: string, parentId?: string): Promise<{comment: Comment}> {
  const res = await authedFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({text, parentId}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed to add comment');
  }
  return res.json() as Promise<{comment: Comment}>;
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  const res = await authedFetch(`/posts/${postId}/comments/${commentId}`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to delete comment');
}

export async function hidePost(postId: string): Promise<void> {
  await authedFetch(`/posts/${postId}/hide`, {method: 'POST'}).catch(() => null);
}

export async function reportPost(postId: string, reason = 'other'): Promise<void> {
  await authedFetch(`/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify({reason}),
  }).catch(() => null);
}

export async function toggleSavePost(postId: string): Promise<{saved: boolean}> {
  const res = await authedFetch(`/posts/${postId}/save`, {method: 'POST'});
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Could not update saved');
  }
  return res.json() as Promise<{saved: boolean}>;
}

export async function sendReelFeedback(postId: string, signal: 'interested' | 'not_interested'): Promise<void> {
  const res = await authedFetch(`/posts/${postId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({signal}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Could not send feedback');
  }
}

export type PostWhyResponse = {summary: string; lines: string[]};

export async function fetchPostWhy(postId: string): Promise<PostWhyResponse> {
  const res = await authedFetch(`/posts/${postId}/why`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Could not load explanation');
  }
  return res.json() as Promise<PostWhyResponse>;
}

/** Report with error propagation (reels / modals). */
export async function reportPostStrict(postId: string, reason: string): Promise<void> {
  const res = await authedFetch(`/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify({reason}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Could not submit report');
  }
}

export async function uploadMedia(
  localUri: string,
  meta?: {type: 'image' | 'video'; fileName?: string | null; category?: 'posts' | 'reels' | 'stories' | 'public'},
): Promise<{url: string; thumbnailUrl?: string; mediaType?: 'image' | 'video'; converted?: boolean}> {
  if (!auth().currentUser) throw new Error('Not authenticated');
  const base = apiBase();
  const category = meta?.category ?? 'posts';

  const part = buildMediaUploadPart(localUri, meta?.type ?? 'image', meta?.fileName);
  const form = new FormData();
  form.append('file', {uri: part.uri, type: part.type, name: part.name} as unknown as Blob);

  const res = await authorizedFetch(`${base}/media/upload?category=${encodeURIComponent(category)}`, {
    method: 'POST',
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as {message?: string}).message ?? 'Upload failed');
  }
  const url = (body as {url?: unknown}).url;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Upload succeeded but no file URL was returned. Try again or use MP4/MOV.');
  }
  const mt = (body as {mediaType?: unknown}).mediaType;
  const conv = (body as {converted?: unknown}).converted;
  return {
    url: url.trim(),
    thumbnailUrl: typeof (body as {thumbnailUrl?: unknown}).thumbnailUrl === 'string'
      ? (body as {thumbnailUrl: string}).thumbnailUrl.trim() || undefined
      : undefined,
    mediaType: mt === 'video' || mt === 'image' ? mt : undefined,
    converted: typeof conv === 'boolean' ? conv : undefined,
  };
}

export type UploadMediaAsyncMeta = {
  type: 'image' | 'video';
  fileName?: string | null;
  category?: 'posts' | 'reels' | 'stories';
  caption?: string;
  location?: string;
  music?: string;
  tags?: string[];
  feedCategory?: string;
  taggedUserIds?: string[];
  productIds?: string[];
  locationMeta?: PostLocationMeta | null;
  settings?: PostUploadSettings | null;
  durationMs?: number;
  /** JSON string: filters, trim, overlays (see packEditMetaForUpload). */
  clientEditMeta?: string;
};

function appendAsyncMeta(form: FormData, meta: UploadMediaAsyncMeta): void {
  if (meta.caption) form.append('caption', meta.caption);
  if (meta.location) form.append('location', meta.location);
  if (meta.music) form.append('music', meta.music);
  if (meta.tags?.length) form.append('tags', meta.tags.join(','));
  if (meta.feedCategory && meta.feedCategory !== 'general') form.append('feedCategory', meta.feedCategory);
  if (meta.taggedUserIds?.length) form.append('taggedUserIds', meta.taggedUserIds.join(','));
  if (meta.productIds?.length) form.append('productIds', meta.productIds.join(','));
  if (meta.locationMeta?.name) {
    form.append('locationMeta', JSON.stringify(meta.locationMeta));
  }
  if (meta.settings && Object.keys(meta.settings).length > 0) {
    form.append('settings', JSON.stringify(meta.settings));
  }
  if (typeof meta.durationMs === 'number' && !Number.isNaN(meta.durationMs)) {
    form.append('durationMs', String(Math.round(meta.durationMs)));
  }
  if (meta.clientEditMeta?.trim()) {
    form.append('clientEditMeta', meta.clientEditMeta);
  }
}

function postFormWithProgress(
  url: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<{ok: boolean; status: number; body: string}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'text';
    void getIdToken(false).then(
      token => {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (onProgress && e.lengthComputable && e.total > 0) {
            onProgress(Math.min(1, e.loaded / e.total));
          }
        };
        xhr.onload = () => {
          resolve({ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText ?? ''});
        };
        xhr.onerror = () => reject(new Error('Upload failed (network)'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 900_000;
        xhr.send(form as never);
      },
      err => reject(err instanceof Error ? err : new Error('Not authenticated')),
    );
  });
}

/**
 * Upload media asynchronously — returns immediately with jobId + postId.
 * Server processes HLS transcode in background and sends a notification when done.
 * Use for: reels, stories, and video posts.
 */
export async function uploadMediaAsync(
  localUri: string,
  meta: UploadMediaAsyncMeta,
  onProgress?: (fraction: number) => void,
): Promise<{jobId: string; postId: string; thumbnailUrl?: string}> {
  if (!auth().currentUser) throw new Error('Not authenticated');
  const base = apiBase();
  const category = meta.category ?? 'posts';

  const part = buildMediaUploadPart(localUri, meta.type, meta.fileName);
  const form = new FormData();
  form.append('file', {uri: part.uri, type: part.type, name: part.name} as unknown as Blob);
  appendAsyncMeta(form, meta);

  if (onProgress) {
    const url = `${base}/media/upload-async?category=${encodeURIComponent(category)}`;
    const {ok, body: text} = await postFormWithProgress(url, form, onProgress);
    const body = (() => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();
    if (!ok) {
      throw new Error((body.message as string | undefined) ?? (text.trim() || 'Async upload failed'));
    }
    const jobId = body.jobId as string | undefined;
    const postId = body.postId as string | undefined;
    if (!jobId || !postId) throw new Error('Server did not return jobId/postId');
    return {
      jobId,
      postId,
      thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : undefined,
    };
  }

  const res = await authorizedFetch(`${base}/media/upload-async?category=${encodeURIComponent(category)}`, {
    method: 'POST',
    body: form,
  });

  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.message as string | undefined) ?? 'Async upload failed');
  }

  const jobId = body.jobId as string | undefined;
  const postId = body.postId as string | undefined;
  if (!jobId || !postId) throw new Error('Server did not return jobId/postId');

  return {
    jobId,
    postId,
    thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : undefined,
  };
}

/** Poll the status of an async media job. */
export async function getMediaJob(jobId: string): Promise<MediaJobPoll> {
  const res = await authedFetch(`/media/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error('Failed to poll job');
  return res.json() as Promise<MediaJobPoll>;
}

/** Fetch all pending/processing jobs for the current user. */
export async function getMyPendingJobs(): Promise<{jobs: Array<{jobId: string; status: string; progress: number; postId?: string; category: string}>}> {
  const res = await authedFetch('/media/jobs');
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json() as Promise<{jobs: Array<{jobId: string; status: string; progress: number; postId?: string; category: string}>}>;
}

// Re-export apiBase for use by other modules
export {apiBase} from './authApi';
