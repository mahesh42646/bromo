import { cookies } from "next/headers";
import { getApiBase } from "@/lib/env";

export const ADMIN_TOKEN_COOKIE = "bromo_admin_token";

export async function getAdminToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}

export async function adminApi(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAdminToken();
  if (!token) {
    return new Response(JSON.stringify({ message: "Admin not signed in" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${getApiBase()}${path}`, { ...init, headers, cache: "no-store" });
}

export async function fetchAdminMe(): Promise<{ id: string; email: string; name: string; role: "admin" | "super_admin" } | null> {
  const res = await adminApi("/auth/me");
  if (!res.ok) return null;
  return (await res.json()) as { id: string; email: string; name: string; role: "admin" | "super_admin" };
}
