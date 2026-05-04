import React from 'react';
import {View} from 'react-native';
import Video from 'react-native-video';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';

type Props = {
  uri: string;
  muted: boolean;
  paused: boolean;
  /** Match primary video `repeat` so audio doesn't loop past clip end when applicable */
  repeat?: boolean;
};

/**
 * Off-screen audio playback for “Use this sound” / original-audio posts where the visual is an image
 * or the main video’s muxed track must stay muted while the selected sound plays.
 */
export function OriginalSoundAudioLayer({uri, muted, paused, repeat = true}: Props) {
  const src = resolveMediaUrl(uri) || uri;
  return (
    <View
      style={{position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden'}}
      pointerEvents="none">
      <Video
        source={{uri: src}}
        muted={muted}
        paused={paused}
        repeat={repeat}
        resizeMode="contain"
        ignoreSilentSwitch="ignore"
        playInBackground={false}
      />
    </View>
  );
}
