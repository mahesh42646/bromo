import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  BookOpen,
  CreditCard,
  FileKey2,
  FileText,
  Flag,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Megaphone,
  Palette,
  Plug,
  Settings,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  UserCog,
  UserSearch,
  Users,
  Wrench,
} from "lucide-react";

export type AdminNavItem = {
  title: string;
  href: string;

  description: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

/** Single source for sidebar labels, routes, and “coming soon” copy per checklist-style admin areas. */
export const ADMIN_NAVIGATION: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/admin/dashboard",
        description:
          "Cross-platform health, KPIs, and incident summaries for operators.",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Users & access",
    items: [
      {
        title: "Admin users",
        href: "/admin/users/admins",
        description:
          "Manage internal admin accounts, invites, and status for the operator console.",
        icon: UserCog,
      },
      {
        title: "Platform users",
        href: "/admin/users/platform",
        description:
          "End-user directory, segmentation, and lifecycle for the consumer-facing product.",
        icon: Users,
      },
      {
        title: "User management",
        href: "/admin/users/manage",
        description:
          "Open a member by ID to review profile, media, soft or permanent deletes, and restores.",
        icon: UserSearch,
      },
      {
        title: "Roles & permissions",
        href: "/admin/access/roles",
        description:
          "RBAC matrices, permission bundles, and audit-friendly policy templates.",
        icon: Shield,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "CMS pages",
        href: "/admin/content/pages",
        description:
          "Structured content blocks, publication workflow, and preview for marketing surfaces.",
        icon: FileText,
      },
      {
        title: "Media library",
        href: "/admin/content/media",
        description:
          "Centralized assets, transformations, CDN metadata, and usage tracking.",
        icon: ImageIcon,
      },
      {
        title: "Localization",
        href: "/admin/content/i18n",
        description:
          "Locale packs, translation status, and fallbacks for multi-language rollout.",
        icon: BookOpen,
      },
    ],
  },
  {
    label: "Commerce & billing",
    items: [
      {
        title: "Affiliate products",
        href: "/admin/commerce/products",
        description:
          "Curate affiliate products users can tag in reels and posts. Links auto-append to caption.",
        icon: ShoppingCart,
      },
      {
        title: "Orders",
        href: "/admin/commerce/orders",
        description:
          "Order pipeline, fulfillment states, and exception handling across channels.",
        icon: ShoppingCart,
      },
      {
        title: "Payments",
        href: "/admin/commerce/payments",
        description:
          "Payment intents, chargebacks, and reconciliation with PSP dashboards.",
        icon: CreditCard,
      },
      {
        title: "Subscriptions",
        href: "/admin/commerce/subscriptions",
        description:
          "Plans, entitlements, dunning, and MRR-oriented subscription operations.",
        icon: Activity,
      },
      {
        title: "Invoicing & tax",
        href: "/admin/commerce/invoicing",
        description:
          "Tax IDs, invoice runs, and export packages for finance stakeholders.",
        icon: FileText,
      },
    ],
  },
  {
    label: "Monetization",
    items: [
      {
        title: "Ads manager",
        href: "/admin/monetization/ads",
        description:
          "Create image, carousel, and video ads served in feeds, reels, stories, and explore.",
        icon: Megaphone,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Analytics",
        href: "/admin/insights/analytics",
        description:
          "Product analytics funnels, cohort views, and adoption metrics.",
        icon: Activity,
      },
      {
        title: "Reports",
        href: "/admin/insights/reports",
        description:
          "Scheduled operational reports and downloadable CSV/Parquet extracts.",
        icon: FileText,
      },
      {
        title: "Audit log",
        href: "/admin/insights/audit",
        description:
          "Immutable admin action history for compliance and investigations.",
        icon: Shield,
      },
    ],
  },
  {
    label: "Engagement",
    items: [
      {
        title: "Notifications",
        href: "/admin/engagement/notifications",
        description:
          "Transactional templates, push/email/SMS routing, and send windows.",
        icon: Bell,
      },
      {
        title: "Support tickets",
        href: "/admin/engagement/support",
        description:
          "Customer issue intake, SLA tracking, and escalation playbooks.",
        icon: LifeBuoy,
      },
      {
        title: "Campaigns",
        href: "/admin/engagement/campaigns",
        description:
          "Lifecycle campaigns, audience caps, and experiment flags for growth.",
        icon: Flag,
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        title: "Integrations",
        href: "/admin/platform/integrations",
        description:
          "Third-party connectors, credential rotation, and partner scopes.",
        icon: Plug,
      },
      {
        title: "Webhooks",
        href: "/admin/platform/webhooks",
        description:
          "Outbound event subscriptions, delivery logs, and retry policies.",
        icon: Link2,
      },
      {
        title: "API keys",
        href: "/admin/platform/api-keys",
        description:
          "Developer credentials, rotation, and usage quotas for public APIs.",
        icon: KeyRound,
      },
      {
        title: "Feature flags",
        href: "/admin/platform/feature-flags",
        description:
          "Progressive delivery, kill switches, and audience targeting for releases.",
        icon: Flag,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Settings",
        href: "/admin/system/settings",
        description:
          "Global toggles, environment linkage, and environment-specific overrides.",
        icon: Settings,
      },
      {
        title: "Branding",
        href: "/admin/system/branding",
        description:
          "Logos, themes, and white-label chrome for tenant experiences.",
        icon: Palette,
      },
      {
        title: "Security & sessions",
        href: "/admin/system/security",
        description:
          "MFA policies, session revocation, IP allowlists, and anomaly signals.",
        icon: FileKey2,
      },
      {
        title: "Jobs & maintenance",
        href: "/admin/system/maintenance",
        description:
          "Background workers, queues, safe-mode controls, and release windows.",
        icon: Wrench,
      },
      {
        title: "Compliance & data",
        href: "/admin/system/compliance",
        description:
          "DSAR tooling, retention policies, and regulatory export packages.",
        icon: Shield,
      },
      {
        title: "Developer diagnostics",
        href: "/admin/system/diagnostics",
        description:
          "Low-level traces, feature probes, and on-call escalation bundles.",
        icon: SlidersHorizontal,
      },
    ],
  },
];

export function getAdminPageMeta(href: string): Pick<AdminNavItem, "title" | "description"> {
  for (const group of ADMIN_NAVIGATION) {
    const found = group.items.find((item) => item.href === href);
    if (found) {
      return { title: found.title, description: found.description };
    }
  }
  return { title: "Admin", description: "Platform administration area." };
}

export function flattenAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAVIGATION.flatMap((g) => g.items);
}
