import {
  AdminComingSoonPage,
  buildAdminMetadata,
} from "@/components/admin/admin-coming-soon-page";

export const metadata = buildAdminMetadata("/admin/system/compliance");

export default function Page() {
  return <AdminComingSoonPage routeHref="/admin/system/compliance" />;
}
