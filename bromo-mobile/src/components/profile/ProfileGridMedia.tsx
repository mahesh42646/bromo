import React, {useState} from 'react';
import {Image, type StyleProp, type ViewStyle} from 'react-native';
import Video from 'react-native-video';
import type {Post} from '../../api/postsApi';
import {resolveVideoUrl} from '../../api/postsApi';
import {postThumbnailUri} from '../../lib/postMediaDisplay';

type Props = {
  post: Post;
  style: StyleProp<ViewStyle>;
};

/** Grid cell: poster image when available; otherwise paused video (first frame) for HLS/MP4. */
export function ProfileGridMedia({post, style}: Props) {
  const thumb = postThumbnailUri(post);
  const isVideo = post.mediaType === 'video' || post.type === 'reel';
  const videoUri = isVideo ? resolveVideoUrl(post) : '';
  const [imgErr, setImgErr] = useState(false);

  if (isVideo && (imgErr || !thumb)) {
    return (
      <Video
        source={{uri: videoUri}}
        style={style}
        resizeMode="cover"
        paused
        muted
        repeat={false}
        ignoreSilentSwitch="ignore"
        disableFocus
        playInBackground={false}
        poster={thumb || undefined}
        posterResizeMode="cover"
      />
    );
  }

  return (
    <Image
      source={{uri: thumb || videoUri}}
      style={style}
      onError={() => setImgErr(true)}
    />
  );
}
