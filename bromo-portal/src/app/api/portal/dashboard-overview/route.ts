import { type NextRequest, NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET(req: NextRequest) {
  const chartRange = req.nextUrl.searchParams.get("chartRange")?.trim() || "30d";
  const res = await apiWithAuth(`/dashboard/overview?chartRange=${encodeURIComponent(chartRange)}`);
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
