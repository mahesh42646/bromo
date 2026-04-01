import type { PlatformSettings, ThemePalette } from "@/types/settings";

export type RuntimeThemeContract = {
  branding: PlatformSettings["branding"];
  theme: {
    defaultTheme: PlatformSettings["theme"]["defaultTheme"];
    fontFamily: string;
    light: ThemePalette;
    dark: ThemePalette;
  };
  brandGuidelines: PlatformSettings["brandGuidelines"];
  variables: PlatformSettings["variables"];
  featureFlags: PlatformSettings["featureFlags"];
  maintenance: PlatformSettings["maintenance"];
};

export function toRuntimeThemeContract(
  settings: PlatformSettings,
): RuntimeThemeContract {
  return {
    branding: settings.branding,
    theme: {
      defaultTheme: settings.theme.defaultTheme,
      fontFamily:
        settings.theme.useGoogleFont && settings.theme.googleFontFamily
          ? settings.theme.googleFontFamily
          : settings.theme.fontFamily,
      light: settings.theme.light,
      dark: settings.theme.dark,
    },
    brandGuidelines: settings.brandGuidelines,
    variables: settings.variables,
    featureFlags: settings.featureFlags,
    maintenance: settings.maintenance,
  };
}

