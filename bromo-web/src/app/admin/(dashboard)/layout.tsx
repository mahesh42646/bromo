import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { siteConfig } from "@/config/site";
import { readAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await readAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      adminTitle={siteConfig.adminTitle}
      sessionTtl={siteConfig.adminSessionTtl}
      email={session.email}
      role={session.role}
      densityClass="text-[13px] md:text-sm"
      brandSurface="glass"
      brandHeadingCase="uppercase"
    >
      {children}
    </AdminShell>
  );
}
