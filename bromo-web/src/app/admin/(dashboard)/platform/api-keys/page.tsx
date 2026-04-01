import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/platform/api-keys");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/platform/api-keys" />;
}
