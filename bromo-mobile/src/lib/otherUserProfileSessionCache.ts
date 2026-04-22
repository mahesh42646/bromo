import type {UserProfile} from '../api/followApi';
import type {Post, UserGridStats} from '../api/postsApi';

const TTL_MS = 15 * 60 * 1000;

type Bundle = {
  profile: UserProfile;
  gridStats: UserGridStats | null;
  posts: Post[];
  at: number;
};

const byUser = new Map<string, Bundle>();

export function getOtherUserProfileBundle(userId: string): Bundle | null {
  const b = byUser.get(String(userId));
  if (!b || Date.now() - b.at > TTL_MS) return null;
  return b;
}

export function rememberOtherUserProfileBundle(userId: string, bundle: Omit<Bundle, 'at'>): void {
  byUser.set(String(userId), {...bundle, at: Date.now()});
}

export function invalidateOtherUserProfile(userId: string): void {
  byUser.delete(String(userId));
}

export function clearOtherUserProfileSessionCache(): void {
  byUser.clear();
}
