export const colors = {
  light: {
    background: '#ffffff',
    foreground: '#0a0a0a',
    muted: '#737373',
    border: '#e5e5e5',
    accent: '#171717',
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#fafafa',
    muted: '#a3a3a3',
    border: '#262626',
    accent: '#e5e5e5',
  },
} as const;

export type ColorScheme = keyof typeof colors;
