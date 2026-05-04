import React from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../../context/ThemeContext';

export type ActionSheetOption = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export type ActionSheetProps = {
  visible: boolean;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
  onCancel: () => void;
};

/**
 * Themed bottom action sheet (replacement for many Alert.alert menus).
 */
export function ActionSheet({
  visible,
  title,
  message,
  options,
  cancelLabel = 'Cancel',
  onCancel,
}: ActionSheetProps) {
  const {palette, guidelines} = useTheme();
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();
  const r = guidelines.borderRadiusScale === 'bold' ? 16 : 12;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: palette.overlay,
          justifyContent: 'flex-end',
        }}
        onPress={onCancel}>
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{
            marginHorizontal: 12,
            marginBottom: Math.max(insets.bottom, 12),
            maxHeight: height * 0.55,
            borderRadius: r,
            overflow: 'hidden',
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.border,
          }}>
          {title ? (
            <Text style={{paddingHorizontal: 16, paddingTop: 14, fontSize: 13, fontWeight: '700', color: palette.foregroundMuted}}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text style={{paddingHorizontal: 16, paddingTop: title ? 6 : 14, paddingBottom: 8, fontSize: 14, color: palette.foregroundMuted}}>
              {message}
            </Text>
          ) : null}
          {options.map((opt, i) => (
            <Pressable
              key={`${opt.label}-${i}`}
              onPress={() => {
                onCancel();
                setTimeout(() => opt.onPress(), 0);
              }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderTopWidth: i > 0 || title || message ? 1 : 0,
                borderTopColor: palette.border,
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                  color: opt.destructive ? palette.destructive : palette.foreground,
                }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onCancel}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderTopWidth: 1,
              borderTopColor: palette.border,
              backgroundColor: palette.surface,
            }}>
            <Text style={{fontSize: 16, fontWeight: '700', textAlign: 'center', color: palette.foreground}}>{cancelLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
