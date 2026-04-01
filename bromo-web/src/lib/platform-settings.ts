import type { PlatformSettings } from "@/types/settings";
import { settings } from "@/config/settings";

const API_INTERNAL_URL = settings.apiInternalUrl;

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
    defaultTheme: "light",
    fontFamily: "system-ui",
    useGoogleFont: false,
    googleFontFamily: "",
    light: {
      background: "#ffffff",
      foreground: "#0a0a0a",
      muted: "#f4f4f5",
      mutedForeground: "#71717a",
      border: "#e4e4e7",
      input: "#e4e4e7",
      ring: "#7c3aed",
      primary: "#7c3aed",
      primaryForeground: "#fafafa",
      destructive: "#dc2626",
      destructiveForeground: "#fafafa",
    },
    dark: {
      background: "#09090b",
      foreground: "#fafafa",
      muted: "#27272a",
      mutedForeground: "#a1a1aa",
      border: "#27272a",
      input: "#27272a",
      ring: "#a78bfa",
      primary: "#a78bfa",
      primaryForeground: "#18181b",
      destructive: "#f87171",
      destructiveForeground: "#18181b",
    },
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
      light: { ...defaultPlatformSettings.theme.light, ...(raw.theme?.light ?? {}) },
      dark: { ...defaultPlatformSettings.theme.dark, ...(raw.theme?.dark ?? {}) },
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

