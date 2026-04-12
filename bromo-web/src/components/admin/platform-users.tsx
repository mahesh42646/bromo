"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
  UserX,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface UserRow {
  _id: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  profilePicture: string;
  bio: string;
  phone: string;
  provider: "email" | "google";
  isActive: boolean;
  onboardingComplete: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function Avatar({ user }: { user: UserRow }) {
  const initials = (user.displayName || user.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="bg-accent/15 text-accent flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
      {initials}
    </div>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "green" | "red" | "blue" | "gray" | "orange" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
      variant === "green" && "bg-success/15 text-success",
      variant === "red" && "bg-destructive/15 text-destructive",
      variant === "blue" && "bg-accent/15 text-accent",
      variant === "gray" && "bg-muted text-muted-foreground",
      variant === "orange" && "bg-warning/15 text-warning",
    )}>
      {children}
    </span>
  );
}

function DeleteModal({ user, onConfirm, onClose, loading }: {
  user: UserRow;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-sm rounded-2xl border p-6 shadow-xl">
        <h3 className="text-foreground font-semibold">Delete user?</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          This permanently deletes <strong className="text-foreground">{user.displayName}</strong> ({user.email}). This action cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="border-border bg-muted/40 text-foreground flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/70">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ user, onClose, onToggleActive }: {
  user: UserRow;
  onClose: () => void;
  onToggleActive: (u: UserRow) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-overlay fixed inset-0" onClick={onClose} />
      <div className="border-border bg-background brand-surface relative w-full max-w-lg rounded-2xl border shadow-xl">
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-foreground font-semibold">User detail</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-accent/15 text-accent flex size-14 items-center justify-center rounded-2xl text-xl font-bold">
              {(user.displayName || user.email).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-foreground font-semibold">{user.displayName}</p>
              <p className="text-muted-foreground text-sm">@{user.username || "—"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["Email", user.email],
              ["Provider", user.provider],
              ["Phone", user.phone || "—"],
              ["Email verified", user.emailVerified ? "Yes" : "No"],
              ["Status", user.isActive ? "Active" : "Inactive"],
              ["Onboarding", user.onboardingComplete ? "Complete" : "Pending"],
              ["Bio", user.bio || "—"],
              ["Joined", new Date(user.createdAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</dt>
                <dd className="text-foreground mt-0.5 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <button
            onClick={async () => { setToggling(true); await onToggleActive(user); setToggling(false); onClose(); }}
            disabled={toggling}
            className={cn(
              "w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60",
              user.isActive
                ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                : "bg-success/15 text-success hover:bg-success/25",
            )}
          >
            {toggling ? "Updating…" : user.isActive ? "Deactivate account" : "Activate account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlatformUsers() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (provider) params.set("provider", provider);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to load users");
      setData(await res.json() as UsersResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, search, provider, status]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  async function toggleActive(user: UserRow) {
    await fetch(`/api/admin/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    void fetchUsers();
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    await fetch(`/api/admin/users/${deleteUser._id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteUser(null);
    void fetchUsers();
  }

  const stats = data
    ? [
        { label: "Total users", value: data.total, icon: Users, color: "text-accent" },
        { label: "Active", value: data.users.filter((u) => u.isActive).length + (data.total - data.users.length > 0 ? "+" : ""), icon: UserCheck, color: "text-success" },
        { label: "Inactive", value: data.users.filter((u) => !u.isActive).length, icon: UserX, color: "text-destructive" },
        { label: "Pending onboarding", value: data.users.filter((u) => !u.onboardingComplete).length, icon: Ban, color: "text-warning" },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Platform users</h1>
        <p className="text-muted-foreground mt-1 text-sm">End-user directory — live from MongoDB.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border-border bg-muted/30 brand-surface rounded-2xl border p-4 shadow-sm">
            <div className="text-muted-foreground flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              <Icon className={cn("size-4 opacity-70", color)} />
            </div>
            <p className="text-foreground mt-2 text-2xl font-semibold tabular-nums">{loading ? "—" : String(value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="border-border bg-background brand-surface rounded-2xl border p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or username…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border-input bg-background text-foreground placeholder:text-placeholder w-full rounded-xl border py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value); setPage(1); }}
            className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All providers</option>
            <option value="email">Email</option>
            <option value="google">Google</option>
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border-input bg-background text-foreground rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={() => void fetchUsers()}
            className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded-xl border p-2 transition-colors"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <button onClick={() => void fetchUsers()} className="text-accent text-sm underline">Retry</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : !data?.users.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="text-muted-foreground size-10 opacity-40" />
            <p className="text-muted-foreground text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b">
                  {["User", "Email", "Provider", "Status", "Onboarding", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-muted-foreground px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.users.map((user) => (
                  <tr key={user._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedUser(user)} className="flex items-center gap-3 text-left">
                        <Avatar user={user} />
                        <div>
                          <p className="text-foreground font-medium">{user.displayName}</p>
                          <p className="text-muted-foreground text-xs">@{user.username || "no username"}</p>
                        </div>
                      </button>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.provider === "google" ? "blue" : "gray"}>
                        {user.provider}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive ? "green" : "red"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.onboardingComplete ? "green" : "orange"}>
                        {user.onboardingComplete ? "Done" : "Pending"}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/admin/users/manage/${user._id}`}
                          title="Manage profile & content"
                          className="text-muted-foreground hover:text-accent rounded-lg p-1.5 transition-colors"
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                        <button
                          onClick={() => void toggleActive(user)}
                          title={user.isActive ? "Deactivate" : "Activate"}
                          className={cn(
                            "rounded-lg p-1.5 transition-colors",
                            user.isActive
                              ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              : "text-muted-foreground hover:bg-success/10 hover:text-success",
                          )}
                        >
                          {user.isActive ? <UserX className="size-4" /> : <CheckCircle2 className="size-4" />}
                        </button>
                        <button
                          onClick={() => setDeleteUser(user)}
                          title="Delete user"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-1.5 transition-colors"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="border-border flex items-center justify-between border-t px-4 py-3">
            <span className="text-muted-foreground text-xs">
              Page {data.page} of {data.pages} · {data.total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded-lg border p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pages}
                className="border-border bg-muted/40 text-muted-foreground hover:text-foreground rounded-lg border p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleActive={toggleActive}
        />
      )}
      {deleteUser && (
        <DeleteModal
          user={deleteUser}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteUser(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
