import type { Metadata } from "next";
import { PromotionsHubClient } from "@/components/dashboard/promotions-hub-client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Promotions",
};

type Campaign = {
  _id: string;
  status?: string;
  budgetCoins?: number;
  spentCoins?: number;
  objective?: string;
  contentType?: string;
};

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ contentId?: string; contentType?: string }>;
}) {
  const { contentId, contentType } = await searchParams;
  const user = await fetchMeServer();
  if (!user) return null;

  const res = await apiWithAuth("/promotions/mine");
  const data = res.ok ? await res.json().catch(() => ({ campaigns: [] })) : { campaigns: [] };
  const campaigns: Campaign[] = Array.isArray(data.campaigns) ? data.campaigns : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns & ads</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Plan paid amplification for posts and reels, steer traffic to your profile, and prepare discount-led store
          pushes — all tied to the same Bromo coin wallet and verification rules as the app.
        </p>
      </div>

      {!res.ok && res.status === 403 ? (
        <Card>
          <CardTitle>Verification required</CardTitle>
          <CardDescription>Confirm your email in the Bromo app to create and activate campaigns.</CardDescription>
        </Card>
      ) : (
        <PromotionsHubClient
          initialCampaigns={campaigns}
          prefilledContentId={contentId}
          prefilledContentType={contentType}
        />
      )}
    </div>
  );
}
