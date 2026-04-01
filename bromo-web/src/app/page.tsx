import { redirect } from "next/navigation";
import { readAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await readAdminSession();
  if (session) {
    redirect("/admin/dashboard");
  }
  redirect("/admin/login");
}
