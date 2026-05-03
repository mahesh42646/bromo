import { AdminComingSoonPage, buildAdminMetadata } from "@/components/admin/admin-coming-soon-page";

const routeHref = "/admin/commerce/stores";

export const metadata = buildAdminMetadata(routeHref);

export default function AdminStoresPage() {
  return <AdminComingSoonPage routeHref={routeHref} />;
}
