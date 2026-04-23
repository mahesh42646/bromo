"use server";

import { revalidatePath } from "next/cache";
import { apiWithAuth } from "@/lib/server-api";

export type ProfileActionState = { ok: boolean; message?: string };

export async function updateProfile(
  _prev: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const res = await apiWithAuth("/user-auth/profile", {
    method: "PATCH",
    body: JSON.stringify({ displayName, bio, website, phone }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message ?? "Update failed" };
  }
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
