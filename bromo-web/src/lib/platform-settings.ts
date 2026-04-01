import type { PlatformSettings } from "@/types/settings";
import { settings } from "@/config/settings";

const API_INTERNAL_URL = settings.apiInternalUrl;

const DEFAULT_DARK_PALETTE: PlatformSettings["theme"]["dark"] = {
  background: "#000000", foreground: "#ffffff",
  foregroundMuted: "rgba(255,255,255,0.55)", foregroundSubtle: "rgba(255,255,255,0.38)",
  foregroundFaint: "rgba(255,255,255,0.25)", placeholder: "rgba(255,255,255,0.30)",
  surface: "#111111", surfaceHigh: "#1c1c1c", card: "#161616",
  glass: "rgba(255,255,255,0.06)", glassMid: "rgba(255,255,255,0.08)", glassFaint: "rgba(255,255,255,0.04)",
  border: "#2a2a2a", hairline: "rgba(255,255,255,0.08)",
  borderFaint: "rgba(255,255,255,0.10)", borderMid: "rgba(255,255,255,0.12)", borderHeavy: "rgba(255,255,255,0.18)",
  input: "rgba(255,255,255,0.06)", inputFocused: "rgba(255,255,255,0.08)",
  overlay: "rgba(0,0,0,0.75)",
  accent: "#ff4d6d", accentForeground: "#ffffff",
  ring: "#ff4d6d",
  muted: "#2a2a2a", mutedForeground: "#ffffff",
  destructive: "#f87171", destructiveForeground: "#000000",
  success: "#4ade80", successForeground: "#000000",
  warning: "#fbbf24", warningForeground: "#000000",
  primary: "#ff4d6d", primaryForeground: "#ffffff",
};

const DEFAULT_LIGHT_PALETTE: PlatformSettings["theme"]["light"] = {
  background: "#ffffff", foreground: "#000000",
  foregroundMuted: "rgba(0,0,0,0.55)", foregroundSubtle: "rgba(0,0,0,0.38)",
  foregroundFaint: "rgba(0,0,0,0.25)", placeholder: "rgba(0,0,0,0.35)",
  surface: "#f5f5f5", surfaceHigh: "#ebebeb", card: "#fafafa",
  glass: "rgba(0,0,0,0.04)", glassMid: "rgba(0,0,0,0.06)", glassFaint: "rgba(0,0,0,0.02)",
  border: "#e0e0e0", hairline: "rgba(0,0,0,0.07)",
  borderFaint: "rgba(0,0,0,0.08)", borderMid: "rgba(0,0,0,0.10)", borderHeavy: "rgba(0,0,0,0.15)",
  input: "rgba(0,0,0,0.04)", inputFocused: "rgba(0,0,0,0.06)",
  overlay: "rgba(0,0,0,0.50)",
  accent: "#c0304f", accentForeground: "#ffffff",
  ring: "#c0304f",
  muted: "#f0f0f0", mutedForeground: "#000000",
  destructive: "#dc2626", destructiveForeground: "#ffffff",
  success: "#16a34a", successForeground: "#ffffff",
  warning: "#d97706", warningForeground: "#ffffff",
  primary: "#c0304f", primaryForeground: "#ffffff",
};

export const defaultPlatformSettings: PlatformSettings = {
  key: "default",
  branding: {
    platformName: "BROMO",
    adminTitle: "BROMO Admin",
    appTitle: "BROMO App",
    logoUrl: "",
    faviconUrl: "",
  },
  theme: {
    defaultTheme: "dark",
    fontFamily: "system-ui",
    useGoogleFont: false,
    googleFontFamily: "",
    accentHex: "#ff4d6d",
    ringHex: "#ff4d6d",
    mutedHex: "#2a2a2a",
    light: DEFAULT_LIGHT_PALETTE,
    dark: DEFAULT_DARK_PALETTE,
  },
  maintenance: {
    admin: { enabled: false, message: "Admin panel is in maintenance mode." },
    app: { enabled: false, message: "Application is under maintenance." },
  },
  security: {
    adminSessionTtl: "8h",
    adminSessionTimeoutMinutes: 60,
  },
  featureFlags: {
    analytics: true,
    support: true,
    notifications: true,
    billing: false,
  },
  whiteLabel: {
    enabled: false,
    tenantMode: "single",
    allowCustomDomain: false,
    defaultLocale: "en",
    supportEmail: "",
    companyAddress: "",
  },
  variables: {
    showRatings: true,
    enableWaitlist: false,
    appStoreUrl: "",
    playStoreUrl: "",
    termsUrl: "",
    privacyUrl: "",
    helpCenterUrl: "",
    customTagline: "",
  },
  brandGuidelines: {
    personality: "premium",
    iconStyle: "rounded",
    borderRadiusScale: "bold",
    surfaceStyle: "glass",
    contentDensity: "compact",
    motionIntensity: "subtle",
    headingCase: "uppercase",
    gradientStyle: "vibrant",
  },
};

export function mergePlatformSettings(
  raw: Partial<PlatformSettings> | null | undefined,
): PlatformSettings {
  if (!raw) return defaultPlatformSettings;
  const merged: PlatformSettings = {
    ...defaultPlatformSettings,
    ...raw,
    branding: { ...defaultPlatformSettings.branding, ...(raw.branding ?? {}) },
    theme: {
      ...defaultPlatformSettings.theme,
      ...(raw.theme ?? {}),
      accentHex: raw.theme?.accentHex ?? defaultPlatformSettings.theme.accentHex,
      ringHex:   raw.theme?.ringHex   ?? defaultPlatformSettings.theme.ringHex,
      mutedHex:  raw.theme?.mutedHex  ?? defaultPlatformSettings.theme.mutedHex,
      light: { ...DEFAULT_LIGHT_PALETTE, ...(raw.theme?.light ?? {}) },
      dark:  { ...DEFAULT_DARK_PALETTE,  ...(raw.theme?.dark  ?? {}) },
    },
    maintenance: {
      admin: { ...defaultPlatformSettings.maintenance.admin, ...(raw.maintenance?.admin ?? {}) },
      app: { ...defaultPlatformSettings.maintenance.app, ...(raw.maintenance?.app ?? {}) },
    },
    security: { ...defaultPlatformSettings.security, ...(raw.security ?? {}) },
    featureFlags: { ...defaultPlatformSettings.featureFlags, ...(raw.featureFlags ?? {}) },
    whiteLabel: { ...defaultPlatformSettings.whiteLabel, ...(raw.whiteLabel ?? {}) },
    variables: { ...defaultPlatformSettings.variables, ...(raw.variables ?? {}) },
    brandGuidelines: {
      ...defaultPlatformSettings.brandGuidelines,
      ...(raw.brandGuidelines ?? {}),
    },
  };
  if (merged.theme.defaultTheme === "system") {
    merged.theme.defaultTheme = "light";
  }
  return merged;
}

export async function fetchPublicPlatformSettings(): Promise<PlatformSettings> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/settings/public`, { cache: "no-store" });
    if (!res.ok) return defaultPlatformSettings;
    const data = (await res.json()) as Partial<PlatformSettings>;
    return mergePlatformSettings(data);
  } catch {
    return defaultPlatformSettings;
  }
}

