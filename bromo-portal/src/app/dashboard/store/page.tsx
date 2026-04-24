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

  const mineRes = await apiWithAuth("/stores/mine");
  const json = mineRes.ok ? await mineRes.json().catch(() => null) : null;
  let store =
    json && typeof json === "object" && json !== null && "store" in json
      ? (json as { store: Record<string, unknown> }).store
      : null;

  if (!store && user.storeId && mineRes.status === 404) {
    const sid = encodeURIComponent(String(user.storeId));
    const byId = await apiWithAuth(`/stores/${sid}`);
    if (byId.ok) {
      const j2 = await byId.json().catch(() => null);
      const s =
        j2 && typeof j2 === "object" && j2 !== null && "store" in j2
          ? (j2 as { store: Record<string, unknown> }).store
          : null;
      if (s && String(s.owner ?? "") === String(user._id)) {
        store = s;
      }
    }
  }

  if (!mineRes.ok && mineRes.status === 403) {
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
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Store admin dashboard</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--foreground-muted)]">
              No store is connected yet. Set up your storefront once, add products, and start receiving buyer leads in
              Bromo. Delivery is optional; your team can close orders offline via calls, chat, or direct visits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/store/setup"
              className="inline-flex items-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)]"
            >
              Create store in dashboard
            </Link>
            <Link
              href="/store"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface)]"
            >
              View public store page
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardTitle>
              <span className="text-sm text-[var(--foreground-muted)]">Store status</span>
            </CardTitle>
            <p className="mt-2 text-2xl font-semibold">Not created</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Create your store profile to unlock catalog and leads</p>
          </Card>
          <Card>
            <CardTitle>
              <span className="text-sm text-[var(--foreground-muted)]">Catalog readiness</span>
            </CardTitle>
            <p className="mt-2 text-2xl font-semibold">0 products</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Add products with price, MOQ, and media</p>
          </Card>
          <Card>
            <CardTitle>
              <span className="text-sm text-[var(--foreground-muted)]">Lead inbox</span>
            </CardTitle>
            <p className="mt-2 text-2xl font-semibold">Locked</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Goes live after store setup is complete</p>
          </Card>
          <Card>
            <CardTitle>
              <span className="text-sm text-[var(--foreground-muted)]">Public storefront</span>
            </CardTitle>
            <p className="mt-2 text-2xl font-semibold">Draft</p>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">Publish profile to appear in app discovery</p>
          </Card>
        </section>

        <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-semibold">Admin onboarding controls</h2>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Complete these admin actions to launch your store operations dashboard.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
              <CardTitle>
                <span className="flex items-center gap-2 text-base">
                  <StoreIcon className="size-4 text-[var(--accent)]" />
                  1) Create store profile
                </span>
              </CardTitle>
              <CardDescription>Set business name, category, description, city, phone, and working hours.</CardDescription>
              <Link
                href="/dashboard/store/setup"
                className="mt-4 inline-flex w-fit rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Open setup form
              </Link>
            </Card>

            <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
              <CardTitle>
                <span className="flex items-center gap-2 text-base">
                  <Package className="size-4 text-[var(--accent)]" />
                  2) Add products
                </span>
              </CardTitle>
              <CardDescription>Add SKUs, pricing slabs, MOQ, variants, and product photos.</CardDescription>
              <Link
                href="/dashboard/store/products"
                className="mt-4 inline-flex w-fit rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Open product manager
              </Link>
            </Card>

            <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
              <CardTitle>
                <span className="flex items-center gap-2 text-base">
                  <Handshake className="size-4 text-[var(--accent)]" />
                  3) Enable lead flow
                </span>
              </CardTitle>
              <CardDescription>Set inquiry owner, response SLA, and callback preferences for your team.</CardDescription>
              <p className="mt-4 text-xs text-[var(--foreground-muted)]">Recommended SLA: first response under 30 minutes.</p>
            </Card>

            <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
              <CardTitle>
                <span className="flex items-center gap-2 text-base">
                  <Globe className="size-4 text-[var(--accent)]" />
                  4) Publish public page
                </span>
              </CardTitle>
              <CardDescription>Your store page becomes visible in Bromo search and product discovery.</CardDescription>
              <Link
                href="/store"
                target="_blank"
                className="mt-4 inline-flex w-fit rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Preview storefront
              </Link>
            </Card>

            <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
              <CardTitle>
                <span className="flex items-center gap-2 text-base">
                  <MessageSquare className="size-4 text-[var(--accent)]" />
                  5) Handle inquiries
                </span>
              </CardTitle>
              <CardDescription>Manage buyer messages, call requests, quotations, and follow-up reminders.</CardDescription>
              <p className="mt-4 text-xs text-[var(--foreground-muted)]">Pipeline: New → Contacted → Negotiating → Won/Lost.</p>
            </Card>

            <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
              <CardTitle>
                <span className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4 text-[var(--accent)]" />
                  6) Track performance
                </span>
              </CardTitle>
              <CardDescription>Measure product views, inquiry rate, response time, and conversion to offline sales.</CardDescription>
              <Link
                href="/dashboard/promotions"
                className="mt-4 inline-flex w-fit rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)]"
              >
                Open promotion tools
              </Link>
            </Card>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-[var(--hairline)] bg-[var(--surface)]/60 p-8 text-center">
          <Sparkles className="mx-auto size-10 text-[var(--accent)]" />
          <h2 className="mt-4 text-lg font-semibold">After store creation, full admin dashboard unlocks here</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--foreground-muted)]">
            Once your store exists, this page automatically switches to live admin mode with catalog metrics, lead inbox,
            CRM controls, promotion center, and a direct public-store link.
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
          <CardTitle>
            <span className="text-sm text-[var(--foreground-muted)]">Leads today</span>
          </CardTitle>
          <p className="mt-2 text-2xl font-semibold">{leadsToday}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">New customer inquiries received today</p>
        </Card>
        <Card>
          <CardTitle>
            <span className="text-sm text-[var(--foreground-muted)]">Open inquiries</span>
          </CardTitle>
          <p className="mt-2 text-2xl font-semibold">{openInquiries}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Waiting for first response or follow-up</p>
        </Card>
        <Card>
          <CardTitle>
            <span className="text-sm text-[var(--foreground-muted)]">Listed products</span>
          </CardTitle>
          <p className="mt-2 text-2xl font-semibold">{listedProducts}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Live catalog items visible in app search</p>
        </Card>
        <Card>
          <CardTitle>
            <span className="text-sm text-[var(--foreground-muted)]">Avg response time</span>
          </CardTitle>
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
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <Package className="size-4 text-[var(--accent)]" />
                Catalog management
              </span>
            </CardTitle>
            <CardDescription>
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
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <Handshake className="size-4 text-[var(--accent)]" />
                Lead management
              </span>
            </CardTitle>
            <CardDescription>
              Track fresh leads, qualified buyers, pending callbacks, and lost opportunities.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Recommended stages: New → Contacted → Negotiating → Won/Lost.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4 text-[var(--accent)]" />
                Inquiry inbox
              </span>
            </CardTitle>
            <CardDescription>
              Centralize WhatsApp, call-back requests, and product question threads from shoppers.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Enable canned replies, price sheet templates, and follow-up reminders.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-[var(--accent)]" />
                Insights & analytics
              </span>
            </CardTitle>
            <CardDescription>
              Monitor profile views, product clicks, lead sources, and conversion trends.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Compare organic discovery vs promoted listings to tune budget.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <Users className="size-4 text-[var(--accent)]" />
                Team & permissions
              </span>
            </CardTitle>
            <CardDescription>
              Assign role-based access for owner, catalog manager, sales, and support staff.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Restrict sensitive edits like payouts, brand profile, and store visibility.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <UserCheck className="size-4 text-[var(--accent)]" />
                Customer CRM
              </span>
            </CardTitle>
            <CardDescription>
              Save repeat buyers, maintain notes, and prioritize high-intent customer segments.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Build tags like wholesale, retail, reseller, and enterprise.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <BellRing className="size-4 text-[var(--accent)]" />
                Alerts & automation
              </span>
            </CardTitle>
            <CardDescription>
              Trigger reminders for unanswered leads, low-stock signals, and campaign windows.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Keep response time healthy with SLA-based escalation rules.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <Wallet className="size-4 text-[var(--accent)]" />
                Commercial settings
              </span>
            </CardTitle>
            <CardDescription>
              Set payment terms, minimum order values, quote validity, and credit preferences.
            </CardDescription>
            <div className="mt-4 text-xs text-[var(--foreground-muted)]">
              Offline settlement supported by direct merchant communication.
            </div>
          </Card>

          <Card className="border-[var(--hairline)] bg-[var(--surface)]/50">
            <CardTitle>
              <span className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-[var(--accent)]" />
                Promotions & visibility
              </span>
            </CardTitle>
            <CardDescription>
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
