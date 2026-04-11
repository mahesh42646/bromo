import type { Metadata } from "next";
import { AdminPayments } from "@/components/admin/admin-payments";

export const metadata: Metadata = { title: "AdminPayments" };

export default function Page() {
  return <AdminPayments />;
}
