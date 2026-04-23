import type { ReactNode } from "react";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

export function PublicShell({
  children,
  showAuthInHeader = true,
}: {
  children: ReactNode;
  showAuthInHeader?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader showAuth={showAuthInHeader} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
