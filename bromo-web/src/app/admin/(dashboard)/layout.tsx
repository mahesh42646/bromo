import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
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
  const radiusClass =
    settings.brandGuidelines.borderRadiusScale === "soft"
      ? "rounded-lg"
      : settings.brandGuidelines.borderRadiusScale === "balanced"
        ? "rounded-xl"
        : "rounded-2xl";

  return (
    <div
      className={`bg-background flex h-screen max-h-screen overflow-hidden ${densityClass}`}
      data-brand-surface={settings.brandGuidelines.surfaceStyle}
      data-brand-heading-case={settings.brandGuidelines.headingCase}
    >
      <AdminSidebar adminTitle={settings.branding.adminTitle} />
      <div className="flex min-w-0 flex-1 flex-col max-h-screen">
        <AdminTopBar
          adminTitle={settings.branding.adminTitle}
          sessionTtl={settings.security.adminSessionTtl}
        />
        {settings.maintenance.admin.enabled ? (
          <div className={`border-border bg-muted/60 text-muted-foreground border-b px-4 py-2 text-xs ${radiusClass}`}>
            {settings.maintenance.admin.message}
          </div>
        ) : null}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
