import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';

type Ctx = {
  homeFeedMuted: boolean;
  setHomeFeedMuted: (v: boolean) => void;
  toggleHomeFeedMuted: () => void;
  reelsMuted: boolean;
  setReelsMuted: (v: boolean) => void;
  toggleReelsMuted: () => void;
};

const PlaybackMuteContext = createContext<Ctx | null>(null);

export function PlaybackMuteProvider({children}: {children: React.ReactNode}) {
  const [homeFeedMuted, setHomeFeedMuted] = useState(true);
  const [reelsMuted, setReelsMuted] = useState(false);
  const toggleHomeFeedMuted = useCallback(() => setHomeFeedMuted(m => !m), []);
  const toggleReelsMuted = useCallback(() => setReelsMuted(m => !m), []);
  const value = useMemo(
    () => ({
      homeFeedMuted,
      setHomeFeedMuted,
      toggleHomeFeedMuted,
      reelsMuted,
      setReelsMuted,
      toggleReelsMuted,
    }),
    [homeFeedMuted, reelsMuted, toggleHomeFeedMuted, toggleReelsMuted],
  );
  return <PlaybackMuteContext.Provider value={value}>{children}</PlaybackMuteContext.Provider>;
}

export function usePlaybackMute() {
  const c = useContext(PlaybackMuteContext);
  if (!c) throw new Error('usePlaybackMute requires PlaybackMuteProvider');
  return c;
}
