import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = ViewProps & {
  variant?: 'background' | 'surface' | 'card';
};

export function ThemedView({style, variant = 'background', ...props}: Props) {
  const {palette, contract} = useTheme();
  const {surfaceStyle} = contract.brandGuidelines;

  const bg =
    variant === 'background'
      ? palette.background
      : variant === 'surface'
        ? palette.muted
        : surfaceStyle === 'glass'
          ? 'rgba(255,255,255,0.04)'
          : palette.muted;

  return <View style={[{backgroundColor: bg}, style]} {...props} />;
}
