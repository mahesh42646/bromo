import type { Metadata } from "next";
import { PlatformUsers } from "@/components/admin/platform-users";

export const metadata: Metadata = { title: "Platform users" };

export default function Page() {
  return <PlatformUsers />;
}
