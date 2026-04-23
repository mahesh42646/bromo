import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { readAdminSession } from "@/lib/auth/session";
import { fetchPublicPlatformSettings } from "@/lib/platform-settings";

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
  const settings = await fetchPublicPlatformSettings();

  const densityClass =
    settings.brandGuidelines.contentDensity === "compact"
      ? "text-[13px] md:text-sm"
      : "text-sm md:text-[15px]";

  const maintenanceMessage = settings.maintenance.admin.enabled
    ? settings.maintenance.admin.message
    : null;

  return (
    <AdminShell
      adminTitle={settings.branding.adminTitle}
      sessionTtl={settings.security.adminSessionTtl}
      email={session.email}
      role={session.role}
      maintenanceMessage={maintenanceMessage}
      densityClass={densityClass}
      brandSurface={settings.brandGuidelines.surfaceStyle}
      brandHeadingCase={settings.brandGuidelines.headingCase}
    >
      {children}
    </AdminShell>
  );
}
