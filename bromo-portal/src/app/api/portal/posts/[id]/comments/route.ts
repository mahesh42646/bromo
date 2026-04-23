import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const postId = id?.trim();
  if (!postId) {
    return NextResponse.json({ message: "id required" }, { status: 400 });
  }
  const page = req.nextUrl.searchParams.get("page")?.trim() || "1";
  const q = new URLSearchParams({ page });
  const res = await apiWithAuth(`/posts/${encodeURIComponent(postId)}/comments?${q}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const postId = id?.trim();
  if (!postId) {
    return NextResponse.json({ message: "id required" }, { status: 400 });
  }
  const bodyText = await req.text();
  const res = await apiWithAuth(`/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    body: bodyText || "{}",
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
