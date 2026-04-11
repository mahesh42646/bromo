import type { Metadata } from "next";
import { AdminInvoicing } from "@/components/admin/admin-invoicing";

export const metadata: Metadata = { title: "AdminInvoicing" };

export default function Page() {
  return <AdminInvoicing />;
}
