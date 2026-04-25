import React, {useState} from 'react';
import {Image, View, type StyleProp, type ImageStyle} from 'react-native';
import Video from 'react-native-video';
import type {Post} from '../../api/postsApi';
import {resolveVideoUrl} from '../../api/postsApi';
import {postThumbnailUri} from '../../lib/postMediaDisplay';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';

type Props = {
  post: Post;
  style: StyleProp<ImageStyle>;
};

/** Grid cell: poster image when available; otherwise paused video (first frame) for HLS/MP4. */
export function ProfileGridMedia({post, style}: Props) {
  const thumbRaw = postThumbnailUri(post);
  const thumb = thumbRaw ? resolveMediaUrl(thumbRaw) || thumbRaw : '';
  const isVideo = post.mediaType === 'video' || post.type === 'reel';
  const videoUriRaw = isVideo ? resolveVideoUrl(post) : '';
  const videoUri = videoUriRaw ? resolveMediaUrl(videoUriRaw) || videoUriRaw : '';
  const [imgErr, setImgErr] = useState(false);

  if (isVideo && (imgErr || !thumb)) {
    if (!videoUri) {
      return <View style={style} />;
    }
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
      source={{uri: thumb || videoUri || undefined}}
      style={style}
      onError={() => setImgErr(true)}
    />
  );
}
