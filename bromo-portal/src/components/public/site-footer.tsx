"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, Globe2, LayoutDashboard, Share2 } from "lucide-react";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

const legal = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
] as const;

const explore = [
  { href: "/#what-is-bromo", label: "Platform" },
  { href: "/#download", label: "Download app" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/support", label: "Support tickets" },
] as const;

export function SiteFooter({ className }: { className?: string }) {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={cn("mt-auto border-t border-[var(--hairline)] bg-[var(--surface)]", className)}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="text-base font-semibold text-[var(--foreground)]">{site.name}</p>
            <p className="mt-3 max-w-xs text-sm text-[var(--foreground-muted)]">{site.tagline}</p>
            <p className="mt-4 text-sm text-[var(--foreground-muted)]">{site.description.slice(0, 160)}…</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Explore</p>
            <ul className="mt-4 space-y-2">
              {explore.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Company</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${site.supportEmail}`}
                  className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  {site.supportEmail}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Legal & social</p>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {legal.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center gap-3" aria-label="Social">
              <a
                href={site.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[var(--border)] p-2 text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Share2 className="size-4" />
                <span className="sr-only">Social</span>
              </a>
              <a
                href={site.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[var(--border)] p-2 text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Camera className="size-4" />
                <span className="sr-only">Photos</span>
              </a>
              <a
                href={site.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[var(--border)] p-2 text-[var(--foreground-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <Globe2 className="size-4" />
                <span className="sr-only">LinkedIn</span>
              </a>
            </div>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40"
            >
              <LayoutDashboard className="size-4" />
              Open dashboard
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs text-[var(--foreground-subtle)] sm:flex-row sm:text-left sm:px-6">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>
            Designed &amp; developed by{" "}
            <a
              href={site.credits.designDev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--accent)] hover:underline"
            >
              {site.credits.designDev.name}
            </a>
          </p>
        </div>
      </div>
    </motion.footer>
  );
}
