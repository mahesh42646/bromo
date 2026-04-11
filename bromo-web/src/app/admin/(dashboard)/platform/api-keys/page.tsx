import type { Metadata } from "next";
import { AdminApiKeys } from "@/components/admin/admin-api-keys";

export const metadata: Metadata = { title: "AdminApiKeys" };

export default function Page() {
  return <AdminApiKeys />;
}
