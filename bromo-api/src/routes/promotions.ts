import { Router, type Response } from "express";
import mongoose from "mongoose";
import { requireVerifiedUser, type FirebaseAuthedRequest } from "../middleware/firebaseAuth.js";
import { requireAdminToken, type AuthedRequest } from "../middleware/authBearer.js";
import { PromotionCampaign } from "../models/PromotionCampaign.js";
import { Post } from "../models/Post.js";
import { Wallet } from "../models/Wallet.js";
import { debitWallet, creditWallet } from "./wallet.js";
import { ContentDeliveryLog } from "../models/ContentDeliveryLog.js";

export const promotionsRouter = Router();

// Minimum budget and reserve (coins) required to activate a campaign
const MIN_BUDGET_COINS = 100;
const ACTIVATION_RESERVE_COINS = 50; // minimum coins available to allow activation
const DELIVERY_FREQ_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── POST /promotions — create draft ─────────────────────────────────────────
promotionsRouter.post("/", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const {
    contentType,
    contentId,
    budgetCoins,
    dailyCapCoins,
    startAt,
    endAt,
    objective,
    audience,
    cta,
  } = req.body as Record<string, unknown>;

  if (!contentType || !contentId || !budgetCoins || !objective) {
    res.status(400).json({ message: "contentType, contentId, budgetCoins, objective required" });
    return;
  }

  if (!["post", "reel", "story"].includes(contentType as string)) {
    res.status(400).json({ message: "contentType must be post | reel | story" });
    return;
  }

  if (Number(budgetCoins) < MIN_BUDGET_COINS) {
    res.status(400).json({ message: `Minimum budget is ${MIN_BUDGET_COINS} Bromo coins` });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(contentId as string)) {
    res.status(400).json({ message: "invalid contentId" });
    return;
  }

  // Verify ownership
  const post = await Post.findOne({ _id: contentId, authorId: req.dbUser!._id }).lean();
  if (!post) {
    res.status(403).json({ message: "Content not found or not owned by you" });
    return;
  }

  const campaign = await PromotionCampaign.create({
    ownerUserId: req.dbUser!._id,
    contentType,
    contentId,
    status: "draft",
    budgetCoins: Number(budgetCoins),
    dailyCapCoins: dailyCapCoins ? Number(dailyCapCoins) : undefined,
    startAt: startAt ? new Date(startAt as string) : new Date(),
    endAt: endAt ? new Date(endAt as string) : undefined,
    objective,
    audience: audience ?? {},
    cta: cta ?? undefined,
  });

  res.status(201).json({ campaign });
});

// ─── POST /promotions/:id/activate ───────────────────────────────────────────
promotionsRouter.post("/:id/activate", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const campaign = await PromotionCampaign.findOne({
    _id: req.params.id,
    ownerUserId: req.dbUser!._id,
  });

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  if (!["draft", "paused"].includes(campaign.status)) {
    res.status(400).json({ message: `Cannot activate a campaign with status: ${campaign.status}` });
    return;
  }

  const remainingBudget = campaign.budgetCoins - campaign.spentCoins;
  if (remainingBudget < ACTIVATION_RESERVE_COINS) {
    res.status(400).json({ message: `Insufficient remaining budget. Need at least ${ACTIVATION_RESERVE_COINS} coins` });
    return;
  }

  // Check wallet balance
  const wallet = await Wallet.findOne({ userId: req.dbUser!._id }).lean();
  const balance = wallet?.bromoCoins ?? 0;
  if (balance < ACTIVATION_RESERVE_COINS) {
    res.status(402).json({ message: `Insufficient wallet balance. Need at least ${ACTIVATION_RESERVE_COINS} Bromo coins to activate` });
    return;
  }

  const uid = req.dbUser!._id as mongoose.Types.ObjectId;
  const cid = campaign._id as mongoose.Types.ObjectId;
  const reserve = await debitWallet(
    uid,
    ACTIVATION_RESERVE_COINS,
    "promotion_reserve",
    "Promotion",
    cid,
    { phase: "activate" },
    `promotion_reserve:${String(cid)}`,
  );
  if (!reserve.success) {
    res.status(402).json({ message: `Insufficient wallet balance. Need at least ${ACTIVATION_RESERVE_COINS} Bromo coins to activate` });
    return;
  }

  campaign.status = "active";
  campaign.startAt = new Date();
  await campaign.save();

  res.json({ ok: true, campaign, balanceAfterReserve: reserve.balance });
});

