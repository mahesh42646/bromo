import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Cookies",
  description: `Cookie notice for ${site.name} Studio.`,
};

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Cookies</h1>
      <p className="mt-2 text-sm text-[var(--foreground-muted)]">Last updated {new Date().getFullYear()}</p>
      <div className="prose prose-invert mt-10 max-w-none space-y-4 text-sm text-[var(--foreground-muted)]">
        <p>
          {site.name} Studio sets a strictly necessary httpOnly cookie after you sign in so your dashboard requests can
          be authorized without exposing tokens to JavaScript.
        </p>
        <p>Firebase client SDKs may use local persistence for auth state on this origin. You can clear site data in your browser to remove it.</p>
        <p>We do not run third-party advertising cookies on this studio surface.</p>
      </div>
    </div>
  );
}
