import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });
  const res = await apiWithAuth(`/promotions/${encodeURIComponent(id)}/pause`, { method: "POST" });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