// ─── POST /promotions/:id/pause ───────────────────────────────────────────────
promotionsRouter.post("/:id/pause", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const campaign = await PromotionCampaign.findOne({
    _id: req.params.id,
    ownerUserId: req.dbUser!._id,
  });

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  if (campaign.status !== "active") {
    res.status(400).json({ message: "Only active campaigns can be paused" });
    return;
  }

  campaign.status = "paused";
  await campaign.save();

  res.json({ ok: true, campaign });
});

// ─── POST /promotions/:id/resume ──────────────────────────────────────────────
promotionsRouter.post("/:id/resume", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const campaign = await PromotionCampaign.findOne({
    _id: req.params.id,
    ownerUserId: req.dbUser!._id,
  });

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  if (campaign.status !== "paused") {
    res.status(400).json({ message: "Only paused campaigns can be resumed" });
    return;
  }

  const wallet = await Wallet.findOne({ userId: req.dbUser!._id }).lean();
  if ((wallet?.bromoCoins ?? 0) < ACTIVATION_RESERVE_COINS) {
    res.status(402).json({ message: "Insufficient wallet balance to resume" });
    return;
  }

  const uid = req.dbUser!._id as mongoose.Types.ObjectId;
  const cid = campaign._id as mongoose.Types.ObjectId;
  await debitWallet(
    uid,
    ACTIVATION_RESERVE_COINS,
    "promotion_reserve",
    "Promotion",
    cid,
    { phase: "resume" },
    `promotion_reserve:${String(cid)}`,
  );

  campaign.status = "active";
  await campaign.save();

  res.json({ ok: true, campaign });
});

// ─── GET /promotions/mine ─────────────────────────────────────────────────────
promotionsRouter.get("/mine", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const campaigns = await PromotionCampaign.find({ ownerUserId: req.dbUser!._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await PromotionCampaign.countDocuments({ ownerUserId: req.dbUser!._id });

  res.json({ campaigns, total, page, hasMore: page * limit < total });
});

// ─── GET /promotions/:id ──────────────────────────────────────────────────────
promotionsRouter.get("/:id", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const campaign = await PromotionCampaign.findOne({
    _id: req.params.id,
    ownerUserId: req.dbUser!._id,
  }).lean();

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  res.json({ campaign });
});

