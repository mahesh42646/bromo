"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AffiliateProduct {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  productUrl: string;
  price: number;
  currency: string;
  category: string;
  brand: string;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  title: string;
  description: string;
  imageUrl: string;
  productUrl: string;
  price: string;
  currency: string;
  category: string;
  brand: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  title: "",
  description: "",
  imageUrl: "",
  productUrl: "",
  price: "",
  currency: "INR",
  category: "general",
  brand: "",
  isActive: true,
};

function toForm(p: AffiliateProduct): FormState {
  return {
    title: p.title,
    description: p.description ?? "",
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
    price: String(p.price ?? 0),
    currency: p.currency ?? "INR",
    category: p.category ?? "general",
    brand: p.brand ?? "",
    isActive: p.isActive,
  };
}

export function AdminAffiliateProducts() {
  const [items, setItems] = useState<AffiliateProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AffiliateProduct | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "30" });
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(`/api/admin/products?${qs.toString()}`);
      const data = (await res.json()) as { items?: AffiliateProduct[]; total?: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErr("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setDrawerOpen(true);
  }

  function openEdit(p: AffiliateProduct) {
    setEditing(p);
    setForm(toForm(p));
    setErr(null);
    setDrawerOpen(true);
  }

  async function save() {
    setErr(null);
    if (!form.title.trim() || !form.imageUrl.trim() || !form.productUrl.trim()) {
      setErr("Title, image URL, and product URL are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0 };
      const res = editing
        ? await fetch(`/api/admin/products/${editing._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ message: "Failed" }))) as { message?: string };
        throw new Error(data.message ?? "Failed");
      }
      setDrawerOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: AffiliateProduct) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    const res = await fetch(`/api/admin/products/${p._id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Affiliate Products</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Products users can tag in reels & posts. Links append to caption tail.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" /> New product
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-card border-border relative flex-1 max-w-md rounded-xl border px-3">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, brand, category"
            className="w-full bg-transparent py-2 pl-7 pr-3 text-sm outline-none"
          />
        </div>
        <div className="text-muted-foreground text-xs">{total} total</div>
      </div>

      <div className="bg-card border-border rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No products yet. Click "New product" to add.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p._id} className="border-border border-t">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="size-10 rounded-lg object-cover bg-muted"
                      />
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <a
                          href={p.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground text-xs inline-flex items-center gap-1 hover:text-primary"
                        >
                          {p.productUrl.slice(0, 40)}…
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.brand || "—"}</td>
                  <td className="px-4 py-3">
                    {p.currency} {p.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                        p.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="hover:bg-muted rounded-lg p-2"
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="hover:bg-destructive/10 hover:text-destructive rounded-lg p-2"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Page {page} of {Math.ceil(total / 30)}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="bg-card border-border rounded-lg border px-3 py-1.5 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page * 30 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="bg-card border-border rounded-lg border px-3 py-1.5 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="bg-card border-border fixed right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit product" : "New product"}
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="hover:bg-muted rounded-lg p-2">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Field
                label="Title *"
                value={form.title}
                onChange={(v) => setForm({ ...form, title: v })}
              />
              <Field
                label="Image URL *"
                value={form.imageUrl}
                onChange={(v) => setForm({ ...form, imageUrl: v })}
                placeholder="https://…"
              />
              {form.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imageUrl}
                  alt=""
                  className="h-40 w-40 rounded-xl object-cover bg-muted"
                />
              )}
              <Field
                label="Product URL (affiliate link) *"
                value={form.productUrl}
                onChange={(v) => setForm({ ...form, productUrl: v })}
                placeholder="https://…"
              />
              <Field
                label="Description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                multiline
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Price"
                  value={form.price}
                  onChange={(v) => setForm({ ...form, price: v })}
                  type="number"
                />
                <Field
                  label="Currency"
                  value={form.currency}
                  onChange={(v) => setForm({ ...form, currency: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Brand"
                  value={form.brand}
                  onChange={(v) => setForm({ ...form, brand: v })}
                />
                <Field
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (visible to users in picker)
              </label>
              {err && <div className="text-destructive text-sm">{err}</div>}
              <div className="flex gap-2 pt-2">
                <button
                  disabled={saving}
                  onClick={save}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Save changes" : "Create"}
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="bg-muted hover:bg-muted/80 rounded-xl px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-muted-foreground mb-1.5 text-xs">{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="bg-background border-border focus:border-primary w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
        />
      ) : (
        <input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-background border-border focus:border-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
        />
      )}
    </label>
  );
}
