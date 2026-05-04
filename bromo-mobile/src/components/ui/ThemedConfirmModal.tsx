import React from 'react';
import {Modal, Pressable, Text, View} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  /** When set, shows a secondary cancel control (two-step confirms). */
  cancelLabel?: string;
  onCancel?: () => void;
  /** Primary button uses destructive styling (e.g. Discard). */
  destructiveConfirm?: boolean;
};

export function ThemedConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
  cancelLabel = 'Cancel',
  onCancel,
  destructiveConfirm,
}: Props) {
  const {palette} = useTheme();
  const twoStep = Boolean(onCancel);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={twoStep ? () => onCancel?.() : onConfirm}>
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
          <View
            style={{
              marginTop: 6,
              flexDirection: 'row',
              justifyContent: twoStep ? 'space-between' : 'flex-end',
              gap: 10,
            }}>
            {twoStep ? (
              <Pressable
                onPress={onCancel}
                style={{
                  minWidth: 96,
                  alignItems: 'center',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: palette.border,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}>
                <Text style={{color: palette.foreground, fontWeight: '800'}}>
                  {cancelLabel}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onConfirm}
              style={{
                minWidth: 96,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: destructiveConfirm
                  ? palette.destructive
                  : palette.primary,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}>
              <Text
                style={{
                  color: destructiveConfirm
                    ? palette.destructiveForeground ?? '#fff'
                    : palette.primaryForeground,
                  fontWeight: '800',
                }}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
