import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const category = req.nextUrl.searchParams.get("category")?.trim();
  const limit = req.nextUrl.searchParams.get("limit")?.trim() || "12";
  const qs = new URLSearchParams({ limit });
  if (q) qs.set("q", q);
  if (category) qs.set("category", category);
  const res = await apiWithAuth(`/products?${qs.toString()}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
