import type { Metadata } from "next";
import { AdminSubscriptions } from "@/components/admin/admin-subscriptions";

export const metadata: Metadata = { title: "AdminSubscriptions" };

export default function Page() {
  return <AdminSubscriptions />;
}
