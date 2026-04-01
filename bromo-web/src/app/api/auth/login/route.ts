import { NextResponse } from "next/server";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/cookie";
import { settings } from "@/config/settings";

const API_INTERNAL_URL = settings.apiInternalUrl;

const SESSION_MAX_AGE = 60 * 60 * 8;

function shouldUseSecureCookie(request: Request): boolean {
  const host = new URL(request.url).host.toLowerCase();
  const proto = request.headers.get("x-forwarded-proto")?.toLowerCase() ?? "";
  const isLocalHost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (isLocalHost || proto === "http") return false;
  return process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  const raw: unknown = await request.json().catch(() => null);
  const body =
    raw !== null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ message: "Email and password required" }, { status: 400 });
  }

  const upstream = await fetch(`${API_INTERNAL_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = (await upstream.json().catch(() => ({}))) as {
    token?: string;
    admin?: unknown;
    message?: string;
  };

  if (!upstream.ok || !data.token) {
    return NextResponse.json(
      { message: data.message ?? "Login failed" },
      { status: upstream.status || 401 },
    );
  }

  /** Cookies must be set on `NextResponse`; `cookies().set` + `NextResponse.json` often omits Set-Cookie in the App Router. */
  const response = NextResponse.json(
    { admin: data.admin },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(ADMIN_TOKEN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
