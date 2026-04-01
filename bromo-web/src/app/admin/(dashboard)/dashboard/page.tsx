import type { Metadata } from "next";
import { DashboardHome } from "@/components/admin/dashboard-home";
import { fetchPublicPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const settings = await fetchPublicPlatformSettings();
  return (
    <DashboardHome
      platformName={settings.branding.platformName}
      appTitle={settings.branding.appTitle}
    />
  );
}
