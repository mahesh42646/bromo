import React from 'react';
import {Modal, Pressable, Text, View} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function ThemedConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
}: Props) {
  const {palette} = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.overlay,
          paddingHorizontal: 24,
        }}>
        <View
          style={{
            width: '100%',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            padding: 16,
            gap: 10,
          }}>
          <Text
            style={{
              color: palette.foreground,
              fontSize: 17,
              fontWeight: '800',
            }}>
            {title}
          </Text>
          <Text
            style={{
              color: palette.foregroundMuted,
              fontSize: 14,
              lineHeight: 20,
            }}>
            {message}
          </Text>
          <Pressable
            onPress={onConfirm}
            style={{
              marginTop: 6,
              alignSelf: 'flex-end',
              minWidth: 96,
              alignItems: 'center',
              borderRadius: 10,
              backgroundColor: palette.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}>
            <Text style={{color: palette.primaryForeground, fontWeight: '800'}}>
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
