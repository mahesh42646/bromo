import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/commerce/payments");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/commerce/payments" />;
}
