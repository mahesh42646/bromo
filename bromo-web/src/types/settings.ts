export type ThemeMode = "light" | "dark" | "system";
export type AccentShade = "dark" | "medium" | "light";

export type ThemePalette = {
  background: string;
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  foregroundFaint: string;
  placeholder: string;
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
  ring: string;
  primary: string;
  primaryForeground: string;
  overlay: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  destructive: string;
  destructiveForeground: string;
  muted: string;
  mutedForeground: string;
};

export type PlatformSettings = {
  key: "default";
  branding: {
    platformName: string;
    adminTitle: string;
    appTitle: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  theme: {
    defaultTheme: ThemeMode;
    fontFamily: string;
    useGoogleFont: boolean;
    googleFontFamily?: string;
    accentColorId: string;
    accentShade: AccentShade;
    light: ThemePalette;
    dark: ThemePalette;
  };
  maintenance: {
    admin: { enabled: boolean; message: string };
    app: { enabled: boolean; message: string };
  };
  security: {
    adminSessionTtl: string;
    adminSessionTimeoutMinutes: number;
  };
  featureFlags: {
    analytics: boolean;
    support: boolean;
    notifications: boolean;
    billing: boolean;
  };
  whiteLabel: {
    enabled: boolean;
    tenantMode: "single" | "multi";
    allowCustomDomain: boolean;
    defaultLocale: string;
    supportEmail: string;
    companyAddress: string;
  };
  variables: {
    showRatings: boolean;
    enableWaitlist: boolean;
    appStoreUrl: string;
    playStoreUrl: string;
    termsUrl: string;
    privacyUrl: string;
    helpCenterUrl: string;
    customTagline: string;
  };
  brandGuidelines: {
    personality: "neutral" | "premium" | "playful" | "minimal";
    iconStyle: "rounded" | "sharp" | "duotone";
    borderRadiusScale: "soft" | "balanced" | "bold";
    surfaceStyle: "flat" | "glass" | "elevated";
    contentDensity: "comfortable" | "compact";
    motionIntensity: "none" | "subtle" | "expressive";
    headingCase: "sentence" | "title" | "uppercase";
    gradientStyle: "none" | "subtle" | "vibrant";
  };
};

