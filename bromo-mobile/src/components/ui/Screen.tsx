import React from 'react';
import type {Edge} from 'react-native-safe-area-context';
import {
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ThemedSafeScreen} from './ThemedSafeScreen';
import {ScreenHeader, type ScreenHeaderProps} from './ScreenHeader';
import {RefreshableScrollView} from './RefreshableScrollView';

export type ScreenProps = {
  children: React.ReactNode;
  /** Tab roots: no header chrome; use BrandHeader inside children if needed. */
  bare?: boolean;
  title?: string;
  showBack?: boolean;
  onBackPress?: ScreenHeaderProps['onBackPress'];
  right?: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard screen: safe area + optional ScreenHeader + scroll or plain body.
 */
export function Screen({
  children,
  bare,
  title,
  showBack = true,
  onBackPress,
  right,
  scroll = false,
  contentContainerStyle,
  onRefresh,
  refreshing,
  edges,
  style,
}: ScreenProps) {
  const header =
    bare ? null : (
      <ScreenHeader title={title} showBack={showBack} onBackPress={onBackPress} right={right} />
    );

  let body: React.ReactNode;
  if (scroll) {
    body = onRefresh ? (
      <RefreshableScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        style={{flex: 1}}
        contentContainerStyle={[{paddingBottom: 24}, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </RefreshableScrollView>
    ) : (
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={[{paddingBottom: 24}, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={[{flex: 1}, style]}>{children}</View>;
  }

  return (
    <ThemedSafeScreen edges={edges}>
      {header}
      {body}
    </ThemedSafeScreen>
  );
}
