import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/system/maintenance");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/system/maintenance" />;
}
