import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/platform/feature-flags");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/platform/feature-flags" />;
}
