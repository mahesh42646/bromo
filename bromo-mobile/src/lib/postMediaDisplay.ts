import type {Post} from '../api/postsApi';

/** Prefer video poster / thumbnail so Image and grids are never fed a raw video URL. */
export function postThumbnailUri(post: Pick<Post, 'mediaUrl' | 'thumbnailUrl' | 'mediaType'>): string {
  const thumb = post.thumbnailUrl?.trim();
  if (post.mediaType === 'video' && thumb) return thumb;
  return post.mediaUrl;
}
