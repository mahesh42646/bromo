import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = ViewProps & {
  elevated?: boolean;
};

export function Card({style, elevated = false, ...props}: Props) {
  const {palette, contract, isDark} = useTheme();
  const {borderRadiusScale, surfaceStyle} = contract.brandGuidelines;

  const radius = borderRadiusScale === 'bold' ? 20 : borderRadiusScale === 'balanced' ? 14 : 8;

  const bg =
    surfaceStyle === 'glass'
      ? isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(0,0,0,0.03)'
      : surfaceStyle === 'elevated'
        ? isDark
          ? '#111'
          : '#f9f9f9'
        : palette.muted;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: palette.border,
          ...(elevated && {
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 4},
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }),
        },
        style,
      ]}
      {...props}
    />
  );
}
