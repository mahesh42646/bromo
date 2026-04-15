import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {ExternalLink} from 'lucide-react-native';
import type {ThemePalette} from '../config/platform-theme';

type Props = {
  palette: ThemePalette;
  label: string;
  onPress: () => void;
  borderRadius: number;
  showExternalIcon?: boolean;
  compact?: boolean;
};

export function AdCtaGradientButton({
  palette,
  label,
  onPress,
  borderRadius,
  showExternalIcon,
  compact = false,
}: Props) {
  const gradId = useMemo(() => `adCta_${Math.random().toString(36).slice(2, 11)}`, []);
  const h = compact ? 44 : 50;
  const ringPad = 2;

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: borderRadius + ringPad,
        borderWidth: 2,
        borderColor: palette.ring,
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}>
      <View style={{height: h, borderRadius, overflow: 'hidden'}}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={palette.accent} />
              <Stop offset="50%" stopColor={palette.ring} />
              <Stop offset="100%" stopColor={palette.muted} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={borderRadius} ry={borderRadius} fill={`url(#${gradId})`} />
        </Svg>
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 20,
            },
          ]}>
          <Text
            style={{
              color: '#fff',
              fontSize: compact ? 14 : 15,
              fontWeight: '800',
              textShadowColor: 'rgba(0,0,0,0.4)',
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 3,
            }}
            numberOfLines={1}>
            {label}
          </Text>
          {showExternalIcon ? <ExternalLink size={16} color="#fff" /> : null}
        </View>
      </View>
    </Pressable>
  );
}
