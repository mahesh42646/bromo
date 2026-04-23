import type {Post} from '../api/postsApi';
import {resolveMediaUrl} from './resolveMediaUrl';

/**
 * Prefer server poster / thumbnail for grids. Never return an HLS playlist URL for `<Image>` —
 * those must use a `<Video>` preview (first frame) instead.
 */
export function postThumbnailUri(post: Pick<Post, 'mediaUrl' | 'thumbnailUrl' | 'mediaType'>): string {
  const thumb = post.thumbnailUrl?.trim();
  if (thumb) return resolveMediaUrl(thumb);
  const media = resolveMediaUrl(post.mediaUrl);
  if (post.mediaType === 'video' && media.includes('.m3u8')) {
    return '';
  }
  return media;
}
