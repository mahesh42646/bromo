"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateDraftCaption, type DraftCaptionState } from "@/app/actions/drafts";

const initial: DraftCaptionState = { ok: false };

export function DraftCaptionEditor({ draftId, caption }: { draftId: string; caption: string }) {
  const [state, action, pending] = useActionState(updateDraftCaption, initial);

  return (
    <form action={action} className="space-y-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
      <input type="hidden" name="draftId" value={draftId} />
      <label htmlFor={`cap-${draftId}`} className="sr-only">
        Caption
      </label>
      <textarea
        id={`cap-${draftId}`}
        name="caption"
        rows={3}
        defaultValue={caption}
        className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-foreground)] disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          Save caption
        </button>
        {state.ok ? <span className="text-xs text-[var(--success)]">Saved</span> : null}
        {state.message && !state.ok ? (
          <span className="text-xs text-[var(--destructive)]">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
