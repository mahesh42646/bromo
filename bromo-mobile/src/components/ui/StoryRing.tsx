import React from 'react';
import {Image, View, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  uri?: string;
  size?: number;
  seen?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StoryRing({uri, size = 64, seen = false, style}: Props) {
  const {palette} = useTheme();
  const ringPad = 2.5;
  const borderW = 2;
  const outerSize = size + ringPad * 2 + borderW * 2;

  return (
    <View
      style={[
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          padding: ringPad,
          borderWidth: ringPad,
          borderColor: seen ? palette.border : palette.accent,
          backgroundColor: seen ? 'transparent' : undefined,
        },
        style,
      ]}>
      <Image
        source={{uri: uri ?? `https://i.pravatar.cc/${size}`}}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: borderW,
          borderColor: palette.background,
        }}
      />
    </View>
  );
}
