import React, {useRef} from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {EditMetaLayers} from './EditMetaLayers';
import {NetworkVideo, type NetworkVideoHandle, type NetworkVideoProps} from './NetworkVideo';
import {OriginalSoundAudioLayer} from './OriginalSoundAudioLayer';
import {resolveAttachedOriginalSoundUri, type Post} from '../../api/postsApi';
import {
  getAudioPlaybackFromMeta,
  getMetaForAssetIndex,
  parseClientEditMeta,
} from '../../create/editMetaTypes';

type Props = Omit<NetworkVideoProps, 'style'> & {
  post: Pick<Post, 'clientEditMeta' | 'originalSoundUrl' | 'audioRemuxStatus'>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Feed / reels video: applies `clientEditMeta` playback speed, trim loop, and filter/text/sticker layers.
 */
export function PostVideoWithClientMeta({
  post,
  style,
  onLoad: onLoadProp,
  onProgress: onProgressProp,
  rate: rateProp,
  repeat: repeatProp,
  muted,
  ...rest
}: Props) {
  const videoRef = useRef<NetworkVideoHandle>(null);
  const durRef = useRef(0);
  const attachedSoundUri = resolveAttachedOriginalSoundUri(post);
  const audioPb = getAudioPlaybackFromMeta(post.clientEditMeta ?? null);
  const meta = parseClientEditMeta(post.clientEditMeta ?? null);
  const m0 = meta ? getMetaForAssetIndex(meta, 0) : null;
  const trimStart = m0?.trimStart ?? 0;
  const trimEnd = m0?.trimEnd ?? 1;
  const metaRate = m0?.playbackSpeed ?? 1;
  const rate = rateProp ?? metaRate;
  const trimActive = trimEnd < 0.998;
  let repeat = trimActive ? false : (repeatProp ?? false);
  if (attachedSoundUri && audioPb?.loopVideoToAudio) {
    repeat = true;
  }
  const videoMuted = attachedSoundUri ? true : Boolean(muted);

  const onLoad: NetworkVideoProps['onLoad'] = d => {
    durRef.current = typeof d.duration === 'number' && Number.isFinite(d.duration) && d.duration > 0 ? d.duration : 0;
    if (durRef.current > 0 && trimStart > 0) {
      videoRef.current?.seek(trimStart * durRef.current);
    }
    onLoadProp?.(d);
  };

  const onProgress: NetworkVideoProps['onProgress'] = p => {
    onProgressProp?.(p);
    const dur = durRef.current;
    if (dur <= 0 || trimEnd >= 0.999) return;
    const te = trimEnd * dur;
    const ts = trimStart * dur;
    if (p.currentTime >= te - 0.08) {
      videoRef.current?.seek(ts);
    }
  };

  return (
    <View style={style}>
      <NetworkVideo
        ref={videoRef}
        {...rest}
        muted={videoMuted}
        style={StyleSheet.absoluteFill}
        rate={rate}
        repeat={repeat}
        onLoad={onLoad}
        onProgress={onProgress}
      />
      {attachedSoundUri ? (
        <OriginalSoundAudioLayer
          uri={attachedSoundUri}
          muted={Boolean(muted)}
          paused={Boolean(rest.paused)}
          repeat={repeat}
          startOffsetMs={audioPb?.startOffsetMs ?? 0}
        />
      ) : null}
      <EditMetaLayers clientEditMeta={post.clientEditMeta} />
    </View>
  );
}
