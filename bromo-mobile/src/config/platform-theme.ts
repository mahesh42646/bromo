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

export type RuntimeThemeContract = {
  branding: {
    platformName: string;
    adminTitle: string;
    appTitle: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  theme: {
    defaultTheme: "light" | "dark" | "system";
    fontFamily: string;
    light: ThemePalette;
    dark: ThemePalette;
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
  variables: Record<string, unknown>;
  featureFlags: Record<string, boolean>;
  maintenance: {
    admin: { enabled: boolean; message: string };
    app: { enabled: boolean; message: string };
  };
};

export const defaultThemeContract: RuntimeThemeContract = {
  branding: {
    platformName: "BROMO",
    adminTitle: "BROMO Admin",
    appTitle: "BROMO App",
  },
  theme: {
    defaultTheme: "system",
    fontFamily: "system-ui",
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
  variables: {},
  featureFlags: {},
  maintenance: {
    admin: { enabled: false, message: "Admin panel is in maintenance mode." },
    app: { enabled: false, message: "Application is under maintenance." },
  },
};

export async function fetchThemeContract(
  apiBaseUrl: string,
): Promise<RuntimeThemeContract> {
  const normalized = apiBaseUrl.trim().replace(/\/+$/, "");
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
      // Support direct endpoint URL and base URL variants.
      const fullUrl = /\/settings\/public$|\/api\/public\/theme-contract$/.test(url)
        ? url
        : `${url.replace(/\/+$/, "")}/settings/public`;
      const res = await fetch(fullUrl);
      if (!res.ok) continue;
      return (await res.json()) as RuntimeThemeContract;
    } catch {
      // try next URL
    }
  }
  return defaultThemeContract;
}

