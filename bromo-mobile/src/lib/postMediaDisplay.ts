import type {Post} from '../api/postsApi';
import {resolveVideoUrl} from '../api/postsApi';
import {resolveMediaUrl} from './resolveMediaUrl';

type ThumbPost = Pick<Post, 'mediaUrl' | 'thumbnailUrl' | 'mediaType' | 'hlsMasterUrl'>;

function uploadsUserCategory(url: string): { uid: string; cat: string } | null {
  let pathname = url.trim();
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    if (!pathname.startsWith('/')) return null;
  }
  const m = pathname.match(/^\/uploads\/([^/]+)\/([^/]+)\//);
  if (!m) return null;
  return { uid: m[1], cat: m[2] };
}

/** Stale/wrong poster paths (e.g. product PNG under /store/ on a story/reel video). */
function shouldIgnoreVideoThumbnail(
  mediaType: string | undefined,
  thumbResolved: string,
  mediaResolved: string,
): boolean {
  if (mediaType !== 'video' || !thumbResolved) return false;
  const t = uploadsUserCategory(thumbResolved);
  const m = uploadsUserCategory(mediaResolved);
  if (t && m && t.cat === 'store' && m.cat !== 'store') return true;
  if (t && m && t.uid === m.uid && t.cat !== m.cat) return true;
  return false;
}

/**
 * Prefer server JPEG poster when it matches the video. Otherwise fall back to progressive URL;
 * for HLS-only posts returns '' so callers use `<Video>` for first frame.
 */
export function postThumbnailUri(post: ThumbPost): string {
  const thumbRaw = post.thumbnailUrl?.trim();
  const thumbResolved = thumbRaw ? resolveMediaUrl(thumbRaw) : '';
  const mediaResolved = resolveMediaUrl(post.mediaUrl);

  if (
    thumbResolved &&
    !shouldIgnoreVideoThumbnail(post.mediaType, thumbResolved, mediaResolved)
  ) {
    return thumbResolved;
  }

  const media = mediaResolved;
  if (post.mediaType === 'video' && media.includes('.m3u8')) {
    return '';
  }
  return media;
}

/** URI for small circular / grid previews: image URL, or playable video URL (HLS/MP4) for first frame. */
export function postPreviewPlayUri(post: ThumbPost): string {
  const img = postThumbnailUri(post);
  if (img && !isPlayableVideoUri(img)) return img;
  if (post.mediaType === 'video') {
    return resolveMediaUrl(resolveVideoUrl(post as Post, false));
  }
  return img || resolvedUploadMedia(post);
}

function resolvedUploadMedia(post: ThumbPost): string {
  return resolveMediaUrl(post.mediaUrl);
}

function isPlayableVideoUri(u: string): boolean {
  return /\.m3u8(\?|$)/i.test(u) || /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(u);
}
