export type AppearanceMode = 'light' | 'dark' | 'system';

export type ThemePalette = {
  background: string;
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  foregroundFaint: string;
  placeholder: string;
  surface: string;
  surfaceHigh: string;
  card: string;
  glass: string;
  glassMid: string;
  glassFaint: string;
  border: string;
  hairline: string;
  borderFaint: string;
  borderMid: string;
  borderHeavy: string;
  input: string;
  inputFocused: string;
  overlay: string;
  accent: string;
  accentForeground: string;
  ring: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  primary: string;
  primaryForeground: string;
};

export type ThemeGuidelines = {
  personality: 'neutral' | 'premium' | 'playful' | 'minimal';
  iconStyle: 'rounded' | 'sharp' | 'duotone';
  borderRadiusScale: 'soft' | 'balanced' | 'bold';
  surfaceStyle: 'flat' | 'glass' | 'elevated';
  contentDensity: 'comfortable' | 'compact';
  motionIntensity: 'none' | 'subtle' | 'expressive';
  headingCase: 'sentence' | 'title' | 'uppercase';
  gradientStyle: 'none' | 'subtle' | 'vibrant';
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const spacing = {
  px: 1,
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
} as const;

export const DARK_THEME_PALETTE: ThemePalette = {
  background: '#000000',
  foreground: '#ffffff',
  foregroundMuted: 'rgba(255,255,255,0.55)',
  foregroundSubtle: 'rgba(255,255,255,0.38)',
  foregroundFaint: 'rgba(255,255,255,0.25)',
  placeholder: 'rgba(255,255,255,0.30)',
  surface: '#111111',
  surfaceHigh: '#1c1c1c',
  card: '#161616',
  glass: 'rgba(255,255,255,0.06)',
  glassMid: 'rgba(255,255,255,0.08)',
  glassFaint: 'rgba(255,255,255,0.04)',
  border: '#2a2a2a',
  hairline: 'rgba(255,255,255,0.08)',
  borderFaint: 'rgba(255,255,255,0.10)',
  borderMid: 'rgba(255,255,255,0.12)',
  borderHeavy: 'rgba(255,255,255,0.18)',
  input: 'rgba(255,255,255,0.06)',
  inputFocused: 'rgba(255,255,255,0.08)',
  overlay: 'rgba(0,0,0,0.75)',
  accent: '#ff4d6d',
  accentForeground: '#ffffff',
  ring: '#ff4d6d',
  muted: '#2a2a2a',
  mutedForeground: '#ffffff',
  destructive: '#f87171',
  destructiveForeground: '#000000',
  success: '#4ade80',
  successForeground: '#000000',
  warning: '#fbbf24',
  warningForeground: '#000000',
  primary: '#ff4d6d',
  primaryForeground: '#ffffff',
};

export const LIGHT_THEME_PALETTE: ThemePalette = {
  background: '#ffffff',
  foreground: '#000000',
  foregroundMuted: 'rgba(0,0,0,0.55)',
  foregroundSubtle: 'rgba(0,0,0,0.38)',
  foregroundFaint: 'rgba(0,0,0,0.25)',
  placeholder: 'rgba(0,0,0,0.35)',
  surface: '#f5f5f5',
  surfaceHigh: '#ebebeb',
  card: '#fafafa',
  glass: 'rgba(0,0,0,0.04)',
  glassMid: 'rgba(0,0,0,0.06)',
  glassFaint: 'rgba(0,0,0,0.02)',
  border: '#e0e0e0',
  hairline: 'rgba(0,0,0,0.07)',
  borderFaint: 'rgba(0,0,0,0.08)',
  borderMid: 'rgba(0,0,0,0.10)',
  borderHeavy: 'rgba(0,0,0,0.15)',
  input: 'rgba(0,0,0,0.04)',
  inputFocused: 'rgba(0,0,0,0.06)',
  overlay: 'rgba(0,0,0,0.50)',
  accent: '#c0304f',
  accentForeground: '#ffffff',
  ring: '#c0304f',
  muted: '#f0f0f0',
  mutedForeground: '#000000',
  destructive: '#dc2626',
  destructiveForeground: '#ffffff',
  success: '#16a34a',
  successForeground: '#ffffff',
  warning: '#d97706',
  warningForeground: '#ffffff',
  primary: '#c0304f',
  primaryForeground: '#ffffff',
};

export const THEME_PALETTES: Record<'light' | 'dark', ThemePalette> = {
  light: LIGHT_THEME_PALETTE,
  dark: DARK_THEME_PALETTE,
};

export const themeGuidelines: ThemeGuidelines = {
  personality: 'premium',
  iconStyle: 'rounded',
  borderRadiusScale: 'bold',
  surfaceStyle: 'glass',
  contentDensity: 'compact',
  motionIntensity: 'subtle',
  headingCase: 'uppercase',
  gradientStyle: 'vibrant',
};

export const themeFontFamily = 'system-ui';
