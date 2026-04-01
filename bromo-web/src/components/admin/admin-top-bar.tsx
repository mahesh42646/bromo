"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/logout/actions";

function LogoutSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function AdminTopBar({
  adminTitle,
  sessionTtl,
}: {
  adminTitle: string;
  sessionTtl: string;
}) {
  return (
    <header className="border-border bg-background brand-surface flex h-14 items-center justify-between gap-2 border-b px-4 md:px-6">
      <div className="text-muted-foreground hidden items-center gap-3 text-xs md:flex">
        <span className="text-foreground font-semibold">{adminTitle}</span>
        <span className="rounded-full border border-border px-2 py-0.5">
          Session: {sessionTtl}
        </span>
      </div>
      <form action={logoutAction}>
        <LogoutSubmit />
      </form>
    </header>
  );
}
