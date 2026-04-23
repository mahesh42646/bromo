import type { Metadata } from "next";
import Link from "next/link";
import { Target, Users, Zap } from "lucide-react";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about ${site.name} — the social commerce platform for creators.`,
};

export default function AboutPage() {
  const cards = [
    { icon: Target, t: "Mission", d: "Help creators own their audience and revenue." },
    { icon: Users, t: "Community", d: "Safety, clarity, and fairness at the center." },
    { icon: Zap, t: "Velocity", d: "Ship fast, measure honestly, iterate in public." },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About {site.name}</h1>
      <p className="mt-4 text-lg text-[var(--foreground-muted)]">{site.tagline}</p>
      <div className="prose prose-invert mt-10 max-w-none space-y-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
        <p>
          {site.name} is built for the next generation of creators who need more than a single-format feed. We combine
          short video, profiles, messaging, live, and commerce so fans can discover you, trust you, and buy from you
          without friction.
        </p>
        <p>
          The web experience on this domain serves two jobs: a full-fidelity marketing home for the whole platform, and
          a powerful dashboard for the work that doesn&apos;t belong on a phone — compliance-friendly edits, store
          configuration, promotions, and notification triage.
        </p>
        <p>
          We believe in transparent policies, human support, and shipping features that respect both creator time and
          audience attention.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {cards.map((x) => (
          <div key={x.t} className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-5">
            <x.icon className="size-7 text-[var(--accent)]" />
            <h2 className="mt-3 font-medium">{x.t}</h2>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">{x.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 text-center text-sm text-[var(--foreground-muted)]">
        <Link href="/#download" className="text-[var(--accent)] hover:underline">
          Download the app
        </Link>{" "}
        ·{" "}
        <Link href="/support" className="text-[var(--accent)] hover:underline">
          Get support
        </Link>
      </p>
    </div>
  );
}
