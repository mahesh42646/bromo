import React from 'react';
import {View, type StyleProp, type ImageStyle} from 'react-native';
import type {Post} from '../../api/postsApi';
import {postThumbnailUri} from '../../lib/postMediaDisplay';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';
import {BromoImage} from '../ui/BromoImage';

type Props = {
  post: Post;
  style: StyleProp<ImageStyle>;
};

/** Grid cells must never mount paused video players; use server thumbnails only. */
export function ProfileGridMedia({post, style}: Props) {
  const thumbRaw = postThumbnailUri(post);
  const thumb = thumbRaw ? resolveMediaUrl(thumbRaw) || thumbRaw : '';

  if (!thumb) return <View style={style} />;

  return <BromoImage uri={thumb} style={style} resizeMode="cover" />;
}
