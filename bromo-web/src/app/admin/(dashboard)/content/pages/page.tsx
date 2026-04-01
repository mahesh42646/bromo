import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/content/pages");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/content/pages" />;
}
