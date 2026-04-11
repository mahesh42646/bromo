import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  defaultThemeContract,
  fetchThemeContractFromUrls,
  type RuntimeThemeContract,
  type ThemePalette,
} from '../config/platform-theme';
import {settings} from '../config/settings';

const THEME_CACHE_KEY = '@bromo/theme_contract_v2';
const THEME_CACHE_TTL = 5 * 60 * 1000; // 5 min — stale-while-revalidate

async function loadCachedContract(): Promise<RuntimeThemeContract | null> {
  try {
    const raw = await AsyncStorage.getItem(THEME_CACHE_KEY);
    if (!raw) return null;
    const {contract, savedAt} = JSON.parse(raw) as {contract: RuntimeThemeContract; savedAt: number};
    if (Date.now() - savedAt > THEME_CACHE_TTL * 10) return null; // hard-expire after 50 min
    return contract;
  } catch {
    return null;
  }
}

async function saveContractCache(contract: RuntimeThemeContract): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_CACHE_KEY, JSON.stringify({contract, savedAt: Date.now()}));
  } catch {}
}

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
  const lastFetchAt = useRef(0);

  // Load cache instantly on mount, then fetch in background
  useEffect(() => {
    loadCachedContract().then(cached => {
      if (cached) setContract(cached);
    });
  }, []);

  const refresh = useCallback(async () => {
    const now = Date.now();
    // Debounce: don't refetch more often than themeRefreshMs even if called directly
    if (now - lastFetchAt.current < settings.themeRefreshMs - 1000) return;
    lastFetchAt.current = now;
    const candidates = [
      settings.webThemeContractUrl,
      settings.apiBaseUrl,
      'https://bromo.darkunde.in',
    ].filter(Boolean);
    try {
      const c = await fetchThemeContractFromUrls(candidates);
      setContract(c);
      saveContractCache(c);
    } catch {
      // keep cached / default
    }
  }, []);

  useEffect(() => {
    // Initial fetch (non-blocking — cache already loaded above)
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(refresh, settings.themeRefreshMs);
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
    if (serverPalette?.background && serverPalette?.accent && serverPalette?.glass) {
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
