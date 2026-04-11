import type { Metadata } from "next";
import { AdminAuditLog } from "@/components/admin/admin-audit";

export const metadata: Metadata = { title: "AdminAuditLog" };

export default function Page() {
  return <AdminAuditLog />;
}
