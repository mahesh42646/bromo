import type { Metadata } from "next";
import { AdminMediaLibrary } from "@/components/admin/admin-media-library";

export const metadata: Metadata = { title: "AdminMediaLibrary" };

export default function Page() {
  return <AdminMediaLibrary />;
}
