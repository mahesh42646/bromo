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

function buildCssVars(settings: Awaited<ReturnType<typeof fetchPublicPlatformSettings>>): string {
  const light = settings.theme.light;
  const dark = settings.theme.dark;
  const radiusMap = {
    soft: "0.5rem",
    balanced: "0.75rem",
    bold: "1rem",
  } as const;
  const font = settings.theme.useGoogleFont
    ? (settings.theme.googleFontFamily || settings.theme.fontFamily)
    : settings.theme.fontFamily;

  return `
  :root,
  :root[data-theme="light"] {
    --background: ${light.background};
    --foreground: ${light.foreground};
    --muted: ${light.muted};
    --muted-foreground: ${light.mutedForeground};
    --border: ${light.border};
    --input: ${light.input};
    --ring: ${light.ring};
    --primary: ${light.primary};
    --primary-foreground: ${light.primaryForeground};
    --destructive: ${light.destructive};
    --destructive-foreground: ${light.destructiveForeground};
    --font-platform: ${font};
    --radius-brand: ${radiusMap[settings.brandGuidelines.borderRadiusScale]};
    --brand-surface-style: ${settings.brandGuidelines.surfaceStyle};
    --brand-density: ${settings.brandGuidelines.contentDensity};
    --brand-gradient-style: ${settings.brandGuidelines.gradientStyle};
  }
  :root[data-theme="dark"] {
    --background: ${dark.background};
    --foreground: ${dark.foreground};
    --muted: ${dark.muted};
    --muted-foreground: ${dark.mutedForeground};
    --border: ${dark.border};
    --input: ${dark.input};
    --ring: ${dark.ring};
    --primary: ${dark.primary};
    --primary-foreground: ${dark.primaryForeground};
    --destructive: ${dark.destructive};
    --destructive-foreground: ${dark.destructiveForeground};
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      --background: ${dark.background};
      --foreground: ${dark.foreground};
      --muted: ${dark.muted};
      --muted-foreground: ${dark.mutedForeground};
      --border: ${dark.border};
      --input: ${dark.input};
      --ring: ${dark.ring};
      --primary: ${dark.primary};
      --primary-foreground: ${dark.primaryForeground};
      --destructive: ${dark.destructive};
      --destructive-foreground: ${dark.destructiveForeground};
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
