import type { Metadata } from "next";
import { getAdminPageMeta } from "@/config/admin-navigation";
import { siteConfig } from "@/config/site";
import { ComingSoon } from "@/components/admin/coming-soon";

export function buildAdminMetadata(routeHref: string): Metadata {
  const { title } = getAdminPageMeta(routeHref);
  return { title };
}

export async function AdminComingSoonPage({ routeHref }: { routeHref: string }) {
  const { title, description } = getAdminPageMeta(routeHref);
  return (
    <ComingSoon
      title={title}
      description={description}
      platformName={siteConfig.platformName}
    />
  );
}
