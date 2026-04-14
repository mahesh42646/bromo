import auth from '@react-native-firebase/auth';
import {authedFetch, apiBase, authorizedFetch} from './authApi';
import {buildMediaUploadPart} from '../lib/mediaUploadPart';

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
  /** Story-only: overlays and background color */
  storyMeta?: StoryMeta;
  /** Story tray: whether the current user has finished this segment (server). */
  seenByMe?: boolean;
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
  replies?: Comment[];
  repliesCount?: number;
  hasMoreReplies?: boolean;
  createdAt: string;
};

export type FeedResponse = {
  posts: Post[];
  page: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

export type CommentsResponse = {
  comments: Comment[];
  page: number;
  hasMore: boolean;
};

export async function getFeed(page = 1): Promise<FeedResponse> {
  const res = await authedFetch(`/posts/feed?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json() as Promise<FeedResponse>;
}

export async function getReels(page = 1): Promise<FeedResponse> {
  const res = await authedFetch(`/posts/reels?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch reels');
  return res.json() as Promise<FeedResponse>;
}

export async function getExplore(page = 1): Promise<FeedResponse> {
  const res = await authedFetch(`/posts/explore?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch explore');
  return res.json() as Promise<FeedResponse>;
}

export type StoryGroup = {
  author: PostAuthor;
  stories: Post[];
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
  const res = await authedFetch(`/posts/user/${userId}?type=${type}&page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch user posts');
  return res.json() as Promise<FeedResponse>;
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
  music?: string;
  tags?: string[];
  storyMeta?: StoryMeta;
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

export async function recordView(postId: string, watchMs = 0): Promise<void> {
  await authedFetch(`/posts/${postId}/view`, {
    method: 'POST',
    body: JSON.stringify({watchMs: Math.round(watchMs)}),
  }).catch(() => null);
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

/**
 * Upload media asynchronously — returns immediately with jobId + postId.
 * Server processes HLS transcode in background and sends a notification when done.
 * Use for: reels, stories, and video posts.
 */
export async function uploadMediaAsync(
  localUri: string,
  meta: {
    type: 'image' | 'video';
    fileName?: string | null;
    category?: 'posts' | 'reels' | 'stories';
    caption?: string;
    location?: string;
    music?: string;
    tags?: string[];
  },
): Promise<{jobId: string; postId: string; thumbnailUrl?: string}> {
  if (!auth().currentUser) throw new Error('Not authenticated');
  const base = apiBase();
  const category = meta.category ?? 'posts';

  const part = buildMediaUploadPart(localUri, meta.type, meta.fileName);
  const form = new FormData();
  form.append('file', {uri: part.uri, type: part.type, name: part.name} as unknown as Blob);
  if (meta.caption) form.append('caption', meta.caption);
  if (meta.location) form.append('location', meta.location);
  if (meta.music) form.append('music', meta.music);
  if (meta.tags?.length) form.append('tags', meta.tags.join(','));

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
