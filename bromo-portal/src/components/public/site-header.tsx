"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { navLinks, site } from "@/config/site";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  showAuth?: boolean;
};

export function SiteHeader({ className, showAuth = true }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--background)]/85 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          <span className="relative text-lg font-semibold tracking-tight">
            <span className="bg-linear-to-r from-[var(--accent)] to-rose-300 bg-clip-text text-transparent">
              {site.name}
            </span>
            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[var(--accent)] transition-all group-hover:w-full" />
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary"
        >
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-2.5 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--foreground)]",
                pathname === item.href && "text-[var(--foreground)]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {showAuth ? (
            <>
              <Link
                href="/login"
                className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-high)] hover:text-[var(--foreground)] sm:inline-flex"
              >
                <LogIn className="size-4" aria-hidden />
                Log in
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)] shadow-[0_0_24px_-4px_rgba(255,77,109,0.5)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:px-3.5"
              >
                <LayoutDashboard className="size-4" aria-hidden />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </>
          ) : null}

          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-[var(--foreground)] lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-[var(--hairline)] lg:hidden"
          >
            <nav className="mx-auto flex max-h-[min(70vh,480px)] max-w-6xl flex-col gap-0.5 overflow-y-auto px-4 py-3" aria-label="Mobile">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm text-[var(--foreground-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-[var(--accent)]"
              >
                Log in
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
