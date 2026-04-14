import ReactNativeBlobUtil from 'react-native-blob-util';

const SUBDIR = 'bromo-story-videos';

function cacheRoot(): string {
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${SUBDIR}`;
}

function extFromUrl(url: string): string {
  const m = url.split(/[?#]/)[0]?.match(/\.(mov|mp4|m4v|webm)$/i);
  return m ? `.${m[1].toLowerCase()}` : '.mp4';
}

function filePathFor(storyId: string, remoteUrl: string): string {
  const safeId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cacheRoot()}/${safeId}${extFromUrl(remoteUrl)}`;
}

function pathToFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `file://${normalized}`;
}

async function ensureCacheDir(): Promise<void> {
  const root = cacheRoot();
  const ok = await ReactNativeBlobUtil.fs.exists(root);
  if (!ok) {
    await ReactNativeBlobUtil.fs.mkdir(root).catch(() => null);
  }
}

const prefetchInProgress = new Set<string>();

/**
 * If the story MP4/MOV was downloaded earlier, returns a `file://` URI (no HTTP to origin).
 * Otherwise returns the remote URL (player streams from network).
 */
export async function resolveStoryVideoPlayUri(remoteUrl: string, storyId: string): Promise<string> {
  if (!remoteUrl?.trim()) return remoteUrl;
  await ensureCacheDir();
  const path = filePathFor(storyId, remoteUrl);
  if (await ReactNativeBlobUtil.fs.exists(path)) {
    return pathToFileUri(path);
  }
  return remoteUrl;
}

/**
 * Downloads the full file into app cache so the next `resolveStoryVideoPlayUri` uses disk only.
 * Safe to call repeatedly; deduped per `storyId`.
 */
export function prefetchStoryVideoToDisk(remoteUrl: string, storyId: string): void {
  if (!remoteUrl?.trim()) return;
  if (prefetchInProgress.has(storyId)) return;
  prefetchInProgress.add(storyId);
  void (async () => {
    try {
      await ensureCacheDir();
      const path = filePathFor(storyId, remoteUrl);
      if (await ReactNativeBlobUtil.fs.exists(path)) return;
      await ReactNativeBlobUtil.config({path})
        .fetch('GET', remoteUrl, {
          'User-Agent': 'BromoMobile/1 (story-video-cache)',
        })
        .catch(() => null);
    } finally {
      prefetchInProgress.delete(storyId);
    }
  })();
}

export async function clearStoryVideoCache(): Promise<void> {
  prefetchInProgress.clear();
  const root = cacheRoot();
  try {
    if (!(await ReactNativeBlobUtil.fs.exists(root))) return;
    const names = await ReactNativeBlobUtil.fs.ls(root);
    await Promise.all(
      names.map(n => ReactNativeBlobUtil.fs.unlink(`${root}/${n}`).catch(() => null)),
    );
    await ReactNativeBlobUtil.fs.unlink(root).catch(() => null);
  } catch {
    /* ignore */
  }
}
