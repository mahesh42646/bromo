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
  palette: defaultThemeContract.theme.dark,
  isDark: true,
  toggleTheme: () => {},
  refresh: async () => {},
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [contract, setContract] = useState<RuntimeThemeContract>(defaultThemeContract);
  const [manualDark, setManualDark] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    // Order matters: explicit settings first, then common local fallbacks.
    const candidates = [
      settings.webThemeContractUrl,
      settings.apiBaseUrl,
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3000/api/public/theme-contract',
      'http://127.0.0.1:3000/api/public/theme-contract',
    ];
    const c = await fetchThemeContractFromUrls(candidates);
    setContract(c);
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

  const palette = isDark ? contract.theme.dark : contract.theme.light;

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
