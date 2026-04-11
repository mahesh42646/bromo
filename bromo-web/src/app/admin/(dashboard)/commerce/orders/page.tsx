import type { Metadata } from "next";
import { AdminOrders } from "@/components/admin/admin-orders";

export const metadata: Metadata = { title: "AdminOrders" };

export default function Page() {
  return <AdminOrders />;
}
