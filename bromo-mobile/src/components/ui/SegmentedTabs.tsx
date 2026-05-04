import React from 'react';
import {Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

export type SegmentedTabItem<T extends string | number> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

export type SegmentedTabsProps<T extends string | number> = {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  tone?: 'default' | 'onDark';
  /** Max height of the row (chips row cap). */
  rowMaxHeight?: number;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedTabs<T extends string | number>({
  items,
  value,
  onChange,
  variant = 'pill',
  tone = 'default',
  rowMaxHeight = 54,
  style,
}: SegmentedTabsProps<T>) {
  const {palette} = useTheme();
  const onDark = tone === 'onDark';

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
                    color: onDark
                      ? active ? '#fff' : 'rgba(255,255,255,0.62)'
                      : active ? palette.foreground : palette.foregroundMuted,
                    opacity: 1,
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
                    backgroundColor: active ? (onDark ? palette.accent : palette.primary) : 'transparent',
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
