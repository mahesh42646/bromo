import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get("page")?.trim() || "1";
  const res = await apiWithAuth(`/notifications?page=${encodeURIComponent(page)}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
