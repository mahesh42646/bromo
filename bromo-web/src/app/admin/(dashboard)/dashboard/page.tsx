import type { Metadata } from "next";
import { DashboardHome } from "@/components/admin/dashboard-home";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  return (
    <DashboardHome
      platformName={siteConfig.platformName}
      appTitle={siteConfig.appTitle}
    />
  );
}
