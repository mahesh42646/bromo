import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/users/platform");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/users/platform" />;
}
