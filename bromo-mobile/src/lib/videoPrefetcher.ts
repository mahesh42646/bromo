import {resolveVideoUrl, type Post} from '../api/postsApi';
import {BromoImage} from '../components/ui/BromoImage';
import {postThumbnailUri} from './postMediaDisplay';
import {resolveMediaUrl} from './resolveMediaUrl';

const warmed = new Set<string>();

function resolve(raw?: string | null): string {
  if (!raw) return '';
  return resolveMediaUrl(raw) || raw;
}

export function prefetchNextReels(posts: Post[]): void {
  BromoImage.preload(posts.map(post => resolve(postThumbnailUri(post) || post.thumbnailUrl || post.mediaUrl)));

  posts.forEach(post => {
    if (post.mediaType !== 'video') return;
    const uri = resolve(resolveVideoUrl(post));
    if (!uri || warmed.has(uri)) return;
    warmed.add(uri);
    fetch(uri, {method: 'HEAD'}).catch(() => null);
  });
}
