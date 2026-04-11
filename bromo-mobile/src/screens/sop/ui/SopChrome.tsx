import React from 'react';
import {Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import {ThemedSafeScreen} from '../../../components/ui/ThemedSafeScreen';

export function SopChrome({
  title,
  children,
  scroll = true,
  contentStyle,
}: {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const navigation = useNavigation();
  const {palette, isDark} = useTheme();

  const body = scroll ? (
    <ScrollView contentContainerStyle={[{padding: 16, paddingBottom: 48}, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[{flex: 1, padding: 16}, contentStyle]}>{children}</View>
  );

  return (
    <ThemedSafeScreen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          backgroundColor: palette.background,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={24} color={palette.foreground} />
        </Pressable>
        <Text
          style={{flex: 1, textAlign: 'center', color: palette.foreground, fontSize: 16, fontWeight: '800'}}
          numberOfLines={1}>
          {title}
        </Text>
        <View style={{width: 40}} />
      </View>
      {body}
    </ThemedSafeScreen>
  );
}

export function SopMeta({label}: {label: string}) {
  const {palette} = useTheme();
  return (
    <Text style={{color: palette.mutedForeground, fontSize: 13, lineHeight: 20, marginBottom: 12}}>{label}</Text>
  );
}

export function SopRow({
  title,
  sub,
  onPress,
}: {
  title: string;
  sub?: string;
  onPress?: () => void;
}) {
  const {palette, contract} = useTheme();
  const r = contract.brandGuidelines.borderRadiusScale === 'bold' ? 14 : 10;
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 14,
        borderRadius: r,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.input,
        marginBottom: 10,
        gap: 4,
      }}>
      <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>{title}</Text>
      {sub ? <Text style={{color: palette.mutedForeground, fontSize: 12}}>{sub}</Text> : null}
    </Pressable>
  );
}
