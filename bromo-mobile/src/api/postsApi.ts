import auth from '@react-native-firebase/auth';
import {authedFetch, apiBase} from './authApi';
import {buildMediaUploadPart} from '../lib/mediaUploadPart';

export type PostAuthor = {
  _id: string;
  username: string;
  displayName: string;
  profilePicture: string;
  isPrivate: boolean;
  emailVerified: boolean;
};

export type Post = {
  _id: string;
  author: PostAuthor;
  type: 'post' | 'reel' | 'story';
  mediaUrl: string;
  mediaType: 'image' | 'video';
  /** Server-generated for video; use for grids and `<Image>` previews */
  thumbnailUrl?: string;
  caption: string;
  location: string;
  music: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  isLiked: boolean;
  isFollowing: boolean;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
};

export type Comment = {
  _id: string;
  author: PostAuthor;
  text: string;
  likesCount: number;
  parentId?: string;
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

export async function getStories(): Promise<{stories: StoryGroup[]}> {
  const res = await authedFetch('/posts/stories');
  if (!res.ok) throw new Error('Failed to fetch stories');
  return res.json() as Promise<{stories: StoryGroup[]}>;
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

export async function recordView(postId: string): Promise<void> {
  await authedFetch(`/posts/${postId}/view`, {method: 'POST'}).catch(() => null);
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

export async function uploadMedia(
  localUri: string,
  meta?: {type: 'image' | 'video'; fileName?: string | null; category?: 'posts' | 'reels' | 'stories' | 'public'},
): Promise<{url: string; thumbnailUrl?: string}> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken(false);
  const base = apiBase();
  const category = meta?.category ?? 'posts';

  const part = buildMediaUploadPart(localUri, meta?.type ?? 'image', meta?.fileName);
  const form = new FormData();
  form.append('file', {uri: part.uri, type: part.type, name: part.name} as unknown as Blob);

  const res = await fetch(`${base}/media/upload?category=${encodeURIComponent(category)}`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Upload failed');
  }
  return res.json() as Promise<{url: string; thumbnailUrl?: string}>;
}

// Re-export apiBase for use by other modules
export {apiBase} from './authApi';
