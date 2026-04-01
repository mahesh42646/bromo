import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/commerce/subscriptions");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/commerce/subscriptions" />;
}
