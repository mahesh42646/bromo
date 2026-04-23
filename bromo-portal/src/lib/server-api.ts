import { cookies } from "next/headers";
import { PORTAL_TOKEN_COOKIE } from "@/lib/auth/constants";
import { getApiBase } from "@/lib/env";
import type { DbUser } from "@/types/user";

export async function getPortalToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PORTAL_TOKEN_COOKIE)?.value ?? null;
}

export async function apiWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getPortalToken();
  if (!token) {
    return new Response(JSON.stringify({ message: "Not signed in" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const base = getApiBase();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
}

export async function fetchMeServer(): Promise<DbUser | null> {
  const res = await apiWithAuth("/user-auth/me");
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: DbUser };
  return data.user ?? null;
}
