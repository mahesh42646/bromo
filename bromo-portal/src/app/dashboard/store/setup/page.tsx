import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Store setup",
};

export default async function StoreSetupPage() {
  const user = await fetchMeServer();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create and setup store</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Configure your storefront directly from web dashboard. Save details, then continue to product creation.
          </p>
        </div>
        <Link
          href="/dashboard/store"
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
        >
          Back to dashboard
        </Link>
      </div>

      <Card>
        <CardTitle>Store profile</CardTitle>
        <CardDescription>These values are shown on your public store page and lead cards.</CardDescription>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Store name</span>
            <input
              name="name"
              placeholder="Example: Mahesh Electronics"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Category</span>
            <input
              name="category"
              placeholder="Electronics, Fashion, Industrial..."
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-[var(--foreground-muted)]">Description</span>
            <textarea
              name="description"
              rows={4}
              placeholder="What you sell, MOQ, key service areas, and why buyers trust you."
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">City</span>
            <input
              name="city"
              placeholder="Ahmedabad"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Phone</span>
            <input
              name="phone"
              placeholder="+91..."
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Business hours</span>
            <input
              name="hours"
              placeholder="Mon-Sat, 10:00-19:00"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Public slug</span>
            <input
              name="slug"
              placeholder="mahesh-electronics"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
            >
              Save store setup
            </button>
            <Link
              href="/dashboard/store/products"
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
            >
              Continue to products
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
