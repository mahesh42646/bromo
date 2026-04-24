import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit")?.trim() || "12";
  const res = await apiWithAuth(`/users/suggestions?limit=${encodeURIComponent(limit)}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
