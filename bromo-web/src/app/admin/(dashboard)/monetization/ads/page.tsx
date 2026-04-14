import type { Metadata } from "next";
import { AdminAds } from "@/components/admin/admin-ads";
import { settings } from "@/config/settings";
import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";

export const metadata: Metadata = { title: "Ads manager" };

async function getInitialAds() {
  try {
    const jar = await cookies();
    const token = jar.get(ADMIN_TOKEN_COOKIE)?.value;
    if (!token) return [];
    const res = await fetch(`${settings.apiInternalUrl}/admin/ads?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json() as { ads?: unknown[] };
    return data.ads ?? [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const initialAds = await getInitialAds();
  return <AdminAds initialAds={initialAds as Parameters<typeof AdminAds>[0]["initialAds"]} />;
}
