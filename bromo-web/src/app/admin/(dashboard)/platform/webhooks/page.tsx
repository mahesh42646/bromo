import type { Metadata } from "next";
import { AdminWebhooks } from "@/components/admin/admin-webhooks";

export const metadata: Metadata = { title: "AdminWebhooks" };

export default function Page() {
  return <AdminWebhooks />;
}
