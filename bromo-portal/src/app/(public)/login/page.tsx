import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Log in",
  description: `Sign in to ${site.name} Studio with your Bromo account.`,
};

function LoginFallback() {
  return (
    <div className="mx-auto w-full max-w-md animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="h-6 w-40 rounded bg-[var(--surface-high)]" />
      <div className="mt-4 h-4 w-full rounded bg-[var(--surface-high)]" />
      <div className="mt-8 h-10 w-full rounded bg-[var(--surface-high)]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
