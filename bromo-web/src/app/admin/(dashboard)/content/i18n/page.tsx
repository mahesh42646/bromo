import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/content/i18n");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/content/i18n" />;
}
