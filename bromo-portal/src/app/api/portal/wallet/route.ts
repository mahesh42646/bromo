import { NextResponse } from "next/server";
import { apiWithAuth } from "@/lib/server-api";

export async function GET() {
  const res = await apiWithAuth("/wallet");
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
