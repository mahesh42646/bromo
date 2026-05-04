import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ThemePalette } from '../../theme/tokens';
import type { CreateMode } from '../../create/createTypes';

const MODE_OPTIONS: Array<{ id: CreateMode; label: string }> = [
  { id: 'story', label: 'Story' },
  { id: 'post', label: 'Post' },
  { id: 'reel', label: 'Reel' },
];

const FLOW_STEPS = ['Edit', 'Details'];

type ModeSegmentProps = {
  palette: ThemePalette;
  mode: CreateMode;
  onChange: (mode: CreateMode) => void;
  style?: StyleProp<ViewStyle>;
};

export function CreateModeSegment({
  palette,
  mode,
  onChange,
  style,
}: ModeSegmentProps) {
  return (
    <View
      style={[
        ui.modeWrap,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {MODE_OPTIONS.map(option => {
        const active = mode === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[
              ui.modeChip,
              {
                backgroundColor: active ? palette.accent : 'transparent',
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                ui.modeText,
                {
                  color: active
                    ? palette.accentForeground
                    : palette.foregroundMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type StudioProgressProps = {
  palette: ThemePalette;
  activeIndex: number;
  style?: StyleProp<ViewStyle>;
};

export function StudioProgress({
  palette,
  activeIndex,
  style,
}: StudioProgressProps) {
  return (
    <View style={[ui.progressWrap, style]}>
      {FLOW_STEPS.map((step, index) => {
        const active = index === activeIndex;
        const complete = index < activeIndex;
        return (
          <View key={step} style={ui.progressItem}>
            <View
              style={[
                ui.progressDot,
                {
                  backgroundColor:
                    active || complete ? palette.accent : palette.surfaceHigh,
                  borderColor: active ? palette.accent : palette.border,
                },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[
                ui.progressText,
                {
                  color: active ? palette.foreground : palette.foregroundSubtle,
                },
              ]}
            >
              {step}
            </Text>
            {index < FLOW_STEPS.length - 1 ? (
              <View
                style={[
                  ui.progressLine,
                  {
                    backgroundColor:
                      index < activeIndex
                        ? palette.accent
                        : palette.borderFaint,
                  },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

type StudioSectionProps = {
  palette: ThemePalette;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
};

export function StudioSection({
  palette,
  title,
  action,
  children,
  style,
  bodyStyle,
}: StudioSectionProps) {
  return (
    <View
      style={[
        ui.section,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <View style={[ui.sectionHeader, { borderBottomColor: palette.hairline }]}>
        <Text
          style={[ui.sectionTitle, { color: palette.foregroundMuted }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {action}
      </View>
      <View style={[ui.sectionBody, bodyStyle]}>{children}</View>
    </View>
  );
}

export const ui = StyleSheet.create({
  modeWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  modeChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  progressItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  progressText: {
    marginLeft: 7,
    fontSize: 11,
    fontWeight: '800',
  },
  progressLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 8,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionBody: {
    padding: 14,
  },
});
