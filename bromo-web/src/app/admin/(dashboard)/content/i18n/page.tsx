import type { Metadata } from "next";
import { AdminLocalization } from "@/components/admin/admin-localization";

export const metadata: Metadata = { title: "AdminLocalization" };

export default function Page() {
  return <AdminLocalization />;
}
