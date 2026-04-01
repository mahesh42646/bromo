import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/insights/analytics");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/insights/analytics" />;
}
