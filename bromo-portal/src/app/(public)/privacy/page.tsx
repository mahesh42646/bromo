import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy policy for ${site.name} Studio.`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-[var(--foreground-muted)]">Last updated {new Date().getFullYear()}</p>
      <div className="prose prose-invert mt-10 max-w-none space-y-4 text-sm text-[var(--foreground-muted)]">
        <p>
          {site.name} Studio connects to the same Bromo platform account you use on mobile. Authentication is handled
          by Firebase; session cookies on this site are httpOnly and scoped to this domain.
        </p>
        <p>
          We process the data required to operate your creator account: profile fields you submit, content metadata,
          store listings, and promotion settings. For full platform terms, align with your main Bromo product policies
          and regional requirements.
        </p>
        <p>
          Contact your data controller or support channel listed in the consumer app for deletion and export requests.
        </p>
      </div>
    </div>
  );
}
