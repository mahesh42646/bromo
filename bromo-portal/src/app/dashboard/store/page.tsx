"use client";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  ClipboardList,
  CreditCard,
  Globe,
  Handshake,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Store as StoreIcon,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { site } from "@/config/site";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Store",
};

export default async function StorePage() {
  const user = await fetchMeServer();
  if (!user) return null;

  const res = await apiWithAuth("/stores/mine");
  const json = res.ok ? await res.json().catch(() => null) : null;
  const store =
    json && typeof json === "object" && json !== null && "store" in json
      ? (json as { store: Record<string, unknown> }).store
      : null;

  if (!res.ok && res.status === 403) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Store</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">Verified email unlocks store APIs.</p>
        </div>
        <Card>
          <CardTitle>Verify in the app</CardTitle>
          <CardDescription>
            Open Bromo on your phone, confirm your email, then refresh this page to manage your storefront.
          </CardDescription>
        </Card>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bromo Store</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--foreground-muted)]">
            A storefront on Bromo is built for the same depth you expect from large marketplaces: rich catalog,
            variants, local discovery, and promotions tied to your reels. Today we focus on offline or self-managed
            fulfillment; when you are ready for delivery partners, we flip on shipping, couriers, and inventory sync.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle>How it works</CardTitle>
            <div className="mt-2 space-y-3 text-sm text-[var(--foreground-muted)]">
              <p>
                Create your store once in the Bromo app — upload branding, set categories, and publish products with
                photos taken on device. Fans discover you through reels, chat, and the store tab.
              </p>
              <p>
                Start with pickup, meetups, or WhatsApp handoffs. When you enable delivery later, the same SKUs power
                nationwide shipping without rebuilding your catalog.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={site.appStoreUrl}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)]"
              >
                Get the iOS app
              </a>
              <a
                href={site.playStoreUrl}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface)]"
              >
                Get the Android app
              </a>
            </div>
          </Card>

          <div className="space-y-4 rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
              Roadmap
            </h2>
            <ul className="space-y-3 text-sm text-[var(--foreground-muted)]">
              <li className="flex gap-2">
                <Package className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                Multi-SKU bundles & limited drops
              </li>
              <li className="flex gap-2">
                <Truck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                Courier integrations & rate shopping
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                Fraud checks & verified payouts
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/60 p-8 text-center">
          <Sparkles className="mx-auto size-10 text-[var(--accent)]" />
          <h2 className="mt-4 text-lg font-semibold">Set up your store</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--foreground-muted)]">
            You have not created a store on this account yet. Launch it from the app — then tune copy, hours, and
            featured products here as the dashboard grows.
          </p>
        </section>
      </div>
    );
  }

  const name = String(store.name ?? "Your store");
  const description = String(store.description ?? "");
  const city = String(store.city ?? "—");
  const category = String(store.category ?? "—");
  const phone = String(store.phone ?? "—");
  const hasDelivery = Boolean(store.hasDelivery);
  const isActive = store.isActive !== false;
  const leadsToday = Number(store.leadsToday ?? 0);
  const openInquiries = Number(store.openInquiries ?? 0);
  const listedProducts = Number(store.productCount ?? 0);
  const avgResponseMins = Number(store.avgResponseMins ?? 45);
  const publicStorePath = String(store.publicUrl ?? store.slug ?? "").trim();
  const publicStoreHref = publicStorePath.startsWith("http")
    ? publicStorePath
    : publicStorePath
      ? `/store/${publicStorePath.replace(/^\/+/, "")}`
      : "/store";
  const storeSetupChecklist = [
    "Store branding, logo, banner, and category",
    "Product listings with photos, variants, and pricing",
    "Business hours, location pin, and contact channels",
    "Lead response SLA and inquiry routing owner",
    "Policies: returns, warranty, and documentation",
    "Trust signals: GST/registration, verified badges, testimonials",
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            {isActive ? "Live on Bromo" : "Inactive"} · {category}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={publicStoreHref}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface)]"
          >
            <Globe className="size-4" />
            View public store
            <ArrowUpRight className="size-3.5" />
          </Link>
          <Link
            href="/dashboard/promotions"
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)]"
          >
            Promote catalog
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardTitle className="text-sm text-[var(--foreground-muted)]">Leads today</CardTitle>
          <p className="mt-2 text-2xl font-semibold">{leadsToday}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">New customer inquiries received today</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-[var(--foreground-muted)]">Open inquiries</CardTitle>
          <p className="mt-2 text-2xl font-semibold">{openInquiries}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Waiting for first response or follow-up</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-[var(--foreground-muted)]">Listed products</CardTitle>
          <p className="mt-2 text-2xl font-semibold">{listedProducts}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Live catalog items visible in app search</p>
        </Card>
        <Card>
          <CardTitle className="text-sm text-[var(--foreground-muted)]">Avg response time</CardTitle>
          <p className="mt-2 text-2xl font-semibold">{avgResponseMins}m</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Target: respond under 30 minutes</p>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <StoreIcon className="size-5 text-[var(--accent)]" />
              Overview
            </span>
          </CardTitle>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--foreground-muted)]">
            {description || "Add a short positioning line in the app so shoppers know what you specialize in."}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
                <MapPin className="size-3.5" /> City
              </dt>
              <dd>{city}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
                <Phone className="size-3.5" /> Phone
              </dt>
              <dd>{phone}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Truck className="size-5 text-emerald-400" />
              Fulfillment
            </span>
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            {hasDelivery
              ? "Delivery flag is on — courier automation lands in a future release. Continue coordinating handoffs in chat for now."
              : "Optimized for local pickup and manual coordination. When you are ready for nationwide shipping, our team enables carriers and inventory sync."}
          </p>
          <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--foreground-muted)]">
            Toggle for online delivery + courier management is off by default. Reach {site.supportEmail} when you need
            it enabled on your tenant.
          </div>
        </Card>

        <Card>
          <CardTitle>
            <span className="flex items-center gap-2">
              <ClipboardList className="size-5 text-[var(--accent)]" />
              Store setup checklist
            </span>
          </CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
            {storeSetupChecklist.map((item) => (
              <li key={item} className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-semibold">Store owner control center</h2>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          This panel is designed for IndiaMART-style commerce where Bromo drives discovery and lead generation while
          store owners close orders offline through calls, chat, and local visits.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-[var(--accent)]" />
              Catalog management
            </CardTitle>
            <CardDescription className="mt-1">
              Add products, variants, MOQ, price ranges, product tags, and media galleries.
            </CardDescription>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={site.appStoreUrl}
                className="inline-flex rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Manage in app
              </a>
              <Link
                href="/dashboard/content"
                className="inline-flex rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Link reels to SKUs
              </Link>
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Handshake className="size-4 text-[var(--accent)]" />
              Lead management
            </CardTitle>
            <CardDescription className="mt-1">
              Track fresh leads, qualified buyers, pending callbacks, and lost opportunities.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Recommended stages: New → Contacted → Negotiating → Won/Lost.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-[var(--accent)]" />
              Inquiry inbox
            </CardTitle>
            <CardDescription className="mt-1">
              Centralize WhatsApp, call-back requests, and product question threads from shoppers.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Enable canned replies, price sheet templates, and follow-up reminders.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-[var(--accent)]" />
              Insights & analytics
            </CardTitle>
            <CardDescription className="mt-1">
              Monitor profile views, product clicks, lead sources, and conversion trends.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Compare organic discovery vs promoted listings to tune budget.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-[var(--accent)]" />
              Team & permissions
            </CardTitle>
            <CardDescription className="mt-1">
              Assign role-based access for owner, catalog manager, sales, and support staff.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Restrict sensitive edits like payouts, brand profile, and store visibility.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4 text-[var(--accent)]" />
              Customer CRM
            </CardTitle>
            <CardDescription className="mt-1">
              Save repeat buyers, maintain notes, and prioritize high-intent customer segments.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Build tags like wholesale, retail, reseller, and enterprise.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="size-4 text-[var(--accent)]" />
              Alerts & automation
            </CardTitle>
            <CardDescription className="mt-1">
              Trigger reminders for unanswered leads, low-stock signals, and campaign windows.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Keep response time healthy with SLA-based escalation rules.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-[var(--accent)]" />
              Commercial settings
            </CardTitle>
            <CardDescription className="mt-1">
              Set payment terms, minimum order values, quote validity, and credit preferences.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Offline settlement supported by direct merchant communication.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-[var(--accent)]" />
              Promotions & visibility
            </CardTitle>
            <CardDescription className="mt-1">
              Promote premium products, featured categories, and seasonal campaigns.
            </CardDescription>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dashboard/promotions"
                className="inline-flex rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Open promotions
              </Link>
              <Link
                href="/dashboard/content"
                className="inline-flex rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Create campaign reel
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
