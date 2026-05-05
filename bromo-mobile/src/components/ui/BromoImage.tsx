import React from 'react';
import {Image, type ImageProps, type ImageStyle, type StyleProp} from 'react-native';
import FastImage, {type FastImageProps, type Priority, type ResizeMode} from 'react-native-fast-image';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';

type Props = Omit<ImageProps, 'source' | 'style' | 'resizeMode' | 'defaultSource'> & {
  uri?: string | null;
  source?: ImageProps['source'];
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
  priority?: Priority;
  cache?: 'immutable' | 'web' | 'cacheOnly';
};

function BromoImageBase({
  uri,
  source,
  style,
  resizeMode = 'cover',
  priority = 'normal',
  cache = 'immutable',
  ...rest
}: Props) {
  const rawUri =
    uri ??
    (source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source
      ? String(source.uri ?? '')
      : '');
  const resolved = rawUri ? resolveMediaUrl(rawUri) || rawUri : '';

  if (!resolved && source) {
    return <Image source={source} style={style} resizeMode={resizeMode} {...rest} />;
  }
  if (!resolved) {
    return <Image source={undefined} style={style} resizeMode={resizeMode} {...rest} />;
  }
  return (
    <FastImage
      {...({
        source: {uri: resolved, priority, cache},
        style,
        resizeMode,
        ...rest,
      } as FastImageProps)}
    />
  );
}

export type BromoImageComponent = typeof BromoImageBase & {
  preload: (uris: Array<string | null | undefined>) => void;
};

export const BromoImage = BromoImageBase as BromoImageComponent;

BromoImage.preload = (uris: Array<string | null | undefined>) => {
  FastImage.preload(
    uris
      .map(u => (u ? resolveMediaUrl(u) || u : ''))
      .filter(Boolean)
      .map(uri => ({uri, cache: FastImage.cacheControl.immutable})),
  );
};
