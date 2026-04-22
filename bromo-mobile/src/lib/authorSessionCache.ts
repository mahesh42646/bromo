import {Image} from 'react-native';
import {resolveMediaUrl} from './resolveMediaUrl';
import type {PostAuthor} from '../api/postsApi';

type AuthorSnapshot = Partial<PostAuthor> & {_id: string};

const TTL_MS = 15 * 60 * 1000;
const entries = new Map<string, {snap: AuthorSnapshot; at: number}>();

export function rememberAuthor(author: PostAuthor | null | undefined): void {
  if (!author?._id) return;
  const id = String(author._id);
  const prev = entries.get(id);
  const snap: AuthorSnapshot = {
    ...(prev?.snap ?? {}),
    ...author,
    _id: id,
  };
  entries.set(id, {snap, at: Date.now()});
  const raw = snap.profilePicture?.trim();
  if (raw) {
    const u = resolveMediaUrl(raw) || raw;
    void Image.prefetch(u).catch(() => null);
  }
}

export function getAuthorMerge(base: PostAuthor): PostAuthor {
  const id = String(base._id);
  const hit = entries.get(id);
  if (!hit || Date.now() - hit.at > TTL_MS) return base;
  return {...hit.snap, ...base} as PostAuthor;
}

/** Best-effort snapshot for instant profile header when navigating from feed. */
export function peekAuthorSnapshot(userId: string): PostAuthor | null {
  const hit = entries.get(String(userId));
  if (!hit || Date.now() - hit.at > TTL_MS) return null;
  return hit.snap as PostAuthor;
}

export function clearAuthorSessionCache(): void {
  entries.clear();
}
