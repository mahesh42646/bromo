"use server";

import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import { settings } from "@/config/settings";

const API_INTERNAL_URL = settings.apiInternalUrl;

const SESSION_MAX_AGE = 60 * 60 * 8;

export type LoginState = {
  error: string | null;
  ok?: boolean;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password required" };
  }

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = (await upstream.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
  };

  if (!upstream.ok || !data.token) {
    return { error: data.message ?? "Sign-in failed" };
  }

  const jar = await cookies();
  jar.set(ADMIN_TOKEN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  /** Client performs full navigation so the session cookie is always sent (avoid Edge middleware + 303 quirks). */
  return { error: null, ok: true };
}
