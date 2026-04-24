import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const postId = id?.trim();
  if (!postId) {
    return NextResponse.json({ message: "id required" }, { status: 400 });
  }
  const res = await apiWithAuth(`/posts/${encodeURIComponent(postId)}/permanent`, { method: "DELETE" });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
