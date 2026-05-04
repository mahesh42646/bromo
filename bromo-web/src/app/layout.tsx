import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { WEB_APPEARANCE_STORAGE_KEY } from "@/config/appearance";
import { siteConfig } from "@/config/site";
import { buildAppearanceBootScript } from "@/lib/web-appearance";
import { WebAppearanceSync } from "@/components/web-appearance-sync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: siteConfig.platformName, template: `%s · ${siteConfig.platformName}` },
  description: siteConfig.description,
  applicationName: siteConfig.platformName,
};

const appearanceBootScript = buildAppearanceBootScript(WEB_APPEARANCE_STORAGE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Script id="bromo-appearance-boot" strategy="beforeInteractive">
          {appearanceBootScript}
        </Script>
        <WebAppearanceSync />
        {children}
      </body>
    </html>
  );
}
