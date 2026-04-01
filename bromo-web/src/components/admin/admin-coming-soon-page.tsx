import type { Metadata } from "next";
import { getAdminPageMeta } from "@/config/admin-navigation";
import { ComingSoon } from "@/components/admin/coming-soon";
import { fetchPublicPlatformSettings } from "@/lib/platform-settings";

export function buildAdminMetadata(routeHref: string): Metadata {
  const { title } = getAdminPageMeta(routeHref);
  return { title };
}

export async function AdminComingSoonPage({ routeHref }: { routeHref: string }) {
  const { title, description } = getAdminPageMeta(routeHref);
  const settings = await fetchPublicPlatformSettings();
  return (
    <ComingSoon
      title={title}
      description={description}
      platformName={settings.branding.platformName}
    />
  );
}
