import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await ctx.params;
  const postId = id?.trim();
  const cid = commentId?.trim();
  if (!postId || !cid) {
    return NextResponse.json({ message: "id and commentId required" }, { status: 400 });
  }
  const res = await apiWithAuth(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(cid)}`, {
    method: "DELETE",
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
