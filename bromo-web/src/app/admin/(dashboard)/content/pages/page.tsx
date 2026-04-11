import type { Metadata } from "next";
import { AdminCmsPages } from "@/components/admin/admin-cms-pages";

export const metadata: Metadata = { title: "AdminCmsPages" };

export default function Page() {
  return <AdminCmsPages />;
}
