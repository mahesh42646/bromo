// ── Color system ──────────────────────────────────────────────────
//
// App uses ONLY these color groups:
//   1. Structural: black / white / gray family (fixed per mode)
//   2. Admin-configurable: accent, ring, muted (3 hex colors stored in DB)
//   3. Semantic: red (danger), green (success), orange (warning) — fixed
//
// Nothing else. No hardcoded hex in screens or components.
// ─────────────────────────────────────────────────────────────────

// Fixed backgrounds
export const DARK_BG  = '#000000';
export const LIGHT_BG = '#ffffff';

export type AccentShade = 'dark' | 'medium' | 'light';

// ── Palette type ───────────────────────────────────────────────────

export type ThemePalette = {
  // Structural — fixed per mode (black/gray/white family only)
  background: string;
  foreground: string;
  foregroundMuted: string;    // ~55%
  foregroundSubtle: string;   // ~38%
  foregroundFaint: string;    // ~25%
  placeholder: string;        // ~30%
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

  // Admin-configurable (3 colors)
  accent: string;
  accentForeground: string;    // auto-computed for contrast
  ring: string;
  muted: string;               // secondary/quiet accent
  mutedForeground: string;     // auto-computed for contrast

  // Semantic (fixed — never admin-controlled)
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;

  // Aliases for backward compat
  primary: string;             // = accent
  primaryForeground: string;   // = accentForeground
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
    accentHex: string;   // admin-picked accent color
    ringHex: string;     // admin-picked ring color
    mutedHex: string;    // admin-picked muted color
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

function contrastForeground(hex: string): '#000000' | '#ffffff' {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.35 ? '#000000' : '#ffffff';
}

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

function safeHex(hex: string, fallback: string): string {
  return isValidHex(hex) ? hex : fallback;
}

// ── Palette builder ────────────────────────────────────────────────

export function buildPalette(
  mode: 'dark' | 'light',
  accentHex: string,
  ringHex: string,
  mutedHex: string,
): ThemePalette {
  const accent = safeHex(accentHex, mode === 'dark' ? '#ff4d6d' : '#c0304f');
  const ring   = safeHex(ringHex,   accent);
  const muted  = safeHex(mutedHex,  mode === 'dark' ? '#2a2a2a' : '#e0e0e0');

  const accentFg = contrastForeground(accent);
  const mutedFg  = contrastForeground(muted);

  if (mode === 'dark') {
    return {
      // Structural — always dark family
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
      overlay:           'rgba(0,0,0,0.75)',

      // Admin-configurable
      accent,
      accentForeground:  accentFg,
      ring,
      muted,
      mutedForeground:   mutedFg,

      // Semantic (fixed)
      destructive:            '#f87171',
      destructiveForeground:  '#000000',
      success:                '#4ade80',
      successForeground:      '#000000',
      warning:                '#fbbf24',
      warningForeground:      '#000000',

      // Aliases
      primary:           accent,
      primaryForeground: accentFg,
    };
  }

  return {
    // Structural — always light family
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
    overlay:           'rgba(0,0,0,0.50)',

    // Admin-configurable
    accent,
    accentForeground:  accentFg,
    ring,
    muted,
    mutedForeground:   mutedFg,

    // Semantic (fixed)
    destructive:            '#dc2626',
    destructiveForeground:  '#ffffff',
    success:                '#16a34a',
    successForeground:      '#ffffff',
    warning:                '#d97706',
    warningForeground:      '#ffffff',

    // Aliases
    primary:           accent,
    primaryForeground: accentFg,
  };
}

// ── Hardcoded fallback palettes (used when server is unavailable) ──

export const FALLBACK_PALETTE_DARK: ThemePalette  = buildPalette('dark',  '#ff4d6d', '#ff4d6d', '#2a2a2a');
export const FALLBACK_PALETTE_LIGHT: ThemePalette = buildPalette('light', '#c0304f', '#c0304f', '#f0f0f0');

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
    accentHex: '#ff4d6d',
    ringHex:   '#ff4d6d',
    mutedHex:  '#2a2a2a',
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
