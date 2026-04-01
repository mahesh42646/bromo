import mongoose, { Schema } from "mongoose";

export type ThemeMode = "light" | "dark" | "system";
export type AccentShade = "dark" | "medium" | "light";

// 24 curated accent IDs — must match ACCENT_COLORS in platform-theme.ts
export const VALID_ACCENT_IDS = [
  "bromoRed","crimson","orange","amber","yellow","lime","green","emerald",
  "teal","cyan","sky","blue","indigo","violet","purple","fuchsia","pink",
  "rose","coral","gold","copper","slate","lavender","jade",
] as const;
export type AccentColorId = (typeof VALID_ACCENT_IDS)[number];

// Full resolved palette (server computes this before sending to clients)
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

export interface PlatformSettingsDoc {
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
    accentColorId: AccentColorId;
    accentShade: AccentShade;
    // Resolved palettes (computed server-side, stored for fast reads)
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
  createdAt: Date;
  updatedAt: Date;
}

const paletteSchema = new Schema<ThemePalette>(
  {
    background:           { type: String, default: "#ffffff" },
    foreground:           { type: String, default: "#000000" },
    foregroundMuted:      { type: String, default: "rgba(0,0,0,0.55)" },
    foregroundSubtle:     { type: String, default: "rgba(0,0,0,0.38)" },
    foregroundFaint:      { type: String, default: "rgba(0,0,0,0.25)" },
    placeholder:          { type: String, default: "rgba(0,0,0,0.35)" },
    surface:              { type: String, default: "#f5f5f5" },
    surfaceHigh:          { type: String, default: "#ebebeb" },
    card:                 { type: String, default: "#fafafa" },
    glass:                { type: String, default: "rgba(0,0,0,0.04)" },
    glassMid:             { type: String, default: "rgba(0,0,0,0.06)" },
    glassFaint:           { type: String, default: "rgba(0,0,0,0.02)" },
    border:               { type: String, default: "#e0e0e0" },
    hairline:             { type: String, default: "rgba(0,0,0,0.07)" },
    borderFaint:          { type: String, default: "rgba(0,0,0,0.08)" },
    borderMid:            { type: String, default: "rgba(0,0,0,0.10)" },
    borderHeavy:          { type: String, default: "rgba(0,0,0,0.15)" },
    input:                { type: String, default: "rgba(0,0,0,0.04)" },
    inputFocused:         { type: String, default: "rgba(0,0,0,0.06)" },
    ring:                 { type: String, default: "#c0304f" },
    primary:              { type: String, default: "#c0304f" },
    primaryForeground:    { type: String, default: "#ffffff" },
    overlay:              { type: String, default: "rgba(0,0,0,0.50)" },
    success:              { type: String, default: "#16a34a" },
    successForeground:    { type: String, default: "#ffffff" },
    warning:              { type: String, default: "#d97706" },
    warningForeground:    { type: String, default: "#ffffff" },
    info:                 { type: String, default: "#0284c7" },
    infoForeground:       { type: String, default: "#ffffff" },
    destructive:          { type: String, default: "#dc2626" },
    destructiveForeground:{ type: String, default: "#ffffff" },
    muted:                { type: String, default: "#f5f5f5" },
    mutedForeground:      { type: String, default: "rgba(0,0,0,0.55)" },
  },
  { _id: false },
);

