import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms of use for ${site.name} Studio.`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
      <p className="mt-2 text-sm text-[var(--foreground-muted)]">Last updated {new Date().getFullYear()}</p>
      <div className="prose prose-invert mt-10 max-w-none space-y-4 text-sm text-[var(--foreground-muted)]">
        <p>
          By using {site.name} Studio you agree to follow the same community and commerce rules that apply to the
          Bromo mobile experience. The dashboard is a management surface — not a replacement for in-app playback or
          messaging features.
        </p>
        <p>
          You are responsible for content you publish, ads you promote, and listings in your store. We may suspend
          access for abuse, fraud, or legal compliance.
        </p>
        <p>Host-specific terms (e.g. admin.{`domain.com`}) can be layered when those products ship.</p>
      </div>
    </div>
  );
}
