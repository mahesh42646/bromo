import React, {useMemo} from 'react';
import {Image, View, type StyleProp, type ViewStyle} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import Video from 'react-native-video';
import {useTheme} from '../../context/ThemeContext';

function isPlayableVideoThumb(uri: string): boolean {
  return /\.m3u8(\?|$)/i.test(uri) || /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(uri);
}

type Props = {
  uri?: string;
  size?: number;
  /** When true: flat gray ring (all stories in tray viewed). When false: accent→ring gradient. */
  seen?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StoryRing({uri, size = 64, seen = false, style}: Props) {
  const {palette} = useTheme();
  const ringPad = 2.5;
  const borderW = 2;
  const strokeW = 2.8;
  const outerSize = size + ringPad * 2 + borderW * 2;
  const cx = outerSize / 2;
  const cy = outerSize / 2;
  const r = outerSize / 2 - strokeW / 2 - ringPad * 0.15;
  const gradId = useMemo(() => `storyRingGrad_${Math.random().toString(36).slice(2, 11)}`, []);
  const resolved = uri ?? `https://i.pravatar.cc/${size}`;
  const innerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: borderW,
    borderColor: palette.background,
  };

  return (
    <View
      style={[
        {
          width: outerSize,
          height: outerSize,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}>
      {seen ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            borderWidth: strokeW,
            borderColor: palette.borderMid,
          }}
        />
      ) : (
        <Svg
          pointerEvents="none"
          width={outerSize}
          height={outerSize}
          style={{position: 'absolute', top: 0, left: 0}}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={palette.accent} />
              <Stop offset="100%" stopColor={palette.ring} />
            </LinearGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={r} stroke={`url(#${gradId})`} strokeWidth={strokeW} fill="none" />
        </Svg>
      )}
      {isPlayableVideoThumb(resolved) ? (
        <Video
          source={{uri: resolved}}
          style={innerStyle}
          resizeMode="cover"
          paused
          muted
          repeat={false}
          ignoreSilentSwitch="ignore"
          disableFocus
          playInBackground={false}
        />
      ) : (
        <Image source={{uri: resolved}} style={innerStyle} />
      )}
    </View>
  );
}
