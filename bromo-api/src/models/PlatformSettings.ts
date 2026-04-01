import mongoose, { Schema } from "mongoose";

export type ThemeMode = "light" | "dark" | "system";

export type ThemePalette = {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  destructiveForeground: string;
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
    background: { type: String, default: "#ffffff" },
    foreground: { type: String, default: "#0a0a0a" },
    muted: { type: String, default: "#f4f4f5" },
    mutedForeground: { type: String, default: "#71717a" },
    border: { type: String, default: "#e4e4e7" },
    input: { type: String, default: "#e4e4e7" },
    ring: { type: String, default: "#7c3aed" },
    primary: { type: String, default: "#7c3aed" },
    primaryForeground: { type: String, default: "#fafafa" },
    destructive: { type: String, default: "#dc2626" },
    destructiveForeground: { type: String, default: "#fafafa" },
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
      light: { type: paletteSchema, default: () => ({}) },
      dark: {
        type: paletteSchema,
        default: () => ({
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

