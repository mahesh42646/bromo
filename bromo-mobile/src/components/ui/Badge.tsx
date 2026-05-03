import React from 'react';
import {Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Variant = 'primary' | 'gold' | 'blue' | 'green' | 'muted';

type Props = {
  label: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

export function Badge({label, variant = 'primary', style}: Props) {
  const {palette, guidelines} = useTheme();
  const {borderRadiusScale} = guidelines;
  const radius = borderRadiusScale === 'bold' ? 10 : borderRadiusScale === 'balanced' ? 6 : 4;

  const variantColors: Record<Variant, {bg: string; text: string}> = {
    primary: {bg: palette.accent, text: palette.accentForeground},
    gold: {bg: palette.warning, text: palette.warningForeground},
    blue: {bg: palette.accent, text: palette.accentForeground},
    green: {bg: palette.success, text: palette.successForeground},
    muted: {bg: palette.muted, text: palette.mutedForeground},
  };

  const {bg, text} = variantColors[variant];

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius,
          paddingHorizontal: 8,
          paddingVertical: 3,
          alignSelf: 'flex-start',
        },
        style,
      ]}>
      <Text style={{color: text, fontSize: 9, fontWeight: '900', letterSpacing: 0.5}}>
        {label}
      </Text>
    </View>
  );
}
