import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${site.name} — partnerships, press, and general inquiries.`,
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
      <p className="mt-4 text-[var(--foreground-muted)]">
        For product issues, billing, or account recovery, please{" "}
        <Link href="/support" className="font-medium text-[var(--accent)] hover:underline">
          open a support ticket
        </Link>{" "}
        so we can track your case.
      </p>
      <div className="mt-10 space-y-6 rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-8">
        <div>
          <h2 className="text-sm font-medium text-[var(--foreground)]">Email</h2>
          <a href={`mailto:${site.supportEmail}`} className="mt-1 inline-block text-[var(--accent)] hover:underline">
            {site.supportEmail}
          </a>
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--foreground)]">Press & partnerships</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Use the same inbox with subject line &quot;Partnership&quot; or &quot;Press&quot; — we route internally.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-[var(--foreground)]">Office hours</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            We aim to respond within one business day. Critical safety reports are prioritized 24/7 where coverage
            exists.
          </p>
        </div>
      </div>
      <p className="mt-10 text-center text-sm text-[var(--foreground-subtle)]">
        Site credits:{" "}
        <a
          href={site.credits.designDev.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          {site.credits.designDev.name}
        </a>
      </p>
    </div>
  );
}
