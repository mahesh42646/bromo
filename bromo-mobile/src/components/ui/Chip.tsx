import React from 'react';
import {Pressable, Text, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Pill (full rounded) vs rounded-rectangle budget chips */
  variant?: 'pill' | 'rect';
  /** Smaller padding / label for dense editor grids */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Single-select filter / toggle chip (theme-aware). Use for multi-option rows that are not full tab strips.
 */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  variant = 'pill',
  compact,
  style,
}: ChipProps) {
  const {palette} = useTheme();
  const pill = variant === 'pill';
  const paddingH = compact ? 12 : pill ? 14 : 16;
  const paddingV = compact ? 6 : pill ? 8 : 10;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: pill ? 999 : 10,
          backgroundColor: selected ? palette.primary : palette.input,
          borderWidth: 1,
          borderColor: selected ? palette.primary : palette.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}>
      <Text
        style={{
          color: selected ? palette.primaryForeground : palette.foreground,
          fontWeight: '700',
          fontSize: compact ? 12 : pill ? 13 : 14,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
