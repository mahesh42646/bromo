import type { Metadata } from "next";
import Link from "next/link";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Support",
  description: `Open a support ticket for ${site.name}.`,
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Support</h1>
        <p className="mt-3 text-[var(--foreground-muted)]">
          Tell us what&apos;s going on — we track every ticket. You can also visit{" "}
          <Link href="/contact" className="text-[var(--accent)] hover:underline">
            Contact
          </Link>{" "}
          for general inquiries.
        </p>
      </div>
      <div className="mt-12">
        <SupportTicketForm />
      </div>
    </div>
  );
}
