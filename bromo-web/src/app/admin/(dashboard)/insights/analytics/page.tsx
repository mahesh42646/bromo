import type { Metadata } from "next";
import { AdminAnalytics } from "@/components/admin/admin-analytics";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return <AdminAnalytics />;
}
