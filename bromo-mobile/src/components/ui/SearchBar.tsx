import React from 'react';
import {TextInput, View, type StyleProp, type ViewStyle} from 'react-native';
import {Search} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'search' | 'default' | 'go';
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  style,
  autoFocus,
  onSubmitEditing,
  returnKeyType = 'search',
}: Props) {
  const {palette, contract} = useTheme();
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 999 : borderRadiusScale === 'balanced' ? 12 : 8;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.input,
          borderRadius: radius,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: palette.border,
          gap: 8,
        },
        style,
      ]}>
      <Search size={14} color={palette.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedForeground}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={{
          flex: 1,
          color: palette.foreground,
          fontSize: 13,
          padding: 0,
        }}
      />
    </View>
  );
}
