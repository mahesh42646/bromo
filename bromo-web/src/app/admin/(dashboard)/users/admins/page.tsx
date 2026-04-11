import type { Metadata } from "next";
import { AdminAdmins } from "@/components/admin/admin-admins";

export const metadata: Metadata = { title: "Admin users" };

export default function Page() {
  return <AdminAdmins />;
}
