import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/users/admins");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/users/admins" />;
}
