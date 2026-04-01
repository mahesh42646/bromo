import React from 'react';
import {View, type ViewProps} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = ViewProps & {
  elevated?: boolean;
};

export function Card({style, elevated = false, ...props}: Props) {
  const {palette, contract} = useTheme();
  const {borderRadiusScale, surfaceStyle} = contract.brandGuidelines;

  const radius = borderRadiusScale === 'bold' ? 20 : borderRadiusScale === 'balanced' ? 14 : 8;

  const bg =
    surfaceStyle === 'glass'
      ? palette.glass
      : surfaceStyle === 'elevated'
        ? palette.surfaceHigh
        : palette.surface;

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
