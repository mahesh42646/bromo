import {useCallback, useState} from 'react';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';

/** Single-preview-at-a-time toggle for audio picker rows (same URI toggles off). */
export function useAudioPreview() {
  const [uri, setUri] = useState<string | null>(null);
  const play = useCallback((u: string) => {
    const r = resolveMediaUrl(u) || u;
    setUri(x => (x === r ? null : r));
  }, []);
  const stop = useCallback(() => setUri(null), []);
  const isPlaying = useCallback(
    (u: string) => (resolveMediaUrl(u) || u) === uri,
    [uri],
  );
  return {previewUri: uri, play, stop, isPlaying};
}
