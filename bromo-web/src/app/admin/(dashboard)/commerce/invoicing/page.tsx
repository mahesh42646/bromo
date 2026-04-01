import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/commerce/invoicing");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/commerce/invoicing" />;
}
