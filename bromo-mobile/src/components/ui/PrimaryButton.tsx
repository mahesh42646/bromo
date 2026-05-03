import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'solid',
  size = 'md',
  style,
  fullWidth = false,
}: Props) {
  const {palette, guidelines} = useTheme();
  const {borderRadiusScale} = guidelines;

  const radius = borderRadiusScale === 'bold' ? 14 : borderRadiusScale === 'balanced' ? 10 : 6;
  const paddingV = size === 'lg' ? 14 : size === 'sm' ? 7 : 10;
  const paddingH = size === 'lg' ? 28 : size === 'sm' ? 14 : 20;
  const fontSize = size === 'lg' ? 14 : size === 'sm' ? 11 : 12;

  const bgColor =
    variant === 'solid'
      ? palette.primary
      : 'transparent';

  const borderColor =
    variant === 'outline' ? palette.primary : 'transparent';

  const textColor =
    variant === 'solid'
      ? palette.primaryForeground
      : palette.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        {
          backgroundColor: bgColor,
          borderRadius: radius,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || loading ? 0.5 : pressed ? 0.75 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text
          style={{
            color: textColor,
            fontSize,
            fontWeight: '800',
            letterSpacing: 0.3,
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
