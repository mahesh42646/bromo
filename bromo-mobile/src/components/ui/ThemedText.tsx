import React from 'react';
import {Text, type TextProps} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Variant = 'body' | 'caption' | 'label' | 'heading' | 'muted' | 'primary' | 'accent';

type Props = TextProps & {
  variant?: Variant;
};

const sizeMap: Record<Variant, number> = {
  heading: 18,
  body: 13,
  label: 11,
  caption: 10,
  muted: 11,
  primary: 13,
  accent: 12,
};

const weightMap: Record<Variant, '400' | '600' | '700' | '800' | '900'> = {
  heading: '900',
  body: '400',
  label: '700',
  caption: '400',
  muted: '400',
  primary: '800',
  accent: '700',
};

export function ThemedText({style, variant = 'body', ...props}: Props) {
  const {palette, guidelines, fontFamily} = useTheme();
  const {headingCase} = guidelines;

  const colorMap: Record<Variant, string> = {
    heading: palette.foreground,
    body: palette.foreground,
    label: palette.foreground,
    caption: palette.mutedForeground,
    muted: palette.mutedForeground,
    primary: palette.primary,
    accent: palette.primary,
  };

  const textTransform =
    variant === 'heading'
      ? headingCase === 'uppercase'
        ? 'uppercase'
        : headingCase === 'title'
          ? 'capitalize'
          : 'none'
      : undefined;

  return (
    <Text
      style={[
        {
          color: colorMap[variant],
          fontSize: sizeMap[variant],
          fontWeight: weightMap[variant],
          textTransform,
          fontFamily: fontFamily !== 'system-ui' ? fontFamily : undefined,
        },
        style,
      ]}
      {...props}
    />
  );
}
