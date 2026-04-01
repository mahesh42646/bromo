import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/engagement/support");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/engagement/support" />;
}
