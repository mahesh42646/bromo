import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FirebaseAnalyticsInit } from "@/components/firebase-analytics-init";
import { WebAppearanceSync } from "@/components/web-appearance-sync";
import { WEB_APPEARANCE_STORAGE_KEY } from "@/config/appearance";
import { site } from "@/config/site";
import { buildAppearanceBootScript } from "@/lib/web-appearance";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  robots: { index: true, follow: true },
};

const appearanceBootScript = buildAppearanceBootScript(WEB_APPEARANCE_STORAGE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <Script id="bromo-appearance-boot" strategy="beforeInteractive">
          {appearanceBootScript}
        </Script>
        <WebAppearanceSync />
        <FirebaseAnalyticsInit />
        {children}
      </body>
    </html>
  );
}
