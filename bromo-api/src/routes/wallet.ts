import { Router, type Response } from "express";
import { requireVerifiedUser, type FirebaseAuthedRequest } from "../middleware/firebaseAuth.js";
import { resolveActiveAdminFromRequest } from "../middleware/authBearer.js";
import { Wallet } from "../models/Wallet.js";
import { WalletLedger } from "../models/WalletLedger.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

export const walletRouter = Router();

// ─── GET /wallet — current user's balance + recent ledger ────────────────────
walletRouter.get("/", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  const userId = req.dbUser!._id;

  const [wallet, ledger] = await Promise.all([
    Wallet.findOne({ userId }).lean(),
    WalletLedger.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  res.json({
    balance: wallet?.bromoCoins ?? 0,
    ledger: ledger.map((l) => ({
      _id: String(l._id),
      delta: l.delta,
      balanceAfter: l.balanceAfter,
      reason: l.reason,
      refType: l.refType,
      refId: l.refId ? String(l.refId) : undefined,
      meta: l.meta,
      createdAt: l.createdAt,
    })),
  });
});

// ─── POST /wallet/topup — dummy top-up (dev / admin only) ────────────────────
// Protected by dev flag (NODE_ENV !== production) OR admin token
walletRouter.post("/topup", async (req, res: Response) => {
  const allowDevTopup =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_WALLET_TOPUP === "1";

  let userId: mongoose.Types.ObjectId | null = null;

  if (allowDevTopup) {
    const { userId: rawUid, coins } = req.body as { userId?: string; coins?: number };
    if (!rawUid || !mongoose.Types.ObjectId.isValid(rawUid)) {
      res.status(400).json({ message: "userId required" });
      return;
    }
    userId = new mongoose.Types.ObjectId(rawUid);
    const coinsToAdd = Math.max(1, Math.min(100_000, Number(coins) || 1000));
    await creditWallet(userId, coinsToAdd, "topup", undefined, undefined, { source: "dev_topup" });
    const wallet = await Wallet.findOne({ userId }).lean();
    res.json({ ok: true, balance: wallet?.bromoCoins ?? 0 });
    return;
  }

  const admin = await resolveActiveAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ message: "Active admin token required in production" });
    return;
  }

  const { userId: rawUid, coins } = req.body as { userId?: string; coins?: number };
  if (!rawUid || !mongoose.Types.ObjectId.isValid(rawUid)) {
    res.status(400).json({ message: "userId required" });
    return;
  }
  const userExists = await User.exists({ _id: rawUid });
  if (!userExists) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  userId = new mongoose.Types.ObjectId(rawUid);
  const coinsToAdd = Math.max(1, Math.min(10_000_000, Number(coins) || 1000));
  await creditWallet(userId, coinsToAdd, "topup", undefined, undefined, { source: "admin_topup" });
  const wallet = await Wallet.findOne({ userId }).lean();
  res.json({ ok: true, balance: wallet?.bromoCoins ?? 0 });
});

// ─── POST /wallet/self-topup — authenticated user buys coins (dummy gateway) ─
walletRouter.post("/self-topup", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DUMMY_SELF_TOPUP !== "1") {
    res.status(403).json({ message: "Self top-up requires a payment provider in production" });
    return;
  }

  const { coins, packageId } = req.body as { coins?: number; packageId?: string };
  const PACKAGES: Record<string, number> = {
    starter: 500,
    pro: 2000,
    creator: 5000,
    elite: 15000,
  };

  let amount: number;
  if (packageId && PACKAGES[packageId]) {
    amount = PACKAGES[packageId];
  } else if (coins && Number(coins) > 0) {
    amount = Math.min(50_000, Math.max(100, Number(coins)));
  } else {
    res.status(400).json({ message: "Provide packageId (starter|pro|creator|elite) or coins amount" });
    return;
  }

  await creditWallet(
    req.dbUser!._id as mongoose.Types.ObjectId,
    amount,
    "topup",
    undefined,
    undefined,
    { source: "self_topup", packageId },
  );

  const wallet = await Wallet.findOne({ userId: req.dbUser!._id }).lean();
  res.json({ ok: true, balance: wallet?.bromoCoins ?? 0, credited: amount });
});

// ─── Shared wallet helpers ─────────────────────────────────────────────────────
export async function creditWallet(
  userId: mongoose.Types.ObjectId,
  amount: number,
  reason: WalletLedger["reason"],
  refType?: "Promotion" | "Admin",
  refId?: mongoose.Types.ObjectId,
  meta?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<number> {
  if (idempotencyKey) {
    const exists = await WalletLedger.exists({ idempotencyKey });
    if (exists) {
      const w = await Wallet.findOne({ userId }).lean();
      return w?.bromoCoins ?? 0;
    }
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { bromoCoins: amount } },
    { upsert: true, new: true },
  ).lean();

  const balance = wallet?.bromoCoins ?? amount;
  await WalletLedger.create({
    userId,
    delta: amount,
    balanceAfter: balance,
    reason,
    refType,
    refId,
    meta,
    idempotencyKey,
  });

  return balance;
}

export async function debitWallet(
  userId: mongoose.Types.ObjectId,
  amount: number,
  reason: WalletLedger["reason"],
  refType?: "Promotion" | "Admin",
  refId?: mongoose.Types.ObjectId,
  meta?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<{ success: boolean; balance: number }> {
  if (idempotencyKey) {
    const exists = await WalletLedger.exists({ idempotencyKey });
    if (exists) {
      const w = await Wallet.findOne({ userId }).lean();
      return { success: true, balance: w?.bromoCoins ?? 0 };
    }
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId, bromoCoins: { $gte: amount } },
    { $inc: { bromoCoins: -amount } },
    { new: true },
  ).lean();

  if (!wallet) {
    return { success: false, balance: (await Wallet.findOne({ userId }).lean())?.bromoCoins ?? 0 };
  }

  await WalletLedger.create({
    userId,
    delta: -amount,
    balanceAfter: wallet.bromoCoins,
    reason,
    refType,
    refId,
    meta,
    idempotencyKey,
  });

  return { success: true, balance: wallet.bromoCoins };
}

// Re-export type for use in WalletLedger helper
type WalletLedger = import("../models/WalletLedger.js").WalletLedgerDoc;
