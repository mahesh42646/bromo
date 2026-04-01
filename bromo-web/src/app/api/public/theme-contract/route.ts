import { NextResponse } from "next/server";
import { fetchPublicPlatformSettings } from "@/lib/platform-settings";
import { toRuntimeThemeContract } from "@/lib/theme-provider/theme-contract";

export async function GET() {
  const settings = await fetchPublicPlatformSettings();
  return NextResponse.json(toRuntimeThemeContract(settings), {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}

