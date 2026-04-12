"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type UserRow = {
  _id: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  profilePicture: string;
  bio: string;
  phone: string;
  website: string;
  provider: "email" | "google";
  isActive: boolean;
  isPrivate: boolean;
  onboardingComplete: boolean;
  createdAt: string;
};

type ContentPost = {
  _id: string;
  type: "post" | "reel" | "story";
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
  caption?: string;
  location?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
};

function isVideoUrl(url: string): boolean {
  const u = url.split("?")[0]?.toLowerCase() ?? "";
  return [".mp4", ".mov", ".webm", ".m4v", ".3gp", ".mkv", ".avi", ".mpeg", ".mpg"].some((x) => u.endsWith(x));
}

export function AdminUserManager({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "post" | "reel" | "story">("all");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [contentReloadKey, setContentReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editPost, setEditPost] = useState<ContentPost | null>(null);
  const [deletePost, setDeletePost] = useState<ContentPost | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const [draftProfile, setDraftProfile] = useState({
    displayName: "",
    bio: "",
    username: "",
    profilePicture: "",
    website: "",
    phone: "",
    isPrivate: false,
    isActive: true,
  });
  const [draftCaption, setDraftCaption] = useState("");

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((data as { message?: string }).message ?? "Failed to load user");
      setUser(null);
    } else {
      const u = data as UserRow;
      setUser(u);
      setDraftProfile({
        displayName: u.displayName ?? "",
        bio: u.bio ?? "",
        username: u.username ?? "",
        profilePicture: u.profilePicture ?? "",
        website: u.website ?? "",
        phone: u.phone ?? "",
        isPrivate: Boolean(u.isPrivate),
        isActive: Boolean(u.isActive),
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setContentLoading(true);
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("limit", "24");
      if (typeFilter !== "all") qs.set("type", typeFilter);
      if (includeDeleted) qs.set("includeDeleted", "true");
      const res = await fetch(`/api/admin/users/${userId}/content?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && res.ok) {
        setPosts((data as { posts: ContentPost[] }).posts ?? []);
        setPage((data as { page?: number }).page ?? 1);
        setPages((data as { pages?: number }).pages ?? 1);
        setTotal((data as { total?: number }).total ?? 0);
      }
      if (!cancelled) setContentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userId, page, typeFilter, includeDeleted, contentReloadKey]);

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: draftProfile.displayName,
        bio: draftProfile.bio,
        username: draftProfile.username || undefined,
        profilePicture: draftProfile.profilePicture,
        website: draftProfile.website,
        phone: draftProfile.phone,
        isPrivate: draftProfile.isPrivate,
        isActive: draftProfile.isActive,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { message?: string }).message ?? "Update failed");
      return;
    }
    setEditUserOpen(false);
    void loadUser();
  }

  async function savePostCaption() {
    if (!editPost) return;
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${editPost._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: draftCaption }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { message?: string }).message ?? "Update failed");
      return;
    }
    setEditPost(null);
    setContentReloadKey((k) => k + 1);
  }

  async function confirmDeletePost() {
    if (!deletePost) return;
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${deletePost._id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permanent: permanentDelete }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { message?: string }).message ?? "Delete failed");
      return;
    }
    setDeletePost(null);
    setContentReloadKey((k) => k + 1);
    void loadUser();
  }

  async function restorePost(p: ContentPost) {
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${p._id}/restore`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { message?: string }).message ?? "Restore failed");
      return;
    }
    setContentReloadKey((k) => k + 1);
    void loadUser();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users/manage" className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <p className="text-destructive text-sm">{error ?? "User not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/users/manage" className="text-muted-foreground mb-3 inline-flex items-center gap-2 text-sm hover:text-foreground">
            <ArrowLeft className="size-4" /> User management
          </Link>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{user.displayName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            @{user.username || "no-username"} · {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditUserOpen(true)}
          className="border-border bg-muted/40 text-foreground hover:bg-muted/60 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium"
        >
          <Pencil className="size-4" /> Edit profile
        </button>
      </div>

      <div className="border-border bg-muted/20 grid gap-6 rounded-2xl border p-6 md:grid-cols-[200px_1fr]">
        <div className="space-y-2">
          {user.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profilePicture} alt="" className="border-border aspect-square w-full rounded-2xl border object-cover" />
          ) : (
            <div className="bg-muted flex aspect-square w-full items-center justify-center rounded-2xl text-4xl font-bold text-muted-foreground">
              {user.displayName.slice(0, 1)}
            </div>
          )}
          <p className="text-muted-foreground text-xs">Profile image URL is editable in “Edit profile”.</p>
        </div>
        <div className="text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt className="text-muted-foreground text-xs uppercase">Provider</dt><dd className="font-medium">{user.provider}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase">Status</dt><dd className="font-medium">{user.isActive ? "Active" : "Inactive"}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase">Private</dt><dd className="font-medium">{user.isPrivate ? "Yes" : "No"}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase">Joined</dt><dd className="font-medium">{new Date(user.createdAt).toLocaleString()}</dd></div>
          </dl>
          {user.bio ? <p className="text-muted-foreground mt-4 border-t pt-4">{user.bio}</p> : null}
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground text-lg font-semibold">Content ({total})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }}
              className="border-input bg-background rounded-xl border px-3 py-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="post">Posts</option>
              <option value="reel">Reels</option>
              <option value="story">Stories</option>
            </select>
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }} />
              Show deleted
            </label>
            <button type="button" onClick={() => setContentReloadKey((k) => k + 1)} className="border-border rounded-xl border p-2">
              <RefreshCw className={cn("size-4", contentLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {contentLoading && !posts.length ? (
          <div className="flex justify-center py-12">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <div key={p._id} className="border-border bg-background overflow-hidden rounded-2xl border shadow-sm">
                <div className="bg-muted relative aspect-square">
                  {p.mediaType === "video" || isVideoUrl(p.mediaUrl) ? (
                    <video src={p.mediaUrl} className="size-full object-cover" controls playsInline muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnailUrl || p.mediaUrl} alt="" className="size-full object-cover" />
                  )}
                  {p.isDeleted ? (
                    <span className="bg-destructive/90 text-destructive-foreground absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase">
                      Deleted
                    </span>
                  ) : null}
                  <span className="bg-background/80 absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {p.type}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-muted-foreground line-clamp-2 text-xs">{p.caption || "—"}</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => { setDraftCaption(p.caption ?? ""); setEditPost(p); }}
                      className="border-border text-foreground hover:bg-muted/60 rounded-lg border px-2 py-1 text-xs font-medium"
                    >
                      Edit
                    </button>
                    {p.isDeleted ? (
                      <button
                        type="button"
                        onClick={() => void restorePost(p)}
                        disabled={busy}
                        className="border-border text-success hover:bg-success/10 rounded-lg border px-2 py-1 text-xs font-medium"
                      >
                        <RotateCcw className="mr-1 inline size-3" /> Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setPermanentDelete(false); setDeletePost(p); }}
                        disabled={busy}
                        className="border-border text-destructive hover:bg-destructive/10 rounded-lg border px-2 py-1 text-xs font-medium"
                      >
                        <Trash2 className="mr-1 inline size-3" /> Delete…
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 ? (
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-border rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-muted-foreground self-center text-sm">
              Page {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="border-border rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {editUserOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="bg-overlay fixed inset-0" aria-label="Close" onClick={() => setEditUserOpen(false)} />
          <div className="border-border bg-background relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <h3 className="text-foreground font-semibold">Edit user</h3>
            <div className="mt-4 space-y-3">
              {(["displayName", "username", "profilePicture", "website", "phone", "bio"] as const).map((field) => (
                <label key={field} className="block text-sm">
                  <span className="text-muted-foreground text-xs uppercase">{field}</span>
                  {field === "bio" ? (
                    <textarea
                      value={draftProfile[field]}
                      onChange={(e) => setDraftProfile((d) => ({ ...d, bio: e.target.value }))}
                      rows={3}
                      className="border-input bg-background mt-1 w-full rounded-xl border px-3 py-2"
                    />
                  ) : (
                    <input
                      value={draftProfile[field]}
                      onChange={(e) => setDraftProfile((d) => ({ ...d, [field]: e.target.value }))}
                      className="border-input bg-background mt-1 w-full rounded-xl border px-3 py-2"
                    />
                  )}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draftProfile.isPrivate} onChange={(e) => setDraftProfile((d) => ({ ...d, isPrivate: e.target.checked }))} />
                Private account
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draftProfile.isActive} onChange={(e) => setDraftProfile((d) => ({ ...d, isActive: e.target.checked }))} />
                Active (can sign in)
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setEditUserOpen(false)} className="border-border flex-1 rounded-xl border py-2 text-sm">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void saveProfile()} className="bg-primary text-primary-foreground flex-1 rounded-xl py-2 text-sm font-medium disabled:opacity-50">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editPost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="bg-overlay fixed inset-0" aria-label="Close" onClick={() => setEditPost(null)} />
          <div className="border-border bg-background relative w-full max-w-md rounded-2xl border p-6 shadow-xl">
            <h3 className="text-foreground font-semibold">Edit caption</h3>
            <textarea
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
              rows={5}
              className="border-input bg-background mt-3 w-full rounded-xl border px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditPost(null)} className="border-border flex-1 rounded-xl border py-2 text-sm">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void savePostCaption()} className="bg-primary text-primary-foreground flex-1 rounded-xl py-2 text-sm font-medium">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletePost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="bg-overlay fixed inset-0" aria-label="Close" onClick={() => setDeletePost(null)} />
          <div className="border-border bg-background relative w-full max-w-md rounded-2xl border p-6 shadow-xl">
            <h3 className="text-foreground font-semibold">Delete content</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Soft delete hides the item and keeps files on disk (you can restore). Permanent delete removes the MongoDB document and deletes media files from the server.
            </p>
            <label className="text-foreground mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={permanentDelete} onChange={(e) => setPermanentDelete(e.target.checked)} />
              Delete permanently (remove DB row + files)
            </label>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setDeletePost(null)} className="border-border flex-1 rounded-xl border py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmDeletePost()}
                className="bg-destructive text-destructive-foreground flex-1 rounded-xl py-2 text-sm font-medium disabled:opacity-50"
              >
                {permanentDelete ? "Delete forever" : "Soft delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
