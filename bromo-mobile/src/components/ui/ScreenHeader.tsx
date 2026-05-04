import React from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../../context/ThemeContext';

const HEADER_HEIGHT = 48;

export type ScreenHeaderProps = {
  title?: string;
  /** When false, left slot stays empty (use with equal-width spacer). */
  showBack?: boolean;
  onBackPress?: () => void;
  /** Right-side actions (icons, buttons). */
  right?: React.ReactNode;
  /** Extra style on the outer row. */
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  title,
  showBack = true,
  onBackPress,
  right,
  style,
}: ScreenHeaderProps) {
  const navigation = useNavigation();
  const {palette} = useTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          height: HEADER_HEIGHT,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          backgroundColor: palette.background,
        },
        style,
      ]}>
      <View style={{width: 40, alignItems: 'flex-start'}}>
        {showBack ? (
          <Pressable onPress={handleBack} hitSlop={12} style={{padding: 8}} accessibilityRole="button" accessibilityLabel="Go back">
            <ChevronLeft size={24} color={palette.foreground} />
          </Pressable>
        ) : null}
      </View>
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          color: palette.foreground,
          fontSize: 16,
          fontWeight: '800',
        }}
        numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={{minWidth: 40, alignItems: 'flex-end', justifyContent: 'center'}}>
        {right}
      </View>
    </View>
  );
}

export const SCREEN_HEADER_HEIGHT = HEADER_HEIGHT;
