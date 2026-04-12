"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function AdminUserManageHubPage() {
  const router = useRouter();
  const [id, setId] = useState("");

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <Link href="/admin/users/platform" className="text-muted-foreground mb-4 inline-flex items-center gap-2 text-sm hover:text-foreground">
          <ArrowLeft className="size-4" /> Platform users
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">User management</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Enter a MongoDB user id (from Platform users or your database). You can open a user directly from the platform directory with &quot;Manage&quot;.
        </p>
      </div>
      <form
        className="border-border bg-background space-y-4 rounded-2xl border p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const v = id.trim();
          if (v) router.push(`/admin/users/manage/${v}`);
        }}
      >
        <label className="block text-sm font-medium">
          User ID
          <div className="relative mt-2">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. 674a…"
              className="border-input bg-background placeholder:text-placeholder w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </label>
        <button type="submit" className="bg-primary text-primary-foreground w-full rounded-xl py-2.5 text-sm font-semibold">
          Open user
        </button>
      </form>
    </div>
  );
}
