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
  return {id: t.id, title: t.title, artist: t.artist};
}

function mapOriginal(a: OriginalAudio): AudioTrack {
  return {
    id: a._id,
    title: a.title,
    artist: a.owner?.displayName ?? a.owner?.username ?? 'Original sound',
    url: a.audioUrl,
    originalAudioId: a._id,
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
