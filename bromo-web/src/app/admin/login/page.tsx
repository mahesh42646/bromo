import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { readAdminSession } from "@/lib/auth/session";
import { fetchPublicPlatformSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  description: "BROMO platform administrator authentication",
};

export default async function AdminLoginPage() {
  const session = await readAdminSession();
  if (session) {
    redirect("/admin/dashboard");
  }
  const settings = await fetchPublicPlatformSettings();

  return (
    <div className="from-background via-muted/30 to-background relative min-h-screen overflow-hidden bg-gradient-to-br">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 90% 60% at 15% 10%, rgb(139 92 246 / 0.18), transparent 55%),
            radial-gradient(ellipse 70% 50% at 85% 20%, rgb(6 182 212 / 0.14), transparent 50%),
            radial-gradient(ellipse 60% 40% at 50% 95%, rgb(99 102 241 / 0.12), transparent 45%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(rgb(0 0 0 / 0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgb(0 0 0 / 0.35) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
        {settings.maintenance.admin.enabled ? (
          <p className="text-muted-foreground mb-4 rounded-lg border border-border bg-muted/60 px-4 py-2 text-xs">
            {settings.maintenance.admin.message}
          </p>
        ) : null}
        <LoginForm
          platformName={settings.branding.platformName}
          adminTitle={settings.branding.adminTitle}
        />
      </div>
    </div>
  );
}
