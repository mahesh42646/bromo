import type { Metadata } from "next";
import { AdminRoles } from "@/components/admin/admin-roles";

export const metadata: Metadata = { title: "Roles & permissions" };

export default function Page() {
  return <AdminRoles />;
}
