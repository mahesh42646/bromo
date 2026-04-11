import type { Metadata } from "next";
import { AdminSecurity } from "@/components/admin/admin-security";

export const metadata: Metadata = { title: "AdminSecurity" };

export default function Page() {
  return <AdminSecurity />;
}