// ─── GET /promotions/:id/analytics ───────────────────────────────────────────
promotionsRouter.get("/:id/analytics", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const campaign = await PromotionCampaign.findOne({
    _id: req.params.id,
    ownerUserId: req.dbUser!._id,
  }).lean();

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  // Daily breakdown from delivery logs (last 14 days)
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const dailyBreakdown = await ContentDeliveryLog.aggregate([
    {
      $match: {
        promotionId: campaign._id,
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          category: "$billingCategory",
        },
        count: { $sum: 1 },
        coinsCharged: { $sum: { $ifNull: ["$coinsCharged", 0] } },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  res.json({
    campaign,
    analytics: {
      promotedImpressions: campaign.promotedImpressions,
      promotedViews: campaign.promotedViews,
      organicViews: campaign.organicViews,
      profileVisits: campaign.profileVisits,
      follows: campaign.follows,
      ctaClicks: campaign.ctaClicks,
      spentCoins: campaign.spentCoins,
      remainingBudget: campaign.budgetCoins - campaign.spentCoins,
      dailyBreakdown,
    },
  });
});

// ─── POST /promotions/:id/log-delivery (internal — called from feed/explore) ─
// Records a delivery event and returns billing category
promotionsRouter.post("/:id/log-delivery", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const { surface, isFollowerOfAuthor, contentAuthorId, kind } = req.body as {
    surface?: string;
    isFollowerOfAuthor?: boolean;
    contentAuthorId?: string;
    kind?: "impression" | "cta_click";
  };

  if (!surface || !contentAuthorId) {
    res.status(400).json({ message: "surface and contentAuthorId required" });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(contentAuthorId)) {
    res.status(400).json({ message: "invalid contentAuthorId" });
    return;
  }

  const deliveryKind = kind === "cta_click" ? "cta_click" : "impression";

  const campaign = await PromotionCampaign.findOne({
    _id: req.params.id,
    status: "active",
  }).lean();

  if (!campaign) {
    res.status(404).json({ message: "Active campaign not found" });
    return;
  }

  const billingCategory =
    deliveryKind === "cta_click"
      ? "promoted"
      : isFollowerOfAuthor && surface === "feed"
        ? "organic"
        : "promoted";

  const capSince = new Date(Date.now() - DELIVERY_FREQ_CAP_WINDOW_MS);
  const duplicateInWindow = await ContentDeliveryLog.exists({
    viewerId: req.dbUser!._id,
    promotionId: campaign._id,
    deliveryKind,
    createdAt: { $gte: capSince },
  });
  if (duplicateInWindow) {
    res.json({ ok: true, billingCategory: "organic", deliveryKind, deduped: true });
    return;
  }

  // Fire-and-forget log creation
  ContentDeliveryLog.create({
    viewerId: req.dbUser!._id,
    contentId: campaign.contentId,
    contentAuthorId: new mongoose.Types.ObjectId(contentAuthorId),
    surface,
    isFollowerOfAuthor: Boolean(isFollowerOfAuthor),
    promotionId: campaign._id,
    billingCategory,
    deliveryKind,
    billed: false,
  }).catch(() => null);

  if (billingCategory === "promoted") {
    if (deliveryKind === "cta_click") {
      PromotionCampaign.updateOne({ _id: campaign._id }, { $inc: { ctaClicks: 1 } }).catch(() => null);
    } else {
      PromotionCampaign.updateOne({ _id: campaign._id }, { $inc: { promotedImpressions: 1 } }).catch(() => null);
    }
  } else {
    PromotionCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { organicViews: 1 } },
    ).catch(() => null);
  }

  res.json({ ok: true, billingCategory, deliveryKind });
});

// ─── Admin: GET /promotions/admin/all ─────────────────────────────────────────
promotionsRouter.get("/admin/all", requireAdminToken as unknown as Parameters<typeof promotionsRouter.get>[1], async (req: AuthedRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const status = req.query.status as string | undefined;
  const limit = 20;

  const filter = status ? { status } : {};
  const campaigns = await PromotionCampaign.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await PromotionCampaign.countDocuments(filter);
  res.json({ campaigns, total, page, hasMore: page * limit < total });
});

// ─── Admin: POST /promotions/admin/:id/approve ───────────────────────────────
promotionsRouter.post("/admin/:id/approve", requireAdminToken as unknown as Parameters<typeof promotionsRouter.post>[1], async (_req: AuthedRequest, res: Response) => {
  const campaign = await PromotionCampaign.findByIdAndUpdate(
    _req.params.id,
    { status: "active", startAt: new Date() },
    { new: true },
  ).lean();

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  res.json({ ok: true, campaign });
});

// ─── Admin: POST /promotions/admin/:id/reject ─────────────────────────────────
promotionsRouter.post("/admin/:id/reject", requireAdminToken as unknown as Parameters<typeof promotionsRouter.post>[1], async (req: AuthedRequest, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const campaign = await PromotionCampaign.findByIdAndUpdate(
    req.params.id,
    { status: "rejected", rejectionReason: reason ?? "Policy violation" },
    { new: true },
  ).lean();

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  res.json({ ok: true, campaign });
});
