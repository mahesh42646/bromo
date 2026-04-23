"use server";

import { revalidatePath } from "next/cache";
import { apiWithAuth } from "@/lib/server-api";

export async function markAllNotificationsRead(): Promise<void> {
  await apiWithAuth("/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
  revalidatePath("/dashboard/notifications");
}
