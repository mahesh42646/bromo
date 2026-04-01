import React from 'react';
import {Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Variant = 'primary' | 'gold' | 'blue' | 'green' | 'muted';

type Props = {
  label: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

const variantColors: Record<Variant, {bg: string; text: string}> = {
  primary: {bg: '#7c3aed', text: '#fff'},
  gold: {bg: '#ffd700', text: '#000'},
  blue: {bg: '#3b82f6', text: '#fff'},
  green: {bg: '#10b981', text: '#000'},
  muted: {bg: '#222', text: '#888'},
};

export function Badge({label, variant = 'primary', style}: Props) {
  const {contract} = useTheme();
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 10 : borderRadiusScale === 'balanced' ? 6 : 4;
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
