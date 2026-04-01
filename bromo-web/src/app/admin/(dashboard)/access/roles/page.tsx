import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/access/roles");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/access/roles" />;
}