const platformSettingsSchema = new Schema<PlatformSettingsDoc>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    branding: {
      platformName: { type: String, required: true, default: "BROMO" },
      adminTitle: { type: String, required: true, default: "BROMO Admin" },
      appTitle: { type: String, required: true, default: "BROMO App" },
      logoUrl: { type: String, default: "" },
      faviconUrl: { type: String, default: "" },
    },
    theme: {
      defaultTheme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      fontFamily: { type: String, required: true, default: "system-ui" },
      useGoogleFont: { type: Boolean, default: false },
      googleFontFamily: { type: String, default: "" },
      accentColorId: {
        type: String,
        enum: [...VALID_ACCENT_IDS],
        default: "bromoRed",
      },
      accentShade: {
        type: String,
        enum: ["dark", "medium", "light"],
        default: "dark",
      },
      light: { type: paletteSchema, default: () => ({}) },
      dark: {
        type: paletteSchema,
        default: () => ({
          background: "#000000",
          foreground: "#ffffff",
          foregroundMuted: "rgba(255,255,255,0.55)",
          foregroundSubtle: "rgba(255,255,255,0.38)",
          foregroundFaint: "rgba(255,255,255,0.25)",
          placeholder: "rgba(255,255,255,0.30)",
          surface: "#111111",
          surfaceHigh: "#1c1c1c",
          card: "#161616",
          glass: "rgba(255,255,255,0.06)",
          glassMid: "rgba(255,255,255,0.08)",
          glassFaint: "rgba(255,255,255,0.04)",
          border: "#2a2a2a",
          hairline: "rgba(255,255,255,0.08)",
          borderFaint: "rgba(255,255,255,0.10)",
          borderMid: "rgba(255,255,255,0.12)",
          borderHeavy: "rgba(255,255,255,0.18)",
          input: "rgba(255,255,255,0.06)",
          inputFocused: "rgba(255,255,255,0.08)",
          ring: "#ff4d6d",
          primary: "#ff4d6d",
          primaryForeground: "#ffffff",
          overlay: "rgba(0,0,0,0.75)",
          success: "#4ade80",
          successForeground: "#000000",
          warning: "#fbbf24",
          warningForeground: "#000000",
          info: "#60a5fa",
          infoForeground: "#000000",
          destructive: "#f87171",
          destructiveForeground: "#000000",
          muted: "#111111",
          mutedForeground: "rgba(255,255,255,0.55)",
        }),
      },
    },
    maintenance: {
      admin: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: "Admin panel is in maintenance mode." },
      },
      app: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: "Application is under maintenance." },
      },
    },
    security: {
      adminSessionTtl: { type: String, default: "8h" },
      adminSessionTimeoutMinutes: { type: Number, default: 60 },
    },
    featureFlags: {
      analytics: { type: Boolean, default: true },
      support: { type: Boolean, default: true },
      notifications: { type: Boolean, default: true },
      billing: { type: Boolean, default: false },
    },
    whiteLabel: {
      enabled: { type: Boolean, default: false },
      tenantMode: { type: String, enum: ["single", "multi"], default: "single" },
      allowCustomDomain: { type: Boolean, default: false },
      defaultLocale: { type: String, default: "en" },
      supportEmail: { type: String, default: "" },
      companyAddress: { type: String, default: "" },
    },
    variables: {
      showRatings: { type: Boolean, default: true },
      enableWaitlist: { type: Boolean, default: false },
      appStoreUrl: { type: String, default: "" },
      playStoreUrl: { type: String, default: "" },
      termsUrl: { type: String, default: "" },
      privacyUrl: { type: String, default: "" },
      helpCenterUrl: { type: String, default: "" },
      customTagline: { type: String, default: "" },
    },
    brandGuidelines: {
      personality: {
        type: String,
        enum: ["neutral", "premium", "playful", "minimal"],
        default: "premium",
      },
      iconStyle: {
        type: String,
        enum: ["rounded", "sharp", "duotone"],
        default: "rounded",
      },
      borderRadiusScale: {
        type: String,
        enum: ["soft", "balanced", "bold"],
        default: "bold",
      },
      surfaceStyle: {
        type: String,
        enum: ["flat", "glass", "elevated"],
        default: "glass",
      },
      contentDensity: {
        type: String,
        enum: ["comfortable", "compact"],
        default: "compact",
      },
      motionIntensity: {
        type: String,
        enum: ["none", "subtle", "expressive"],
        default: "subtle",
      },
      headingCase: {
        type: String,
        enum: ["sentence", "title", "uppercase"],
        default: "uppercase",
      },
      gradientStyle: {
        type: String,
        enum: ["none", "subtle", "vibrant"],
        default: "vibrant",
      },
    },
  },
  { timestamps: true },
);

export const PlatformSettings = mongoose.model<PlatformSettingsDoc>(
  "PlatformSettings",
  platformSettingsSchema,
);

