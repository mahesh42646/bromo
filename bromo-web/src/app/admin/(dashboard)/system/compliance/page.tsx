import type { Metadata } from "next";
import { AdminCompliance } from "@/components/admin/admin-compliance";

export const metadata: Metadata = { title: "AdminCompliance" };

export default function Page() {
  return <AdminCompliance />;
}
