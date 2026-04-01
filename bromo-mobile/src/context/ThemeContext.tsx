import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useColorScheme} from 'react-native';
import {
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  defaultThemeContract,
  fetchThemeContractFromUrls,
  type RuntimeThemeContract,
  type ThemePalette,
} from '../config/platform-theme';
import {settings} from '../config/settings';

type ThemeContextValue = {
  contract: RuntimeThemeContract;
  palette: ThemePalette;
  isDark: boolean;
  toggleTheme: () => void;
  refresh: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  contract: defaultThemeContract,
  palette: FALLBACK_PALETTE_DARK,
  isDark: true,
  toggleTheme: () => {},
  refresh: async () => {},
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [contract, setContract] = useState<RuntimeThemeContract>(defaultThemeContract);
  const [manualDark, setManualDark] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const candidates = [
      settings.webThemeContractUrl,
      settings.apiBaseUrl,
      'https://bromo.darkunde.in',
      'https://bromo.darkunde.in:3001',
      'https://bromo.darkunde.in:3000/api/public/theme-contract',
      'https://bromo.darkunde.in/api/public/theme-contract',
    ];
    try {
      const c = await fetchThemeContractFromUrls(candidates);
      setContract(c);
    } catch {
      // Keep current contract (which defaults to defaultThemeContract with fallback palettes)
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, settings.themeRefreshMs);
    return () => clearInterval(id);
  }, [refresh]);

  const isDark = useMemo(() => {
    if (manualDark !== null) return manualDark;
    const def = contract.theme.defaultTheme;
    if (def === 'dark') return true;
    if (def === 'light') return false;
    return systemScheme === 'dark';
  }, [manualDark, contract.theme.defaultTheme, systemScheme]);

  // Use server-resolved palette if available, fall back to in-app constants
  const palette = useMemo(() => {
    const serverPalette = isDark ? contract.theme.dark : contract.theme.light;
    // Validate that the palette has the required tokens
    if (serverPalette?.background && serverPalette?.primary && serverPalette?.glass) {
      return serverPalette;
    }
    return isDark ? FALLBACK_PALETTE_DARK : FALLBACK_PALETTE_LIGHT;
  }, [isDark, contract.theme.dark, contract.theme.light]);

  const toggleTheme = useCallback(() => {
    setManualDark(prev => (prev === null ? !isDark : !prev));
  }, [isDark]);

  const value = useMemo(
    () => ({contract, palette, isDark, toggleTheme, refresh}),
    [contract, palette, isDark, toggleTheme, refresh],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
