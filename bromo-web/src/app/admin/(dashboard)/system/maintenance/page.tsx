import type { Metadata } from "next";
import { AdminMaintenance } from "@/components/admin/admin-maintenance";

export const metadata: Metadata = { title: "AdminMaintenance" };

export default function Page() {
  return <AdminMaintenance />;
}
