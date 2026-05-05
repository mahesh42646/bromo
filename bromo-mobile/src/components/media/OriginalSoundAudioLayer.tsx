import React, {useEffect, useRef} from 'react';
import {View} from 'react-native';
import Video from 'react-native-video';
import type {OnLoadData} from 'react-native-video';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';

type Props = {
  uri: string;
  muted: boolean;
  paused: boolean;
  /** Match primary video `repeat` so audio doesn't loop past clip end when applicable */
  repeat?: boolean;
  /** Skip beginning of the extracted sound (ms), from editor `clientEditMeta.audio`. */
  startOffsetMs?: number;
};

/**
 * Off-screen audio playback for “Use this sound” / original-audio posts where the visual is an image
 * or the main video’s muxed track must stay muted while the selected sound plays.
 */
export function OriginalSoundAudioLayer({
  uri,
  muted,
  paused,
  repeat = true,
  startOffsetMs = 0,
}: Props) {
  const src = resolveMediaUrl(uri) || uri;
  const vRef = useRef<React.ElementRef<typeof Video>>(null);
  const seekDone = useRef(false);
  useEffect(() => {
    seekDone.current = false;
  }, [src, startOffsetMs]);

  const onLoad = (_d: OnLoadData) => {
    if (seekDone.current) return;
    if (startOffsetMs > 0) {
      seekDone.current = true;
      vRef.current?.seek(startOffsetMs / 1000);
    }
  };
  return (
    <View
      style={{position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden'}}
      pointerEvents="none">
      <Video
        ref={vRef}
        source={{uri: src}}
        muted={muted}
        paused={paused}
        repeat={repeat}
        resizeMode="contain"
        ignoreSilentSwitch="ignore"
        playInBackground={false}
        onLoad={onLoad}
      />
    </View>
  );
}
