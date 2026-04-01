import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSettingsForm } from "@/components/admin/admin-settings-form";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import {
  defaultPlatformSettings,
  mergePlatformSettings,
} from "@/lib/platform-settings";
import type { PlatformSettings } from "@/types/settings";
import { settings as appSettings } from "@/config/settings";

const API_INTERNAL_URL = appSettings.apiInternalUrl;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System · Settings",
};

async function fetchSettings(): Promise<PlatformSettings> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    redirect("/admin/login");
  }

  const res = await fetch(`${API_INTERNAL_URL}/settings`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    return defaultPlatformSettings;
  }
  const raw = (await res.json()) as Partial<PlatformSettings>;
  return mergePlatformSettings(raw);
}

export default async function AdminSystemSettingsPage() {
  const settings = await fetchSettings();
  return <AdminSettingsForm initial={settings} />;
}
