import type { Metadata } from "next";
import { CampaignsWorkspaceClient } from "@/components/dashboard/campaigns-workspace-client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { apiWithAuth, fetchMeServer } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Promotions",
};

type CampaignRow = {
  _id: string;
  status?: string;
  budgetCoins?: number;
  spentCoins?: number;
  objective?: string;
  contentType?: string;
  contentId?: string;
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
  const campaigns: CampaignRow[] = Array.isArray(data.campaigns) ? data.campaigns : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns & ads</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          List every campaign, create a new one by choosing your content from a normal list, then open a campaign to
          start, pause, or resume it.
        </p>
      </div>

      {!res.ok && res.status === 403 ? (
        <Card>
          <CardTitle>Verification required</CardTitle>
          <CardDescription>Confirm your email in the Bromo app to manage campaigns.</CardDescription>
        </Card>
      ) : (
        <CampaignsWorkspaceClient
          userId={user._id}
          initialCampaigns={campaigns}
          initialContentId={contentId}
          initialContentType={contentType}
        />
      )}
    </div>
  );
}
