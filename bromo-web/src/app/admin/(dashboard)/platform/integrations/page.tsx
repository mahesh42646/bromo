import type { Metadata } from "next";
import { AdminIntegrations } from "@/components/admin/admin-integrations";

export const metadata: Metadata = { title: "AdminIntegrations" };

export default function Page() {
  return <AdminIntegrations />;
}
