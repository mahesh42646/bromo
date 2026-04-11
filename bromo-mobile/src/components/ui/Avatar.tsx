import React from 'react';
import {Image, View, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  uri?: string;
  size?: number;
  hasStory?: boolean;
  isOwn?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({uri, size = 56, hasStory = false, isOwn = false, style}: Props) {
  const {palette} = useTheme();
  const ringWidth = 2.5;
  const outerSize = size + ringWidth * 2 + 4;

  if (hasStory) {
    return (
      <View
        style={[
          {
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            padding: ringWidth,
          },
          style,
        ]}>
        <View
          style={{
            width: outerSize,
            height: outerSize,
            borderRadius: outerSize / 2,
            padding: ringWidth,
            // gradient ring via border trick
            borderWidth: ringWidth,
            borderColor: palette.accent,
          }}>
          <Image
            source={{uri: uri ?? `https://i.pravatar.cc/${size}`}}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: palette.background,
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <Image
        source={{uri: uri ?? `https://i.pravatar.cc/${size}`}}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: isOwn ? 0 : 2,
          borderColor: palette.border,
        }}
      />
    </View>
  );
}
