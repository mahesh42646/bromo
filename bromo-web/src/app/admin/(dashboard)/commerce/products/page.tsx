import type { Metadata } from "next";
import { AdminAffiliateProducts } from "@/components/admin/admin-affiliate-products";

export const metadata: Metadata = { title: "Affiliate Products" };

export default function Page() {
  return <AdminAffiliateProducts />;
}
