import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Post} from '../api/postsApi';

const KEY = '@bromo/reel_feed_cache_v1';
const MAX_CACHED = 10;

type Bundle = {
  posts: Post[];
  fetchedAt: number;
};

export async function peekReelFeedCache(): Promise<Bundle | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as Bundle;
    if (!b?.posts?.length) return null;
    return b;
  } catch {
    return null;
  }
}

export async function saveReelFeedCache(posts: Post[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({posts: posts.slice(0, MAX_CACHED), fetchedAt: Date.now()}));
  } catch {}
}

export async function clearReelFeedCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
