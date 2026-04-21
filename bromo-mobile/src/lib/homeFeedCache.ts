import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Post} from '../api/postsApi';

const KEY = '@bromo/home_feed_cache_v1';
const MAX_CACHED = 20;

type Bundle = {
  category: string;
  posts: Post[];
  fetchedAt: number;
};

export async function peekHomeFeedCache(): Promise<Bundle | null> {
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

export async function saveHomeFeedCache(category: string, posts: Post[]): Promise<void> {
  try {
    const bundle: Bundle = {
      category,
      posts: posts.slice(0, MAX_CACHED),
      fetchedAt: Date.now(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(bundle));
  } catch {}
}

export async function clearHomeFeedCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
