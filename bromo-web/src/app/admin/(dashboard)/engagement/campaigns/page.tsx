import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/engagement/campaigns");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/engagement/campaigns" />;
}
