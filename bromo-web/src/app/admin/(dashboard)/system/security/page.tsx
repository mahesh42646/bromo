import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/system/security");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/system/security" />;
}
