import React from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {View} from 'react-native';
import {useSafeAreaInsets, type Edge} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  children: React.ReactNode;
  /** Omit 'bottom' on main tab screens when the tab bar owns the home-indicator inset. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
};

/**
 * Applies system safe-area insets as padding on a flex root View.
 * More reliable than SafeAreaView inside native-stack modals (e.g. Create flow).
 */
export function ThemedSafeScreen({
  children,
  edges = ['top', 'left', 'right', 'bottom'],
  style,
}: Props) {
  const {palette} = useTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  return (
    <View style={[{flex: 1, backgroundColor: palette.background}, pad, style]}>
      {children}
    </View>
  );
}
