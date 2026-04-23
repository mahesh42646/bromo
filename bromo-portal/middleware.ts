import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PORTAL_TOKEN_COOKIE } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!request.cookies.get(PORTAL_TOKEN_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
