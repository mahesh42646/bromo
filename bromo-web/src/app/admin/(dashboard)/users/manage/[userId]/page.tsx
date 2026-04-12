import type { Metadata } from "next";
import { AdminUserManager } from "@/components/admin/admin-user-manager";

export const metadata: Metadata = { title: "Manage user" };

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <AdminUserManager userId={userId} />;
}
