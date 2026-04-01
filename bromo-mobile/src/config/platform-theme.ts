// ── Accent color catalog — 24 curated colors ──────────────────────
// dark:   vibrant hex, high contrast on #000000 backgrounds
// medium: balanced mid-range
// light:  deep/rich hex, high contrast on #ffffff backgrounds

export type AccentShade = 'dark' | 'medium' | 'light';

export type AccentColor = {
  id: string;
  name: string;
  dark: string;
  medium: string;
  light: string;
};

export const ACCENT_COLORS: AccentColor[] = [
  {id: 'bromoRed',  name: 'Bromo Red',  dark: '#ff4d6d', medium: '#e94560', light: '#c0304f'},
  {id: 'crimson',   name: 'Crimson',    dark: '#ff6b6b', medium: '#ef4444', light: '#b91c1c'},
  {id: 'orange',    name: 'Orange',     dark: '#ff8c42', medium: '#f97316', light: '#c2410c'},
  {id: 'amber',     name: 'Amber',      dark: '#ffbe5c', medium: '#f59e0b', light: '#92400e'},
  {id: 'yellow',    name: 'Yellow',     dark: '#ffe566', medium: '#eab308', light: '#854d0e'},
  {id: 'lime',      name: 'Lime',       dark: '#b6f03e', medium: '#84cc16', light: '#3f6212'},
  {id: 'green',     name: 'Green',      dark: '#4ade80', medium: '#22c55e', light: '#166534'},
  {id: 'emerald',   name: 'Emerald',    dark: '#34d399', medium: '#10b981', light: '#065f46'},
  {id: 'teal',      name: 'Teal',       dark: '#2dd4bf', medium: '#14b8a6', light: '#0f766e'},
  {id: 'cyan',      name: 'Cyan',       dark: '#22d3ee', medium: '#06b6d4', light: '#0e7490'},
  {id: 'sky',       name: 'Sky',        dark: '#38bdf8', medium: '#0ea5e9', light: '#075985'},
  {id: 'blue',      name: 'Blue',       dark: '#60a5fa', medium: '#3b82f6', light: '#1e40af'},
  {id: 'indigo',    name: 'Indigo',     dark: '#818cf8', medium: '#6366f1', light: '#3730a3'},
  {id: 'violet',    name: 'Violet',     dark: '#a78bfa', medium: '#8b5cf6', light: '#5b21b6'},
  {id: 'purple',    name: 'Purple',     dark: '#c084fc', medium: '#a855f7', light: '#6b21a8'},
  {id: 'fuchsia',   name: 'Fuchsia',    dark: '#e879f9', medium: '#d946ef', light: '#86198f'},
  {id: 'pink',      name: 'Pink',       dark: '#f472b6', medium: '#ec4899', light: '#9d174d'},
  {id: 'rose',      name: 'Rose',       dark: '#fb7185', medium: '#f43f5e', light: '#9f1239'},
  {id: 'coral',     name: 'Coral',      dark: '#ff7f7f', medium: '#ff6b6b', light: '#c0392b'},
  {id: 'gold',      name: 'Gold',       dark: '#ffd700', medium: '#ca8a04', light: '#78350f'},
  {id: 'copper',    name: 'Copper',     dark: '#fb923c', medium: '#d97706', light: '#7c2d12'},
  {id: 'slate',     name: 'Slate',      dark: '#94a3b8', medium: '#64748b', light: '#1e293b'},
  {id: 'lavender',  name: 'Lavender',   dark: '#c4b5fd', medium: '#7c3aed', light: '#4c1d95'},
  {id: 'jade',      name: 'Jade',       dark: '#52d9a0', medium: '#059669', light: '#064e3b'},
];

// Fixed backgrounds — never configurable
export const DARK_BG  = '#000000';
export const LIGHT_BG = '#ffffff';

// ── Palette type — every UI token lives here ───────────────────────

