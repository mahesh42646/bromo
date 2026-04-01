import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = ViewProps & {
  variant?: 'background' | 'surface' | 'card';
};

export function ThemedView({style, variant = 'background', ...props}: Props) {
  const {palette} = useTheme();

  const bg =
    variant === 'background'
      ? palette.background
      : variant === 'surface'
        ? palette.surface
        : palette.glassFaint;

  return <View style={[{backgroundColor: bg}, style]} {...props} />;
}
