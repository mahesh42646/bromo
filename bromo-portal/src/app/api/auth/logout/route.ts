import { NextResponse } from "next/server";
import { PORTAL_TOKEN_COOKIE } from "@/lib/auth/constants";

function shouldUseSecureCookie(request: Request): boolean {
  const host = new URL(request.url).host.toLowerCase();
  const proto = request.headers.get("x-forwarded-proto")?.toLowerCase() ?? "";
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (isLocalHost || proto === "http") return false;
  return process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 0,
  });
  return res;
}
