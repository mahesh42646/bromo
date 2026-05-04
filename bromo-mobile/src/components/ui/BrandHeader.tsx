import React from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';
import {SCREEN_HEADER_HEIGHT} from './ScreenHeader';

/**
 * Top bar for tab roots: no back button, full-width content (logo + actions).
 * Height matches ScreenHeader for visual consistency.
 */
export function BrandHeader({
  left,
  right,
  style,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const {palette} = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: SCREEN_HEADER_HEIGHT,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          backgroundColor: palette.background,
        },
        style,
      ]}>
      <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0}}>{left}</View>
      {right != null ? (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>{right}</View>
      ) : null}
    </View>
  );
}
