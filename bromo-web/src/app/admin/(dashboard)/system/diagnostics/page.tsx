import type { Metadata } from "next";
import { AdminDiagnostics } from "@/components/admin/admin-diagnostics";

export const metadata: Metadata = { title: "AdminDiagnostics" };

export default function Page() {
  return <AdminDiagnostics />;
}
