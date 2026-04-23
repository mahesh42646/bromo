"use server";

import { revalidatePath } from "next/cache";
import { apiWithAuth } from "@/lib/server-api";

export type DraftCaptionState = { ok: boolean; message?: string };

export async function updateDraftCaption(
  _prev: DraftCaptionState | undefined,
  formData: FormData,
): Promise<DraftCaptionState> {
  const id = String(formData.get("draftId") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  if (!id) return { ok: false, message: "Missing draft" };

  const res = await apiWithAuth(`/drafts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ caption }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message ?? "Could not update draft" };
  }
  revalidatePath("/dashboard/content");
  return { ok: true };
}
