import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const type = req.nextUrl.searchParams.get("type")?.trim() || "post";
  const page = req.nextUrl.searchParams.get("page")?.trim() || "1";
  const sort = req.nextUrl.searchParams.get("sort")?.trim() || "latest";
  if (!userId) {
    return NextResponse.json({ message: "userId required" }, { status: 400 });
  }
  const q = new URLSearchParams({
    type,
    page,
    sort,
  });
  const res = await apiWithAuth(`/posts/user/${encodeURIComponent(userId)}?${q}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