export type ThemePalette = {
  // Core
  background: string;
  foreground: string;
  foregroundMuted: string;    // ~55% opacity
  foregroundSubtle: string;   // ~38% opacity
  foregroundFaint: string;    // ~25% opacity
  placeholder: string;        // input placeholder ~30% opacity

  // Surfaces
  surface: string;
  surfaceHigh: string;
  card: string;

  // Alpha/glass surfaces
  glass: string;        // standard glass bg
  glassMid: string;     // slightly heavier glass
  glassFaint: string;   // lighter glass

  // Borders & hairlines
  border: string;
  hairline: string;
  borderFaint: string;
  borderMid: string;
  borderHeavy: string;

  // Inputs
  input: string;
  inputFocused: string;

  // Ring & primary accent
  ring: string;
  primary: string;
  primaryForeground: string;

  // Overlay (modals, drawers)
  overlay: string;

  // Semantic
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  destructive: string;
  destructiveForeground: string;

  // Legacy aliases (used by older components)
  muted: string;
  mutedForeground: string;
};

export type RuntimeThemeContract = {
  branding: {
    platformName: string;
    adminTitle: string;
    appTitle: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  theme: {
    defaultTheme: 'light' | 'dark' | 'system';
    fontFamily: string;
    accentColorId: string;
    accentShade: AccentShade;
    light: ThemePalette;
    dark: ThemePalette;
  };
  brandGuidelines: {
    personality: 'neutral' | 'premium' | 'playful' | 'minimal';
    iconStyle: 'rounded' | 'sharp' | 'duotone';
    borderRadiusScale: 'soft' | 'balanced' | 'bold';
    surfaceStyle: 'flat' | 'glass' | 'elevated';
    contentDensity: 'comfortable' | 'compact';
    motionIntensity: 'none' | 'subtle' | 'expressive';
    headingCase: 'sentence' | 'title' | 'uppercase';
    gradientStyle: 'none' | 'subtle' | 'vibrant';
  };
  variables: Record<string, unknown>;
  featureFlags: Record<string, boolean>;
  maintenance: {
    admin: {enabled: boolean; message: string};
    app: {enabled: boolean; message: string};
  };
};

// ── Helpers ────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function primaryForeground(hex: string): '#000000' | '#ffffff' {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const lum =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.35 ? '#000000' : '#ffffff';
}

export function resolveAccent(accentColorId: string, shade: AccentShade): string {
  const accent = ACCENT_COLORS.find(a => a.id === accentColorId) ?? ACCENT_COLORS[0];
  return accent[shade];
}

export function buildPalette(
  mode: 'dark' | 'light',
  accentColorId: string,
  accentShade: AccentShade,
): ThemePalette {
  const accent = resolveAccent(accentColorId, accentShade);
  const fg = primaryForeground(accent);

  if (mode === 'dark') {
    return {
      background:        '#000000',
      foreground:        '#ffffff',
      foregroundMuted:   'rgba(255,255,255,0.55)',
      foregroundSubtle:  'rgba(255,255,255,0.38)',
      foregroundFaint:   'rgba(255,255,255,0.25)',
      placeholder:       'rgba(255,255,255,0.30)',

      surface:           '#111111',
      surfaceHigh:       '#1c1c1c',
      card:              '#161616',

      glass:             'rgba(255,255,255,0.06)',
      glassMid:          'rgba(255,255,255,0.08)',
      glassFaint:        'rgba(255,255,255,0.04)',

      border:            '#2a2a2a',
      hairline:          'rgba(255,255,255,0.08)',
      borderFaint:       'rgba(255,255,255,0.10)',
      borderMid:         'rgba(255,255,255,0.12)',
      borderHeavy:       'rgba(255,255,255,0.18)',

      input:             'rgba(255,255,255,0.06)',
      inputFocused:      'rgba(255,255,255,0.08)',

      ring:              accent,
      primary:           accent,
      primaryForeground: fg,

      overlay:           'rgba(0,0,0,0.75)',

      success:           '#4ade80',
      successForeground: '#000000',
      warning:           '#fbbf24',
      warningForeground: '#000000',
      info:              '#60a5fa',
      infoForeground:    '#000000',
      destructive:       '#f87171',
      destructiveForeground: '#000000',

      muted:             '#111111',
      mutedForeground:   'rgba(255,255,255,0.55)',
    };
  }

  return {
    background:        '#ffffff',
    foreground:        '#000000',
    foregroundMuted:   'rgba(0,0,0,0.55)',
    foregroundSubtle:  'rgba(0,0,0,0.38)',
    foregroundFaint:   'rgba(0,0,0,0.25)',
    placeholder:       'rgba(0,0,0,0.35)',

    surface:           '#f5f5f5',
    surfaceHigh:       '#ebebeb',
    card:              '#fafafa',

    glass:             'rgba(0,0,0,0.04)',
    glassMid:          'rgba(0,0,0,0.06)',
    glassFaint:        'rgba(0,0,0,0.02)',

    border:            '#e0e0e0',
    hairline:          'rgba(0,0,0,0.07)',
    borderFaint:       'rgba(0,0,0,0.08)',
    borderMid:         'rgba(0,0,0,0.10)',
    borderHeavy:       'rgba(0,0,0,0.15)',

    input:             'rgba(0,0,0,0.04)',
    inputFocused:      'rgba(0,0,0,0.06)',

    ring:              accent,
    primary:           accent,
    primaryForeground: fg,

    overlay:           'rgba(0,0,0,0.50)',

    success:           '#16a34a',
    successForeground: '#ffffff',
    warning:           '#d97706',
    warningForeground: '#ffffff',
    info:              '#0284c7',
    infoForeground:    '#ffffff',
    destructive:       '#dc2626',
    destructiveForeground: '#ffffff',

    muted:             '#f5f5f5',
    mutedForeground:   'rgba(0,0,0,0.55)',
  };
}

