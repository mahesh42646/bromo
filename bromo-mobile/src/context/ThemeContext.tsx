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
  buildPalette,
  defaultThemeContract,
  fetchThemeContractFromUrls,
  type RuntimeThemeContract,
  type ThemePalette,
} from '../config/platform-theme';
import {settings} from '../config/settings';
import {
  hasThemeContractFetchedThisSession,
  markThemeContractFetchedThisSession,
} from '../lib/sessionFlags';

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
  /** Pass `true` to bypass the one-fetch-per-session guard (e.g. dev menu). */
  refresh: (forceNetwork?: boolean) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  contract: defaultThemeContract,
  palette: buildPalette(
    'dark',
    defaultThemeContract.theme.accentHex,
    defaultThemeContract.theme.ringHex,
    defaultThemeContract.theme.mutedHex,
  ),
  isDark: true,
  toggleTheme: () => {},
  refresh: async (_force?: boolean) => {},
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

  const refresh = useCallback(async (forceNetwork = false) => {
    if (!forceNetwork && hasThemeContractFetchedThisSession()) return;
    const now = Date.now();
    if (!forceNetwork && now - lastFetchAt.current < settings.themeRefreshMs - 1000) return;
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
      markThemeContractFetchedThisSession();
    } catch {
      // keep cached / default
    }
  }, []);

  useEffect(() => {
    // Initial fetch (non-blocking — AsyncStorage cache already loaded above)
    refresh(false);
  }, [refresh]);

  const isDark = useMemo(() => {
    if (manualDark !== null) return manualDark;
    const def = contract.theme.defaultTheme;
    if (def === 'dark') return true;
    if (def === 'light') return false;
    return systemScheme === 'dark';
  }, [manualDark, contract.theme.defaultTheme, systemScheme]);

  // Always derive palette from mode + contract hex so light/dark pairs stay consistent (nested
  // palettes from cache/API can be stale or use a dark muted swatch in light mode).
  const palette = useMemo((): ThemePalette => {
    const t = contract.theme;
    const mode = isDark ? 'dark' : 'light';
    const layer = mode === 'dark' ? t.dark : t.light;
    const accentHex = t.accentHex ?? layer?.accent ?? (mode === 'dark' ? '#ff4d6d' : '#c0304f');
    const ringHex = t.ringHex ?? layer?.ring ?? accentHex;
    const mutedHex = t.mutedHex ?? layer?.muted ?? (mode === 'dark' ? '#2a2a2a' : '#e0e0e0');
    return buildPalette(mode, accentHex, ringHex, mutedHex);
  }, [isDark, contract.theme]);

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
