import type {Post} from '../api/postsApi';
import {resolveMediaUrl} from './resolveMediaUrl';

/** In-memory post cache for one app session (cross Home → Reels, etc.). */
const byId = new Map<string, Post>();

export function rememberPostsFromFeed(posts: readonly Post[]): void {
  for (const p of posts) {
    if (p?._id) byId.set(String(p._id), p);
  }
}

export function getCachedPost(postId: string): Post | undefined {
  return byId.get(String(postId));
}

/** Merge server list with any richer objects we've already seen (e.g. from Home). */
export function mergePostsWithSessionCache(posts: Post[]): Post[] {
  return posts.map(p => {
    const prev = byId.get(String(p._id));
    if (!prev) {
      byId.set(String(p._id), p);
      return p;
    }
    const merged = {...prev, ...p} as Post;
    byId.set(String(p._id), merged);
    return merged;
  });
}

export function prefetchPostThumbnails(posts: readonly Post[]): void {
  const {Image} = require('react-native') as typeof import('react-native');
  for (const p of posts) {
    const u = resolveMediaUrl(p.thumbnailUrl ?? p.mediaUrl ?? '');
    if (u) void Image.prefetch(u).catch(() => null);
  }
}

export function clearPostEntityCache(): void {
  byId.clear();
}
