import {authedFetch, apiBase} from './authApi';

export type PromotionStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'completed'
  | 'rejected';

export type PromotionObjective = 'reach' | 'followers' | 'engagement' | 'traffic';
export type PromotionContentType = 'post' | 'reel' | 'story';
export type PromotionPlacement = 'feed' | 'explore' | 'search_top' | 'reels' | 'stories';

export type AudienceTarget = {
  ageMin?: number;
  ageMax?: number;
  genders?: Array<'male' | 'female' | 'other'>;
  locations?: string[];
  languages?: string[];
  interestTags?: string[];
  placements?: PromotionPlacement[];
};

export type CtaConfig = {
  label: string;
  url: string;
};

export type PromotionCampaign = {
  _id: string;
  ownerUserId: string;
  contentType: PromotionContentType;
  contentId: string;
  status: PromotionStatus;
  budgetCoins: number;
  spentCoins: number;
  dailyCapCoins?: number;
  startAt: string;
  endAt?: string;
  objective: PromotionObjective;
  audience: AudienceTarget;
  cta?: CtaConfig;
  rejectionReason?: string;
  promotedImpressions: number;
  promotedViews: number;
  organicViews: number;
  profileVisits: number;
  follows: number;
  ctaClicks: number;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAnalytics = {
  promotedImpressions: number;
  promotedViews: number;
  organicViews: number;
  profileVisits: number;
  follows: number;
  ctaClicks: number;
  spentCoins: number;
  remainingBudget: number;
  dailyBreakdown: Array<{
    _id: {date: string; category: string};
    count: number;
    coinsCharged: number;
  }>;
};

export async function createCampaign(data: {
  contentType: PromotionContentType;
  contentId: string;
  budgetCoins: number;
  dailyCapCoins?: number;
  startAt?: string;
  endAt?: string;
  objective: PromotionObjective;
  audience?: AudienceTarget;
  cta?: CtaConfig;
}): Promise<PromotionCampaign> {
  const res = await authedFetch(`${apiBase()}/promotions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as {message?: string}).message ?? 'Failed to create campaign');
  }
  const json = await res.json();
  return json.campaign;
}

export async function activateCampaign(id: string): Promise<PromotionCampaign> {
  const res = await authedFetch(`${apiBase()}/promotions/${id}/activate`, {method: 'POST'});
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as {message?: string}).message ?? 'Failed to activate campaign');
  }
  return (await res.json()).campaign;
}

export async function pauseCampaign(id: string): Promise<PromotionCampaign> {
  const res = await authedFetch(`${apiBase()}/promotions/${id}/pause`, {method: 'POST'});
  if (!res.ok) throw new Error('Failed to pause campaign');
  return (await res.json()).campaign;
}

export async function resumeCampaign(id: string): Promise<PromotionCampaign> {
  const res = await authedFetch(`${apiBase()}/promotions/${id}/resume`, {method: 'POST'});
  if (!res.ok) throw new Error('Failed to resume campaign');
  return (await res.json()).campaign;
}

export async function getMyCampaigns(page = 1): Promise<{
  campaigns: PromotionCampaign[];
  total: number;
  hasMore: boolean;
}> {
  const res = await authedFetch(`${apiBase()}/promotions/mine?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export async function getCampaignAnalytics(id: string): Promise<{
  campaign: PromotionCampaign;
  analytics: CampaignAnalytics;
}> {
  const res = await authedFetch(`${apiBase()}/promotions/${id}/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}
