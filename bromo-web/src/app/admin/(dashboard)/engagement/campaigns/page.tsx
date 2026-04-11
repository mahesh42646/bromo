import type { Metadata } from "next";
import { AdminCampaigns } from "@/components/admin/admin-campaigns";

export const metadata: Metadata = { title: "AdminCampaigns" };

export default function Page() {
  return <AdminCampaigns />;
}
