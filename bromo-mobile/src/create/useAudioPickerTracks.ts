import {useEffect, useState} from 'react';
import type {AudioTrack} from './createTypes';
import {searchOriginalAudios, type OriginalAudio} from '../api/postsApi';
import {getLicensedMusicTrending, searchLicensedMusic} from '../api/musicApi';

/** Static fallback when APIs fail or return empty (offline / misconfigured). */
const FALLBACK_TRACKS: AudioTrack[] = [
  {id: 'a1', title: 'Original audio', artist: 'BROMO Sound'},
  {id: 'a2', title: 'City Nights', artist: 'Lo-Fi Pack'},
  {id: 'a3', title: 'Drill Beat', artist: 'Trending'},
];

function mapLicensed(t: {id: string; title: string; artist: string}): AudioTrack {
  return {id: t.id, title: t.title, artist: t.artist, musicTrackId: t.id};
}

function mapOriginal(a: OriginalAudio): AudioTrack {
  const uname = a.owner?.username?.trim();
  return {
    id: a._id,
    title: a.title,
    artist: uname ? `@${uname}` : a.owner?.displayName ?? 'Original sound',
    url: a.audioUrl,
    coverUrl: a.coverUrl,
    durationMs: a.durationMs,
    useCount: typeof a.useCount === 'number' ? a.useCount : undefined,
    totalViews: typeof a.totalViews === 'number' ? a.totalViews : undefined,
    originalAudioId: a._id,
    sourcePostId: a.sourcePostId,
  };
}

/**
 * Loads licensed catalog (`/music/*`) + community originals (`/posts/audio/search`)
 * for the media editor and share “Add music” sheet.
 */
export function useAudioPickerTracks(active: boolean, query: string) {
  const [tracks, setTracks] = useState<AudioTrack[]>(FALLBACK_TRACKS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const q = query.trim();
    const handle = setTimeout(() => {
      (async () => {
        setLoading(true);
        try {
          const [licensed, origRes] = await Promise.all([
            q ? searchLicensedMusic(q) : getLicensedMusicTrending(),
            searchOriginalAudios(q).catch(() => ({audios: [] as OriginalAudio[]})),
          ]);
          if (cancelled) return;
          const licTracks = licensed.map(mapLicensed);
          const origTracks = (origRes.audios ?? []).map(mapOriginal);
          const merged = [...licTracks, ...origTracks];
          setTracks(merged.length > 0 ? merged : FALLBACK_TRACKS);
        } catch {
          if (!cancelled) setTracks(FALLBACK_TRACKS);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, q ? 320 : 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [active, query]);

  return {tracks, loading};
}
