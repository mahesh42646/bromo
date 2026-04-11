import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { fetchPublicPlatformSettings } from "@/lib/platform-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchPublicPlatformSettings();
  const appName = settings.branding.platformName || settings.branding.appTitle;
  return {
    title: { default: appName, template: `%s · ${appName}` },
    description: `${settings.branding.appTitle} platform experience`,
    icons: settings.branding.faviconUrl
      ? {
          icon: settings.branding.faviconUrl,
          shortcut: settings.branding.faviconUrl,
          apple: settings.branding.faviconUrl,
        }
      : undefined,
  };
}

function paletteVars(p: ReturnType<typeof fetchPublicPlatformSettings> extends Promise<infer T> ? T["theme"]["light"] : never): string {
  return `
    --background: ${p.background};
    --foreground: ${p.foreground};
    --foreground-muted: ${p.foregroundMuted};
    --foreground-subtle: ${p.foregroundSubtle};
    --foreground-faint: ${p.foregroundFaint};
    --placeholder: ${p.placeholder};
    --surface: ${p.surface};
    --surface-high: ${p.surfaceHigh};
    --card: ${p.card};
    --glass: ${p.glass};
    --glass-mid: ${p.glassMid};
    --glass-faint: ${p.glassFaint};
    --border: ${p.border};
    --hairline: ${p.hairline};
    --border-faint: ${p.borderFaint};
    --border-mid: ${p.borderMid};
    --border-heavy: ${p.borderHeavy};
    --input: ${p.input};
    --input-focused: ${p.inputFocused};
    --accent: ${p.accent};
    --accent-foreground: ${p.accentForeground};
    --ring: ${p.ring};
    --overlay: ${p.overlay};
    --muted: ${p.muted};
    --muted-foreground: ${p.mutedForeground};
    --success: ${p.success};
    --success-foreground: ${p.successForeground};
    --warning: ${p.warning};
    --warning-foreground: ${p.warningForeground};
    --destructive: ${p.destructive};
    --destructive-foreground: ${p.destructiveForeground};
    --primary: ${p.accent};
    --primary-foreground: ${p.accentForeground};`;
}

function buildCssVars(settings: Awaited<ReturnType<typeof fetchPublicPlatformSettings>>): string {
  const light = settings.theme.light;
  const dark = settings.theme.dark;
  const radiusMap = {soft: "0.5rem", balanced: "0.75rem", bold: "1rem"} as const;
  const font = settings.theme.useGoogleFont
    ? (settings.theme.googleFontFamily || settings.theme.fontFamily)
    : settings.theme.fontFamily;

  return `
  :root,
  :root[data-theme="light"] {
    ${paletteVars(light)}
    --font-platform: ${font};
    --radius-brand: ${radiusMap[settings.brandGuidelines.borderRadiusScale]};
  }
  :root[data-theme="dark"] {
    ${paletteVars(dark)}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      ${paletteVars(dark)}
    }
  }
  `;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await fetchPublicPlatformSettings();
  const cssVars = buildCssVars(settings);
  const dataTheme = settings.theme.defaultTheme === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        {children}
      </body>
    </html>
  );
}
