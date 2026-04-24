import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jobId = id?.trim();
  if (!jobId) {
    return NextResponse.json({ message: "id required" }, { status: 400 });
  }
  const res = await apiWithAuth(`/media/jobs/${encodeURIComponent(jobId)}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
