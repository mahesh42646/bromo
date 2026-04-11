import type { Metadata } from "next";
import { AdminBranding } from "@/components/admin/admin-branding";

export const metadata: Metadata = { title: "AdminBranding" };

export default function Page() {
  return <AdminBranding />;
}
