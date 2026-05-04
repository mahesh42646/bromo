import React, {useEffect, useRef} from 'react';
import {Animated, Text, View} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

export type CoinEarnToastProps = {
  visible: boolean;
  amount: number;
  label?: string;
  onHide?: () => void;
  durationMs?: number;
};

/**
 * Floating "+N coin" toast for reel rewards and posting milestones.
 */
export function CoinEarnToast({
  visible,
  amount,
  label = 'Bromo coins',
  onHide,
  durationMs = 2200,
}: CoinEarnToastProps) {
  const {palette} = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (!visible || amount <= 0) return;
    Animated.parallel([
      Animated.timing(opacity, {toValue: 1, duration: 180, useNativeDriver: true}),
      Animated.spring(translateY, {toValue: 0, useNativeDriver: true, friction: 8}),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {toValue: 0, duration: 220, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: -8, duration: 220, useNativeDriver: true}),
      ]).start(({finished}) => {
        if (finished) onHide?.();
      });
    }, durationMs);
    return () => clearTimeout(t);
  }, [visible, amount, opacity, translateY, durationMs, onHide]);

  if (!visible || amount <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 52,
        alignSelf: 'center',
        zIndex: 9999,
        opacity,
        transform: [{translateY}],
      }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        }}>
        <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>
          +{amount} {label}
        </Text>
      </View>
    </Animated.View>
  );
}
