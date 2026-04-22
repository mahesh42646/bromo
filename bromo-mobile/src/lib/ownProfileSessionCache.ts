import type {Post, UserGridStats} from '../api/postsApi';

const gridStatsByUser = new Map<string, UserGridStats>();
const postsByUserTab = new Map<string, Post[]>();

function postsKey(userId: string, tab: 'posts' | 'reels' | 'saved'): string {
  return `${userId}:${tab}`;
}

export function getCachedOwnGridStats(userId: string): UserGridStats | undefined {
  return gridStatsByUser.get(String(userId));
}

export function setCachedOwnGridStats(userId: string, s: UserGridStats): void {
  gridStatsByUser.set(String(userId), s);
}

export function getCachedOwnPosts(
  userId: string,
  tab: 'posts' | 'reels' | 'saved',
): Post[] | undefined {
  return postsByUserTab.get(postsKey(userId, tab));
}

export function setCachedOwnPosts(
  userId: string,
  tab: 'posts' | 'reels' | 'saved',
  posts: Post[],
): void {
  postsByUserTab.set(postsKey(userId, tab), posts);
}

export function invalidateOwnProfileSession(userId: string): void {
  const id = String(userId);
  gridStatsByUser.delete(id);
  for (const k of [...postsByUserTab.keys()]) {
    if (k.startsWith(`${id}:`)) postsByUserTab.delete(k);
  }
}

export function clearOwnProfileSessionCache(): void {
  gridStatsByUser.clear();
  postsByUserTab.clear();
}
