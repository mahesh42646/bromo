"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { loginAction, type LoginState } from "@/app/admin/login/actions";

const initialState: LoginState = { error: null };

export function LoginForm({
  platformName,
  adminTitle,
}: {
  platformName: string;
  adminTitle: string;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const didNavigate = useRef(false);

  useEffect(() => {
    if (!state.ok || didNavigate.current) return;
    didNavigate.current = true;
    window.location.replace("/admin/dashboard");
  }, [state.ok]);

  return (
    <div className="relative w-full max-w-[400px]">
      <div
        className={cn(
          "border-border/60 from-background/85 to-background/60",
          "shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)]",
          "rounded-3xl border bg-gradient-to-b p-px backdrop-blur-xl",
        )}
      >
        <div className="rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-white/90 to-zinc-50/90 p-8 dark:from-zinc-950/90 dark:to-zinc-900/95">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="text-primary flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 ring-1 ring-white/50 dark:ring-white/10">
              <ShieldCheck className="size-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-foreground text-xl font-semibold tracking-tight">
                {adminTitle}
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Secure access for {platformName} administrators.
              </p>
            </div>
          </div>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-foreground text-xs font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@organization.com"
                  className="border-input bg-background/80 placeholder:text-muted-foreground/70 focus-visible:ring-ring text-foreground w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-foreground text-xs font-medium">
                Password
              </label>
              <div className="relative">
                <KeyRound className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="border-input bg-background/80 placeholder:text-muted-foreground/70 focus-visible:ring-ring text-foreground w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2"
                />
              </div>
            </div>

            {state.error ? (
              <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm" role="alert">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isPending || state.ok}
              className="group relative w-full overflow-hidden rounded-xl py-2.5 text-sm font-medium text-white transition-[transform,box-shadow] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-violet-500 to-cyan-500 opacity-95 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="relative inline-flex w-full items-center justify-center gap-2">
                {isPending || state.ok ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {state.ok ? "Opening console…" : isPending ? "Signing in…" : "Continue"}
              </span>
            </button>
          </form>
        </div>
      </div>
      <p className="text-muted-foreground mt-6 text-center text-xs">
        Protected area · use credentials issued by your org
      </p>
    </div>
  );
}
