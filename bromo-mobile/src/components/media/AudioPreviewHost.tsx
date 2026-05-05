import React from 'react';
import {StyleSheet, View} from 'react-native';
import Video from 'react-native-video';

/** Hidden player driven by `useAudioPreview` — mount once near root of the sheet/screen. */
export function AudioPreviewHost({uri}: {uri: string | null}) {
  if (!uri) return null;
  return (
    <View style={styles.host} pointerEvents="none" collapsable={false}>
      <Video
        source={{uri}}
        style={StyleSheet.absoluteFill}
        paused={false}
        muted={false}
        repeat={false}
        resizeMode="contain"
        ignoreSilentSwitch="ignore"
        playInBackground={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: 0,
    top: 0,
  },
});
