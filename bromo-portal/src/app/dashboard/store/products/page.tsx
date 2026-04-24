import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Store products",
};

export default async function StoreProductsPage() {
  const user = await fetchMeServer();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Product manager</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Add and maintain catalog directly from this dashboard for lead generation in Bromo app.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/store/setup"
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
          >
            Store setup
          </Link>
          <Link
            href="/dashboard/store"
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle>Add product</CardTitle>
        <CardDescription>Capture product details shown to buyers in public store and search listings.</CardDescription>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Product name</span>
            <input
              name="title"
              placeholder="Industrial Drill Machine"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Category</span>
            <input
              name="category"
              placeholder="Tools / Machinery"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">Price</span>
            <input
              name="price"
              placeholder="1999"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--foreground-muted)]">MOQ</span>
            <input
              name="moq"
              placeholder="10 units"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-[var(--foreground-muted)]">Product description</span>
            <textarea
              name="description"
              rows={4}
              placeholder="Specs, materials, dimensions, warranty, and delivery note."
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-1"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
            >
              Save product
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
            >
              Add another product
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
