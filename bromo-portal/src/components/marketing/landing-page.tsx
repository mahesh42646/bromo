"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ChevronDown,
  Globe2,
  Headphones,
  Heart,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Play,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      {children}
    </section>
  );
}

function AnimatedStat({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)]/60 px-5 py-6 text-center backdrop-blur-sm"
    >
      <p className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
        {value}
        <span className="text-[var(--accent)]">{suffix}</span>
      </p>
      <p className="mt-2 text-sm text-[var(--foreground-muted)]">{label}</p>
    </motion.div>
  );
}

const faqItems = [
  {
    q: "What is Bromo?",
    a: "Bromo is a creator-first social platform: short video, profiles, messaging, and tools to monetize through stores and promotions — built to feel as polished as the apps you already use every day.",
  },
  {
    q: "Is Bromo only a web dashboard?",
    a: "No. The main experience is on iOS and Android. The web dashboard is for deeper management: profile, drafts, store settings, promotions, and notifications without living inside an endless feed.",
  },
  {
    q: "When will e-commerce expand on the web?",
    a: "Storefronts and product merchandising are rolling out across the same site. You can already manage key store data from the dashboard; richer catalog tools are on the roadmap.",
  },
  {
    q: "How do I get help?",
    a: "Open a support ticket from this site, email our team, or use in-app help where available. We prioritize account security and billing issues first.",
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      {faqItems.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium"
            >
              {item.q}
              <ChevronDown className={cn("size-5 shrink-0 transition-transform", isOpen && "rotate-180")} />
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <p className="px-5 pb-4 text-sm leading-relaxed text-[var(--foreground-muted)]">{item.a}</p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function PhoneMock({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotate: -6, y: 24 }}
      whileInView={{ opacity: 1, rotate: -3, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn("relative mx-auto w-[min(100%,280px)]", className)}
    >
      <div className="aspect-9/19 rounded-[2.2rem] border border-[var(--border)] bg-linear-to-b from-[var(--surface-high)] to-[var(--background)] p-3 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/10">
        <div className="flex h-full flex-col rounded-[1.6rem] bg-[var(--background)] p-3">
          <div className="flex gap-1.5">
            <div className="h-2 w-8 rounded-full bg-[var(--accent)]/40" />
            <div className="h-2 flex-1 rounded-full bg-[var(--surface-high)]" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-24 rounded-xl bg-linear-to-br from-[var(--accent)]/30 to-violet-500/20" />
            <div className="h-3 w-3/4 rounded bg-[var(--surface-high)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--surface-high)]" />
          </div>
          <div className="mt-auto flex justify-center gap-3 pt-6">
            <div className="size-10 rounded-full bg-[var(--surface-high)]" />
            <div className="size-10 rounded-full bg-[var(--accent)]/30" />
            <div className="size-10 rounded-full bg-[var(--surface-high)]" />
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-[var(--accent)]/15 blur-3xl" />
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <Section className="relative overflow-hidden pb-20 pt-10 sm:pt-16 lg:pt-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 animate-gradient bg-linear-to-br from-[var(--accent)]/30 via-transparent to-indigo-600/25" />
          <div className="absolute left-1/2 top-24 h-72 w-[min(90vw,720px)] -translate-x-1/2 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center sm:px-6">
          <div>
         
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            >
              The creator platform built for{" "}
              <span className="bg-linear-to-r from-[var(--accent)] to-rose-200 bg-clip-text text-transparent">
                studio-grade
              </span>{" "}
              polish — with room to own your business.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 max-w-xl text-lg text-[var(--foreground-muted)]"
            >
              {site.description}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-10 flex flex-wrap gap-3"
            >
              <Link
                href="/#download"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent-foreground)] shadow-[0_0_40px_-8px_rgba(255,77,109,0.65)] transition-transform hover:scale-[1.02]"
              >
                <Smartphone className="size-4" />
                Get the app
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium transition-colors hover:border-[var(--accent)]/50"
              >
                <LayoutDashboard className="size-4" />
                Creator dashboard
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                <Headphones className="size-4" />
                Support
              </Link>
            </motion.div>
          </div>
          <PhoneMock />
        </div>
      </Section>

      {/* Stats */}
      <Section className="border-y border-[var(--hairline)] bg-[var(--surface)]/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">
            Built for scale
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {site.stats.map((s, i) => (
              <AnimatedStat key={s.label} {...s} />
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[var(--foreground-subtle)]">
            Figures shown are directional milestones for the platform vision — we&apos;ll publish audited metrics as we
            grow.
          </p>
        </div>
      </Section>

      {/* What is Bromo */}
      <Section id="what-is-bromo" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">What is Bromo?</h2>
            <p className="mt-4 text-[var(--foreground-muted)]">
              Bromo is a full-stack social product: discover reels and stories, follow creators, chat, go live, and open
              storefronts without juggling five different apps. Your identity, content, and commerce stay connected.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Video,
                title: "Short video & stories",
                text: "Feed and explore surfaces designed for smooth playback and creator discovery.",
              },
              {
                icon: Users,
                title: "Profiles & community",
                text: "Follow, save, and grow an audience with profiles that feel personal and premium.",
              },
              {
                icon: MessageCircle,
                title: "Real-time social",
                text: "Chat and live layers that keep fans close — not bolted on as an afterthought.",
              },
              {
                icon: Store,
                title: "Native storefronts",
                text: "Sell products and services from the same profile fans already trust.",
              },
              {
                icon: BarChart3,
                title: "Promotions & insights",
                text: "Boost content and read performance with dashboards that respect your time.",
              },
              {
                icon: Lock,
                title: "Safety by design",
                text: "Account security, verification flows, and moderation primitives built into the core stack.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6"
              >
                <item.icon className="size-9 text-[var(--accent)]" />
                <h3 className="mt-4 font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Why + How split */}
      <Section id="why-bromo" className="border-t border-[var(--hairline)] bg-[var(--surface)]/30 py-20">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 lg:grid-cols-2 sm:px-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-[var(--hairline)] bg-[var(--card)] p-8 lg:p-10"
          >
            <Sparkles className="size-10 text-[var(--accent)]" />
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">Why Bromo?</h2>
            <ul className="mt-6 space-y-4 text-sm text-[var(--foreground-muted)]">
              <li className="flex gap-3">
                <Zap className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                One ecosystem for attention and transactions — fewer tabs, fewer logins.
              </li>
              <li className="flex gap-3">
                <Heart className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                Creator-first defaults: clear analytics, fair promotion tools, and respectful UX.
              </li>
              <li className="flex gap-3">
                <Globe2 className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                Built for reliable creator workflows with performance and trust as first-class concerns.
              </li>
            </ul>
          </motion.div>
          <motion.div
            id="how-bromo"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-[var(--hairline)] bg-linear-to-br from-[var(--accent)]/12 to-transparent p-8 lg:p-10"
          >
            <Play className="size-10 text-[var(--accent)]" />
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-6 space-y-4 text-sm text-[var(--foreground-muted)]">
              <li>
                <span className="font-medium text-[var(--foreground)]">1. Download</span> — Join on iOS or Android with
                a fast, modern onboarding flow.
              </li>
              <li>
                <span className="font-medium text-[var(--foreground)]">2. Create</span> — Post reels, stories, and live
                moments; grow your graph organically.
              </li>
              <li>
                <span className="font-medium text-[var(--foreground)]">3. Monetize</span> — Launch your store, run
                promotions, and track what converts.
              </li>
              <li>
                <span className="font-medium text-[var(--foreground)]">4. Manage on web</span> — Use the dashboard for
                deep edits, legal-safe workflows, and business operations.
              </li>
            </ol>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Sign in to your dashboard
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* Download */}
      <Section id="download" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--card)] px-6 py-12 sm:px-12 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Download Bromo</h2>
              <p className="mt-3 text-[var(--foreground-muted)]">
                The full experience lives on mobile. Grab the app — your web dashboard uses the same secure account.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a
                href={site.appStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-4 text-sm font-medium transition-colors hover:border-[var(--accent)]/40"
              >
                <Smartphone className="size-5" />
                App Store
              </a>
              <a
                href={site.playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-4 text-sm font-medium transition-colors hover:border-[var(--accent)]/40"
              >
                <Play className="size-5" />
                Google Play
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* Commerce teaser */}
      <Section id="commerce" className="border-t border-[var(--hairline)] bg-[var(--surface)]/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Coming on web</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">E-commerce, stores & products</h2>
              <p className="mt-4 text-[var(--foreground-muted)]">
                We&apos;re bringing a comprehensive shopping layer to this same site: richer product pages, inventory
                insights, and storefront management tools that go beyond what fits on a phone screen — without splitting
                your stack.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[var(--foreground-muted)]">
                <li className="flex items-center gap-2">
                  <ShoppingBag className="size-4 text-[var(--accent)]" /> Multi-image listings & variants
                </li>
                <li className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-[var(--accent)]" /> Trusted checkout journeys
                </li>
                <li className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-[var(--accent)]" /> Store analytics next to social performance
                </li>
              </ul>
              <Link
                href="/dashboard/store"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)]"
              >
                Preview store workspace
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-4/3 overflow-hidden rounded-3xl border border-[var(--hairline)] bg-linear-to-br from-[var(--surface-high)] via-[var(--card)] to-[var(--accent)]/20 p-8"
            >
              <div className="grid h-full grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-[var(--background)]/80 p-4 shadow-inner ring-1 ring-white/5"
                    style={{ transform: `translateY(${i % 2 === 0 ? 8 : -8}px)` }}
                  >
                    <div className="h-16 rounded-lg bg-linear-to-br from-[var(--accent)]/25 to-transparent" />
                    <div className="mt-3 h-2 w-2/3 rounded bg-[var(--surface-high)]" />
                    <div className="mt-2 h-2 w-1/2 rounded bg-[var(--surface-high)]" />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* Trust */}
      <Section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Trust & safety</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--foreground-muted)]">
            We treat your data and your community with care: encryption in transit, audited auth flows, and clear legal
            pages. Enterprise-grade reliability is the bar — not a footnote.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Lock, t: "Secure accounts", d: "Modern identity with continuous session hygiene." },
              { icon: BadgeCheck, t: "Transparent policies", d: "Privacy, cookies, and terms written for humans." },
              { icon: Headphones, t: "Human support", d: "Tickets, email, and in-product help when you need it." },
            ].map((x, i) => (
              <motion.div
                key={x.t}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6 text-center"
              >
                <x.icon className="mx-auto size-8 text-[var(--accent)]" />
                <h3 className="mt-4 font-medium">{x.t}</h3>
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">{x.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="border-t border-[var(--hairline)] bg-[var(--surface)]/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">FAQ</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[var(--foreground-muted)]">
            Quick answers about the platform. For specifics, visit{" "}
            <Link href="/faq" className="text-[var(--accent)] hover:underline">
              the full FAQ page
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="text-[var(--accent)] hover:underline">
              contact us
            </Link>
            .
          </p>
          <div className="mt-12">
            <FaqAccordion />
          </div>
        </div>
      </Section>

      {/* Contact CTA */}
      <Section className="pb-24 pt-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-[var(--accent)]/30 bg-linear-to-r from-[var(--accent)]/15 to-violet-600/10 px-8 py-12 text-center sm:px-12"
          >
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions, partnerships, or press?</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--foreground-muted)]">
              We read every message. For account issues, open a ticket so we can track resolution end-to-end.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[var(--accent-foreground)]"
              >
                Open a support ticket
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)]/50 px-6 py-3 text-sm font-medium backdrop-blur"
              >
                Contact the team
              </Link>
            </div>
          </motion.div>
        </div>
      </Section>
    </div>
  );
}
