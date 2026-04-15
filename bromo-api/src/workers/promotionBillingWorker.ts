/**
 * PromotionBillingWorker
 *
 * Runs on a timer (every 2 minutes in production, every 5 min in dev).
 * - Reads unbilled promoted ContentDeliveryLogs
 * - Applies the rate card (coins per impression)
 * - Debits the campaign owner's wallet
 * - Updates campaign.spentCoins
 * - Pauses campaigns that have exhausted their budget or passed endAt
 * - Marks delivery logs as billed
 */

import mongoose from "mongoose";
import { ContentDeliveryLog } from "../models/ContentDeliveryLog.js";
import { PromotionCampaign } from "../models/PromotionCampaign.js";
import { debitWallet } from "../routes/wallet.js";

// ─── Rate card (coins per event type) ────────────────────────────────────────
const RATE_CARD = {
  impression: 1,     // 1 coin per promoted impression
  view: 2,           // 2 coins per promoted view (>3s dwell)
  click: 5,          // 5 coins per CTA click
  follow: 8,         // 8 coins per follow driven by campaign
} as const;

const BATCH_SIZE = 200;
const RUN_INTERVAL_MS = process.env.NODE_ENV === "production" ? 2 * 60 * 1000 : 5 * 60 * 1000;

let running = false;

async function runBillingCycle(): Promise<void> {
  if (running) return;
  running = true;

  try {
    // Fetch unbilled promoted delivery logs in batches
    const logs = await ContentDeliveryLog.find({ billingCategory: "promoted", billed: false })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (logs.length === 0) {
      await pauseExhaustedCampaigns();
      return;
    }

    // Group by campaignId
    const byCampaign = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!log.promotionId) continue;
      const key = String(log.promotionId);
      if (!byCampaign.has(key)) byCampaign.set(key, []);
      byCampaign.get(key)!.push(log);
    }

    for (const [campaignId, campaignLogs] of byCampaign) {
      const campaign = await PromotionCampaign.findById(campaignId).lean();
      if (!campaign) continue;

      const rates = campaignLogs.map((log) => {
        const k = (log as { deliveryKind?: string }).deliveryKind;
        return k === "cta_click" ? RATE_CARD.click : RATE_CARD.impression;
      });
      const totalToCharge = rates.reduce((a, b) => a + b, 0);
      if (totalToCharge <= 0) continue;

      const remainingBudget = campaign.budgetCoins - campaign.spentCoins;
      const actualCharge = Math.min(totalToCharge, remainingBudget);

      if (actualCharge <= 0) {
        // Budget exhausted — pause campaign
        await PromotionCampaign.updateOne(
          { _id: campaignId, status: "active" },
          { $set: { status: "completed" } },
        );
        // Mark logs as billed (zero charge)
        const logIds = campaignLogs.map((l) => l._id);
        await ContentDeliveryLog.updateMany({ _id: { $in: logIds } }, { billed: true, coinsCharged: 0 });
        continue;
      }

      const idempotencyKey = `promo_bill_${campaignId}_${Date.now()}`;
      const { success } = await debitWallet(
        campaign.ownerUserId as mongoose.Types.ObjectId,
        actualCharge,
        "promotion_spend",
        "Promotion",
        campaign._id as mongoose.Types.ObjectId,
        { campaignId, events: campaignLogs.length },
        idempotencyKey,
      );

      if (!success) {
        // Owner ran out of coins — pause
        await PromotionCampaign.updateOne(
          { _id: campaignId, status: "active" },
          { $set: { status: "paused" } },
        );
        continue;
      }

      // Update campaign.spentCoins
      const newSpent = campaign.spentCoins + actualCharge;
      const budgetExhausted = newSpent >= campaign.budgetCoins;

      await PromotionCampaign.updateOne(
        { _id: campaignId },
        {
          $inc: { spentCoins: actualCharge },
          ...(budgetExhausted ? { $set: { status: "completed" } } : {}),
        },
      );

      // Split charge across logs by weight (impression vs CTA click)
      let remaining = actualCharge;
      for (let i = 0; i < campaignLogs.length; i++) {
        const log = campaignLogs[i]!;
        const weight = rates[i] ?? RATE_CARD.impression;
        const isLast = i === campaignLogs.length - 1;
        const share = isLast ? remaining : Math.max(0, Math.round((actualCharge * weight) / totalToCharge));
        remaining -= share;
        await ContentDeliveryLog.updateOne(
          { _id: log._id },
          { billed: true, coinsCharged: share },
        );
      }
    }

    await pauseExhaustedCampaigns();
  } catch (err) {
    console.error("[promotionBillingWorker] error:", err);
  } finally {
    running = false;
  }
}

async function pauseExhaustedCampaigns(): Promise<void> {
  const now = new Date();
  // Pause campaigns past their endAt date
  await PromotionCampaign.updateMany(
    { status: "active", endAt: { $lte: now } },
    { $set: { status: "completed" } },
  );
  // Pause campaigns that spent >= budget (belt-and-suspenders)
  await PromotionCampaign.updateMany(
    { status: "active", $expr: { $gte: ["$spentCoins", "$budgetCoins"] } },
    { $set: { status: "completed" } },
  );
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPromotionBillingWorker(): void {
  if (timer) return;
  console.log(`[promotionBillingWorker] starting — interval ${RUN_INTERVAL_MS / 1000}s`);
  // Run immediately on start
  runBillingCycle().catch(() => null);
  timer = setInterval(() => {
    runBillingCycle().catch(() => null);
  }, RUN_INTERVAL_MS);
}

export function stopPromotionBillingWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
