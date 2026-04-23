import { NextResponse } from "next/server";
import { PORTAL_TOKEN_COOKIE } from "@/lib/auth/constants";
import { getApiBase } from "@/lib/env";
import { verifyFirebaseIdTokenIfConfigured } from "@/lib/firebase/admin";

const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

function shouldUseSecureCookie(request: Request): boolean {
  const host = new URL(request.url).host.toLowerCase();
  const proto = request.headers.get("x-forwarded-proto")?.toLowerCase() ?? "";
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (isLocalHost || proto === "http") return false;
  return process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }
  const body = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    return NextResponse.json({ message: "idToken required" }, { status: 400 });
  }

  const tokenOk = await verifyFirebaseIdTokenIfConfigured(idToken);
  if (!tokenOk) {
    return NextResponse.json({ message: "Invalid or expired Firebase token" }, { status: 401 });
  }

  let apiBase: string;
  try {
    apiBase = getApiBase();
  } catch {
    return NextResponse.json({ message: "Server misconfigured" }, { status: 500 });
  }

  const upstream = await fetch(`${apiBase}/user-auth/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });

  const data = (await upstream.json().catch(() => ({}))) as {
    user?: unknown;
    message?: string;
    needsRegistration?: boolean;
  };

  if (upstream.status === 404 && data.needsRegistration) {
    return NextResponse.json({ needsRegistration: true }, { status: 428 });
  }

  if (!upstream.ok || !data.user) {
    return NextResponse.json(
      { message: data.message ?? "Session validation failed" },
      { status: upstream.status === 404 ? 401 : upstream.status || 401 },
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(PORTAL_TOKEN_COOKIE, idToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
