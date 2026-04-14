import AsyncStorage from '@react-native-async-storage/async-storage';
import {fetchStories, type StoryGroup} from '../api/postsApi';

const STORAGE_KEY = '@bromo/stories_feed_bundle_v1';

type Bundle = {
  etag: string;
  stories: StoryGroup[];
  fetchedAt: number;
};

let inflight: Promise<StoryGroup[]> | null = null;

async function readBundle(): Promise<Bundle | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Bundle;
  } catch {
    return null;
  }
}

async function writeBundle(b: Bundle): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {}
}

/** Instant hydrate from disk (AsyncStorage); no network. */
export async function peekStoriesFromCache(): Promise<StoryGroup[] | null> {
  const b = await readBundle();
  return b?.stories?.length ? b.stories : null;
}

export async function clearStoriesFeedCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Loads the stories tray payload: uses saved ETag for conditional GET,
 * persists full JSON on change. `force` skips ETag (e.g. after `story:new`).
 */
export async function loadStoriesFeed(options: {force?: boolean} = {}): Promise<StoryGroup[]> {
  const cached = await readBundle();
  try {
    if (options.force) {
      const r = await fetchStories(null);
      if (r.notModified) return cached?.stories ?? [];
      await writeBundle({etag: r.etag, stories: r.stories, fetchedAt: Date.now()});
      return r.stories;
    }

    const r = await fetchStories(cached?.etag ?? null);
    if (r.notModified && cached?.stories) {
      return cached.stories;
    }
    if (!r.notModified) {
      await writeBundle({etag: r.etag, stories: r.stories, fetchedAt: Date.now()});
      return r.stories;
    }
    return cached?.stories ?? [];
  } catch (err) {
    if (cached?.stories?.length) return cached.stories;
    throw err;
  }
}

/** Coalesces parallel callers (e.g. Home + Story viewer) into one in-flight request. */
export function loadStoriesFeedDeduped(options?: {force?: boolean}): Promise<StoryGroup[]> {
  if (options?.force) {
    return loadStoriesFeed({force: true});
  }
  if (inflight) return inflight;
  inflight = loadStoriesFeed({}).finally(() => {
    inflight = null;
  });
  return inflight;
}
