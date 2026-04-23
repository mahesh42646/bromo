export const site = {
  name: "Bromo",
  /** Main marketing site — not only the creator dashboard */
  tagline: "The social commerce platform for creators",
  description:
    "Bromo brings together short video, profiles, chat, live moments, and storefronts — so creators can grow an audience and sell in one place. Download on iOS & Android, or manage everything from your web dashboard.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@bromo.app",
  /** Optional: App Store / Play Store — replace when live */
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL ?? "https://apps.apple.com",
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "https://play.google.com/store",
  credits: {
    designDev: {
      name: "feofo.com",
      url: "https://feofo.com",
    },
  },
  social: {
    twitter: "https://twitter.com",
    instagram: "https://instagram.com",
    linkedin: "https://linkedin.com",
  },
  /** Marketing stats — replace with real numbers when available */
  stats: [
    { label: "Creators ready to scale", value: "10K+", suffix: "" },
    { label: "Countries & growing", value: "50", suffix: "+" },
    { label: "Avg. session depth", value: "3", suffix: "x" },
    { label: "Platform uptime target", value: "99.9", suffix: "%" },
  ],
} as const;

export const navLinks = [
  { href: "/#what-is-bromo", label: "What is Bromo" },
  { href: "/#why-bromo", label: "Why Bromo" },
  { href: "/#how-bromo", label: "How it works" },
  { href: "/#download", label: "Download" },
  { href: "/#commerce", label: "Stores" },
  { href: "/#faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/support", label: "Support" },
] as const;
