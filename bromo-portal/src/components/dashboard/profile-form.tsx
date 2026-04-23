"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateProfile, type ProfileActionState } from "@/app/actions/profile";
import type { DbUser } from "@/types/user";

const initial: ProfileActionState = { ok: false };

export function ProfileForm({ user }: { user: DbUser }) {
  const [state, action, pending] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="max-w-xl space-y-4">
      {state.message && !state.ok ? (
        <p className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {state.message}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
          Profile saved.
        </p>
      ) : null}
      <div>
        <label htmlFor="displayName" className="text-xs font-medium text-[var(--foreground-muted)]">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={user.displayName}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          required
        />
      </div>
      <div>
        <label htmlFor="bio" className="text-xs font-medium text-[var(--foreground-muted)]">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={user.bio}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div>
        <label htmlFor="website" className="text-xs font-medium text-[var(--foreground-muted)]">
          Website
        </label>
        <input
          id="website"
          name="website"
          type="url"
          defaultValue={user.website}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <div>
        <label htmlFor="phone" className="text-xs font-medium text-[var(--foreground-muted)]">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={user.phone}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save profile
      </button>
      <p className="text-xs text-[var(--foreground-subtle)]">
        Username and privacy flags are still managed in the mobile app today — web focuses on richer text fields.
      </p>
    </form>
  );
}
