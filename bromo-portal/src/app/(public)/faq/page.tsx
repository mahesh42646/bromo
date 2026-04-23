import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { FaqPageAccordion } from "@/components/marketing/faq-page-accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Frequently asked questions about ${site.name}.`,
};

const items = [
  {
    q: "How is Bromo different from other short-video apps?",
    a: "Bromo is its own network — native commerce, creator campaigns, and this web dashboard are first-class, not bolted on.",
  },
  {
    q: "Do I need the mobile app?",
    a: "The richest experience (capture, scroll, chat) is on iOS and Android. The web dashboard complements the app for management workflows.",
  },
  {
    q: "How does the web dashboard sign in work?",
    a: "You use the same Firebase-backed Bromo account as on mobile. Sessions use secure httpOnly cookies on this site.",
  },
  {
    q: "When will full e-commerce land on the web?",
    a: "Store management is rolling out continuously; this marketing site will announce major milestones. Check the Stores section on the home page.",
  },
  {
    q: "How do I delete my account or export data?",
    a: "Contact support with your registered email — we’ll follow applicable privacy laws and our internal policies.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">FAQ</h1>
      <p className="mt-4 text-[var(--foreground-muted)]">
        Answers about the {site.name} platform. Still stuck?{" "}
        <Link href="/support" className="text-[var(--accent)] hover:underline">
          Open a ticket
        </Link>
        .
      </p>
      <div className="mt-10">
        <FaqPageAccordion items={items} />
      </div>
    </div>
  );
}