// ── Hardcoded fallback palettes (server-independent) ───────────────

export const FALLBACK_PALETTE_DARK: ThemePalette  = buildPalette('dark',  'bromoRed', 'dark');
export const FALLBACK_PALETTE_LIGHT: ThemePalette = buildPalette('light', 'bromoRed', 'light');

// ── Default contract ───────────────────────────────────────────────

export const defaultThemeContract: RuntimeThemeContract = {
  branding: {
    platformName: 'BROMO',
    adminTitle: 'BROMO Admin',
    appTitle: 'BROMO App',
  },
  theme: {
    defaultTheme: 'system',
    fontFamily: 'system-ui',
    accentColorId: 'bromoRed',
    accentShade: 'dark',
    dark:  FALLBACK_PALETTE_DARK,
    light: FALLBACK_PALETTE_LIGHT,
  },
  brandGuidelines: {
    personality: 'premium',
    iconStyle: 'rounded',
    borderRadiusScale: 'bold',
    surfaceStyle: 'glass',
    contentDensity: 'compact',
    motionIntensity: 'subtle',
    headingCase: 'uppercase',
    gradientStyle: 'vibrant',
  },
  variables: {},
  featureFlags: {},
  maintenance: {
    admin: {enabled: false, message: 'Admin panel is in maintenance mode.'},
    app:   {enabled: false, message: 'Application is under maintenance.'},
  },
};

// ── Fetch utilities ────────────────────────────────────────────────

export async function fetchThemeContract(
  apiBaseUrl: string,
): Promise<RuntimeThemeContract> {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, '');
  if (!normalized) return defaultThemeContract;
  try {
    const res = await fetch(`${normalized}/settings/public`);
    if (!res.ok) return defaultThemeContract;
    return (await res.json()) as RuntimeThemeContract;
  } catch {
    return defaultThemeContract;
  }
}

export async function fetchThemeContractFromUrls(
  urls: string[],
): Promise<RuntimeThemeContract> {
  for (const raw of urls) {
    const url = raw.trim();
    if (!url) continue;
    try {
      const fullUrl = /\/settings\/public$|\/api\/public\/theme-contract$/.test(url)
        ? url
        : `${url.replace(/\/+$/, '')}/settings/public`;
      const res = await fetch(fullUrl);
      if (!res.ok) continue;
      return (await res.json()) as RuntimeThemeContract;
    } catch {
      // try next
    }
  }
  return defaultThemeContract;
}
