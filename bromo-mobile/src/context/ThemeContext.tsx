import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {appBranding} from '../config/settings';
import {
  DARK_THEME_PALETTE,
  LIGHT_THEME_PALETTE,
  type AppearanceMode,
  type ThemeGuidelines,
  type ThemePalette,
  themeFontFamily,
  themeGuidelines,
} from '../theme/tokens';

const APPEARANCE_KEY = '@bromo/appearance';

type ThemeContextValue = {
  palette: ThemePalette;
  isDark: boolean;
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
  toggleTheme: (nextDark?: boolean) => void;
  branding: typeof appBranding;
  guidelines: ThemeGuidelines;
  fontFamily: string;
};

const ThemeContext = createContext<ThemeContextValue>({
  palette: DARK_THEME_PALETTE,
  isDark: true,
  appearance: 'system',
  setAppearance: () => {},
  toggleTheme: () => {},
  branding: appBranding,
  guidelines: themeGuidelines,
  fontFamily: themeFontFamily,
});

function normalizeAppearance(value: string | null): AppearanceMode {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then(value => {
        if (mounted) {
          setAppearanceState(normalizeAppearance(value));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceState(mode);
    AsyncStorage.setItem(APPEARANCE_KEY, mode).catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (appearance === 'dark') return true;
    if (appearance === 'light') return false;
    return systemScheme === 'dark';
  }, [appearance, systemScheme]);

  const palette = isDark ? DARK_THEME_PALETTE : LIGHT_THEME_PALETTE;

  const toggleTheme = useCallback(
    (nextDark?: boolean) => {
      const dark = typeof nextDark === 'boolean' ? nextDark : !isDark;
      setAppearance(dark ? 'dark' : 'light');
    },
    [isDark, setAppearance],
  );

  const value = useMemo(
    () => ({
      palette,
      isDark,
      appearance,
      setAppearance,
      toggleTheme,
      branding: appBranding,
      guidelines: themeGuidelines,
      fontFamily: themeFontFamily,
    }),
    [appearance, isDark, palette, setAppearance, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
