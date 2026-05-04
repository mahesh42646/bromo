import React from 'react';
import {Pressable, ScrollView, Text, View, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

export type SegmentedTabItem<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

export type SegmentedTabsProps<T extends string> = {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  /** Max height of the row (chips row cap). */
  rowMaxHeight?: number;
  style?: ViewStyle;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'pill',
  rowMaxHeight = 54,
  style,
}: SegmentedTabsProps<T>) {
  const {palette, guidelines} = useTheme();
  const chipRadius = guidelines.borderRadiusScale === 'bold' ? 14 : 10;

  if (variant === 'underline') {
    return (
      <View style={[{maxHeight: rowMaxHeight, flexDirection: 'row', alignItems: 'center'}, style]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 4, gap: 20, alignItems: 'center'}}>
          {items.map(item => {
            const active = item.value === value;
            return (
              <Pressable
                key={String(item.value)}
                onPress={() => onChange(item.value)}
                style={{paddingVertical: 8, alignItems: 'center', flexDirection: 'row', gap: 6}}>
                {item.icon}
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: active ? '800' : '500',
                    color: active ? palette.foreground : palette.foregroundMuted,
                    opacity: active ? 1 : 0.55,
                  }}>
                  {item.label}
                </Text>
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: active ? palette.primary : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[{maxHeight: rowMaxHeight}, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center'}}>
        {items.map(item => {
          const active = item.value === value;
          return (
            <Pressable
              key={String(item.value)}
              onPress={() => onChange(item.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? palette.primary : palette.border,
                backgroundColor: active ? palette.primary : palette.background,
              }}>
              {item.icon}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: active ? palette.primaryForeground : palette.foregroundMuted,
                }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
