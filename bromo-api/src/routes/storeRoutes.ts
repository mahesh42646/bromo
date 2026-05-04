import express, { type Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import {
  invalidateCachedUid,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { Store, type StoreDoc } from "../models/Store.js";
import { StoreLead } from "../models/StoreLead.js";
import { StoreProduct } from "../models/StoreProduct.js";
import { StoreRedemption } from "../models/StoreRedemption.js";
import { User } from "../models/User.js";
import { uploadsRoot, publicUrlForUploadRelative } from "../utils/uploadFiles.js";
import { mirrorUploadRelative } from "../services/s3Mirror.js";
import { sendPushToUser } from "../services/pushService.js";
import { assertTrustedCreatorMediaUrl } from "../utils/trustedCreatorMediaUrl.js";
import { debitWallet } from "./wallet.js";

export const storeRouter = express.Router();

const STORE_PLAN_CATALOG = {
  basic: {
    id: "basic",
    title: "Basic Plan",
    monthlyPriceInr: 499,
    billedAs: "billed monthly",
    badge: "standard",
    sortBoost: 1,
    radiusKm: 1,
    features: [
      "Store listing in 1 km radius",
      "Basic store profile & logo",
      "Standard verified badge",
      "Up to 2 discount offers/month",
      "Basic review management",
      "Limited reach analytics",
    ],
  },
  premium: {
    id: "premium",
    title: "Premium Plan",
    monthlyPriceInr: 1499,
    billedAs: "billed monthly",
    badge: "premium",
    sortBoost: 2,
    radiusKm: 1,
    features: [
      "Priority listing in 1 km radius",
      "Full store profile with media",
      "Premium verified badge",
      "Unlimited discount promotions",
      "Full review & rating management",
      "Daily user & engagement stats",
      "Push notifications (5 km radius)",
    ],
  },
  gold: {
    id: "gold",
    title: "Gold Plan",
    monthlyPriceInr: 2999,
    billedAs: "billed monthly",
    badge: "gold",
    sortBoost: 3,
    radiusKm: 5,
    features: [
      "Top listing priority always",
      "Unlimited discount promotions",
      "Gold verified badge + featured",
      "Full analytics dashboard",
      "Push notification to all nearby",
      "Daily users & engagement tracking",
      "Dedicated account manager",
    ],
  },
} as const;

type StorePaidPlanId = keyof typeof STORE_PLAN_CATALOG;

function isPaidPlanId(value: string): value is StorePaidPlanId {
  return value === "basic" || value === "premium" || value === "gold";
}

function getPlanForStore(store: Pick<StoreDoc, "subscription">): (typeof STORE_PLAN_CATALOG)[StorePaidPlanId] | null {
  const planId = store.subscription?.planId;
  if (!planId || planId === "none") return null;
  if (!isPaidPlanId(planId)) return null;
  return STORE_PLAN_CATALOG[planId];
}

function syncSubscriptionStatus(store: Pick<StoreDoc, "subscription">): void {
  const sub = store.subscription;
  if (!sub) return;
  if (sub.status !== "active") return;
  if (!sub.endsAt) return;
  if (sub.endsAt.getTime() > Date.now()) return;
  sub.status = "expired";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** KYC and store media URLs must be our uploads (or S3 mirror of the same). */
function assertOwnedUploadUrls(urls: Array<string | undefined | null>): void {
  for (const u of urls) {
    const t = u?.trim();
    if (!t) continue;
    assertTrustedCreatorMediaUrl(t);
  }
}

const PUBLIC_STORE_FILTER = { isActive: true, approvalStatus: "approved" } as const;

function normalizeApprovalStatus(value: unknown): "pending" | "approved" | "rejected" {
  return value === "approved" || value === "rejected" || value === "pending" ? value : "pending";
}

function parseStoreType(value: unknown): "d2c" | "b2b" | "online" {
  return value === "b2b" || value === "online" ? value : "d2c";
}

function parseExternalLinks(raw: string | undefined): Array<{label: string; url: string}> {
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as Array<{label?: unknown; url?: unknown}>;
    return Array.isArray(rows)
      ? rows
          .map((row) => ({
            label: String(row.label ?? "").trim().slice(0, 80),
            url: String(row.url ?? "").trim().slice(0, 500),
          }))
          .filter((row) => row.url)
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

// ─── Multer for store images ──────────────────────────────────────

function makeStoreStorage(subDir: string) {
  return multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = (req as FirebaseAuthedRequest).dbUser?._id;
      const dir = path.join(uploadsRoot(), String(userId), subDir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
    },
  });
}

const storeImgFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
  cb(null, allowed.includes(file.mimetype));
};

const uploadStoreMedia = multer({
  storage: makeStoreStorage("store"),
  fileFilter: storeImgFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
}).fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
  { name: "aadhaarCard", maxCount: 1 },
  { name: "addressProof", maxCount: 1 },
  { name: "storePhotos", maxCount: 6 },
]);

const uploadProductPhotos = multer({
  storage: makeStoreStorage("store-products"),
  fileFilter: storeImgFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array("photos", 6);

// ─── Helpers ─────────────────────────────────────────────────────

function fileToUrl(file: Express.Multer.File): string {
  const root = uploadsRoot();
  const rel = path.relative(root, file.path).split(path.sep).join("/");
  mirrorUploadRelative(rel).catch((err) => {
    console.warn("[storeRoutes] mirror upload failed:", rel, err);
  });
  return publicUrlForUploadRelative(rel);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function writeTermsAcceptancePdf(input: {
  userId: string;
  userName: string;
  acceptedAt: Date;
  ip: string;
}): string {
  const rel = `legal/${input.userId}/terms-${input.acceptedAt.getTime()}.pdf`;
  const abs = path.join(uploadsRoot(), ...rel.split("/"));
  fs.mkdirSync(path.dirname(abs), {recursive: true});
  const lines = [
    "BROMO / INSAY STORE TERMS ACCEPTANCE",
    `Name: ${input.userName}`,
    `Date: ${input.acceptedAt.toISOString().slice(0, 10)}`,
    `Timestamp: ${input.acceptedAt.toISOString()}`,
    `IP: ${input.ip}`,
    "The store owner accepted the mandatory Terms and Conditions during registration.",
  ];
  const text = lines.map((line, index) => `BT /F1 12 Tf 72 ${740 - index * 24} Td (${escapePdfText(line)}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(text)} >> stream\n${text}\nendstream endobj`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${obj}\n`;
  }
  const xrefAt = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  fs.writeFileSync(abs, body);
  void mirrorUploadRelative(rel).catch(() => null);
  return publicUrlForUploadRelative(rel);
}

function toStoreView(store: ReturnType<typeof Store.prototype.toObject>, myId?: string) {
  const obj = typeof store.toObject === "function" ? store.toObject() : store;
  if (obj.subscription?.status === "active" && obj.subscription?.endsAt && new Date(obj.subscription.endsAt).getTime() <= Date.now()) {
    obj.subscription.status = "expired";
  }
  const approvalStatus = normalizeApprovalStatus(obj.approvalStatus);
  const isLive = obj.isActive === true && approvalStatus === "approved";
  const activePlan =
    obj.subscription?.status === "active" && obj.subscription?.planId && obj.subscription.planId !== "none"
      ? STORE_PLAN_CATALOG[obj.subscription.planId as StorePaidPlanId]
      : null;
  return {
    ...obj,
    approvalStatus,
    isActive: isLive,
    requestPendingLabel: obj.requestPendingLabel || "Request Pending",
    activePlan,
    isFavorited: myId ? (obj.favoritedBy ?? []).some((id: unknown) => String(id) === myId) : false,
    favoritedBy: undefined,
  };
}

// ─── Routes ──────────────────────────────────────────────────────

/** GET /stores/featured — top 6 random active stores */
storeRouter.get("/featured", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const sampled = await Store.aggregate([
      { $match: PUBLIC_STORE_FILTER },
      { $sample: { size: 6 } },
    ]);
    const myId = req.dbUser?._id ? String(req.dbUser._id) : undefined;
    const stores = sampled.map((store) => toStoreView(store, myId));
    res.json({ stores });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** GET /stores/plans — storefront subscription plan catalog */
storeRouter.get("/plans", async (_req: FirebaseAuthedRequest, res: Response) => {
  res.json({
    plans: Object.values(STORE_PLAN_CATALOG),
  });
});

/** GET /stores/mine/subscription — active/pending plan for current store */
storeRouter.get("/mine/subscription", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({ owner: req.dbUser!._id });
    if (!store) return res.status(404).json({ message: "No store found" });
    syncSubscriptionStatus(store);
    await store.save();
    const activePlan = getPlanForStore(store);
    res.json({
      subscription: store.subscription,
      activePlan: store.subscription.status === "active" ? activePlan : null,
      plans: Object.values(STORE_PLAN_CATALOG),
    });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** POST /stores/mine/subscription/checkout — create simulated Razorpay order */
storeRouter.post("/mine/subscription/checkout", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({ owner: req.dbUser!._id });
    if (!store) return res.status(404).json({ message: "Create your store first" });

    const { planId } = req.body as { planId?: string };
    if (!planId || !isPaidPlanId(planId)) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const plan = STORE_PLAN_CATALOG[planId];
    const orderId = `order_mock_${Date.now()}_${randomBytes(4).toString("hex")}`;
    store.subscription.status = "pending";
    store.subscription.pendingPlanId = planId;
    store.subscription.pendingOrderId = orderId;
    store.subscription.pendingAmountInr = plan.monthlyPriceInr;
    store.subscription.pendingCreatedAt = new Date();
    await store.save();

    res.json({
      checkout: {
        provider: "razorpay_simulated",
        orderId,
        amountInr: plan.monthlyPriceInr,
        currency: "INR",
        merchantName: "Bromo Store Plans",
        plan,
        prefill: {
          name: req.dbUser?.displayName ?? "",
          email: req.dbUser?.email ?? "",
          contact: store.phone ?? "",
        },
      },
      store: toStoreView(store, String(req.dbUser!._id)),
    });
  } catch (err) {
    console.error("[storeRoutes] subscription checkout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** POST /stores/mine/subscription/verify — finalize simulated payment */
storeRouter.post("/mine/subscription/verify", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({ owner: req.dbUser!._id });
    if (!store) return res.status(404).json({ message: "No store found" });

    const { orderId, paymentId } = req.body as { orderId?: string; paymentId?: string };
    if (!orderId || !store.subscription.pendingOrderId || orderId !== store.subscription.pendingOrderId) {
      return res.status(400).json({ message: "Invalid or expired checkout session" });
    }
    if (!store.subscription.pendingPlanId || !isPaidPlanId(store.subscription.pendingPlanId)) {
      return res.status(400).json({ message: "No pending plan found" });
    }

    const activatedPlan = STORE_PLAN_CATALOG[store.subscription.pendingPlanId];
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + 30);

    store.subscription.planId = store.subscription.pendingPlanId;
    store.subscription.status = "active";
    store.subscription.badge = activatedPlan.badge;
    store.subscription.amountInr = store.subscription.pendingAmountInr || activatedPlan.monthlyPriceInr;
    store.subscription.startsAt = startsAt;
    store.subscription.endsAt = endsAt;
    store.subscription.lastOrderId = orderId;
    store.subscription.lastPaymentId = paymentId || `pay_mock_${Date.now()}_${randomBytes(4).toString("hex")}`;
    store.subscription.pendingPlanId = null;
    store.subscription.pendingOrderId = "";
    store.subscription.pendingAmountInr = 0;
    store.subscription.pendingCreatedAt = null;
    await store.save();

    res.json({
      ok: true,
      message: `${activatedPlan.title} activated successfully`,
      subscription: store.subscription,
      activePlan: activatedPlan,
      store: toStoreView(store, String(req.dbUser!._id)),
    });
  } catch (err) {
    console.error("[storeRoutes] subscription verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** GET /stores/mine — own store (requires auth) */
storeRouter.get("/mine", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const uid = req.dbUser!._id;
    let store = await Store.findOne({ owner: uid });
    if (!store && req.dbUser!.storeId) {
      const linked = await Store.findById(req.dbUser!.storeId);
      if (linked && String(linked.owner) === String(uid)) {
        store = linked;
      }
    }
    if (!store) return res.status(404).json({ message: "No store found" });

    if (!req.dbUser!.storeId || String(req.dbUser!.storeId) !== String(store._id)) {
      await User.findByIdAndUpdate(uid, { storeId: store._id });
      if (req.firebaseUser?.uid) invalidateCachedUid(req.firebaseUser.uid);
    }

    syncSubscriptionStatus(store);
    await store.save();

    res.json({ store: toStoreView(store, String(uid)) });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** GET /stores — list all with filters */
storeRouter.get("/", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const {
      city,
      delivery,
      lat,
      lng,
      maxDistance,
      q,
      category,
      page = "1",
      limit = "20",
      sortBy,
      minRating,
      plan,
      storeType,
    } = req.query as Record<string, string>;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter: Record<string, unknown> = { ...PUBLIC_STORE_FILTER };
    if (city) filter.city = { $regex: new RegExp(escapeRegExp(city), "i") };
    if (delivery === "true") filter.hasDelivery = true;
    if (category) filter.category = category;
    if (storeType === "d2c" || storeType === "b2b" || storeType === "online") filter.storeType = storeType;
    if (plan && isPaidPlanId(plan)) {
      filter["subscription.planId"] = plan;
      filter["subscription.status"] = "active";
    }
    if (minRating) {
      const min = parseFloat(minRating);
      if (!Number.isNaN(min)) filter.ratingAvg = { $gte: min };
    }

    const normalizedQuery = (q ?? "").trim();
    if (normalizedQuery) {
      const qRegex = new RegExp(escapeRegExp(normalizedQuery), "i");
      const productMatchedStoreIds = await StoreProduct.find(
        {
          isActive: true,
          $or: [{ name: qRegex }, { description: qRegex }, { category: qRegex }, { tags: qRegex }],
        },
        { store: 1 },
      ).distinct("store");

      const orFilters: Record<string, unknown>[] = [
        { name: qRegex },
        { description: qRegex },
        { city: qRegex },
        { address: qRegex },
        { category: qRegex },
        { tags: qRegex },
      ];
      if (productMatchedStoreIds.length > 0) {
        orFilters.push({ _id: { $in: productMatchedStoreIds } });
      }
      filter.$or = orFilters;
    }

    const requestedSort = (sortBy ?? "").toLowerCase();
    const hasGeo = Boolean(lat && lng);
    const effectiveSort = requestedSort || (hasGeo ? "nearest" : "popular");
    const mongoSortByName: Record<string, Record<string, 1 | -1>> = {
      nearest: { createdAt: -1 },
      popular: { totalViews: -1, createdAt: -1 },
      rating: { ratingAvg: -1, ratingCount: -1, totalViews: -1 },
      newest: { createdAt: -1 },
    };
    const listSort = mongoSortByName[effectiveSort] ?? mongoSortByName.popular;
    const geoSort: Record<string, 1 | -1> =
      effectiveSort === "rating"
        ? { ratingAvg: -1, ratingCount: -1, distance: 1 }
        : effectiveSort === "popular"
          ? { totalViews: -1, distance: 1 }
          : effectiveSort === "newest"
            ? { createdAt: -1, distance: 1 }
            : { distance: 1 };

    const myId = req.dbUser?._id ? String(req.dbUser._id) : undefined;
    let stores;
    if (hasGeo) {
      const geoMaxDistance = maxDistance ? parseFloat(maxDistance) : undefined;
      const geoNearStage: {
        near: { type: "Point"; coordinates: [number, number] };
        distanceField: string;
        spherical: boolean;
        query: Record<string, unknown>;
        maxDistance?: number;
      } = {
        near: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: "distance",
        spherical: true,
        query: filter,
      };
      if (geoMaxDistance != null && Number.isFinite(geoMaxDistance)) {
        geoNearStage.maxDistance = geoMaxDistance;
      }

      stores = await Store.aggregate([
        {
          $geoNear: geoNearStage,
        },
        { $sort: geoSort },
        { $skip: skip },
        { $limit: parsedLimit },
      ]);
      stores = stores.map((store) => toStoreView(store, myId));
    } else {
      const rows = await Store.find(filter)
        .sort(listSort)
        .skip(skip)
        .limit(parsedLimit)
        .lean();
      stores = rows.map((store) => toStoreView(store, myId));
    }

    const total = await Store.countDocuments(filter);
    res.json({ stores, total, page: parsedPage });
  } catch (err) {
    console.error("[storeRoutes] GET /stores error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** GET /stores/:id */
storeRouter.get("/:id", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({_id: req.params.id, ...PUBLIC_STORE_FILTER});
    if (!store) return res.status(404).json({ message: "Store not found" });
    await Store.findByIdAndUpdate(req.params.id, { $inc: { totalViews: 1 } });
    syncSubscriptionStatus(store);
    await store.save();

    const myId = req.dbUser ? String(req.dbUser._id) : undefined;
    res.json({ store: toStoreView(store, myId) });
  } catch {
    res.status(404).json({ message: "Store not found" });
  }
});

/** POST /stores — create store */
storeRouter.post(
  "/",
  requireVerifiedUser,
  (req, res, next) => uploadStoreMedia(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const existing = await Store.findOne({ owner: req.dbUser!._id });
      if (existing) return res.status(409).json({ message: "You already have a store" });

      const {
        name,
        phone,
        city,
        address,
        lat,
        lng,
        hasDelivery,
        category,
        description,
        storeType = "d2c",
        gstNumber,
        shopActLicense,
        acceptedTerms,
        externalLinks,
        coinsRequired,
        discountPercent,
        minOrderInr,
        removeProfilePhoto,
        removeBannerImage,
      } = req.body as Record<string, string>;

      if (!name || !phone || !city || !address || !lat || !lng || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (acceptedTerms !== "true") {
        return res.status(400).json({message: "Accept Terms & Conditions is required"});
      }
      if (!gstNumber?.trim() && !shopActLicense?.trim()) {
        return res.status(400).json({message: "GST Number or Shop Act License is required"});
      }

      const files = req.files as Record<string, Express.Multer.File[]>;
      const profilePhoto = files?.profilePhoto?.[0] ? fileToUrl(files.profilePhoto[0]) : "";
      const bannerImage = files?.bannerImage?.[0] ? fileToUrl(files.bannerImage[0]) : "";
      const panCardUrl = files?.panCard?.[0] ? fileToUrl(files.panCard[0]) : "";
      const aadhaarCardUrl = files?.aadhaarCard?.[0] ? fileToUrl(files.aadhaarCard[0]) : "";
      const addressProofUrl = files?.addressProof?.[0] ? fileToUrl(files.addressProof[0]) : "";
      const storePhotoUrls = (files?.storePhotos ?? []).map(fileToUrl);
      if (!panCardUrl || !aadhaarCardUrl || !addressProofUrl || storePhotoUrls.length === 0) {
        return res.status(400).json({message: "PAN Card, Aadhaar Card, store photos and address proof are required"});
      }
      try {
        assertOwnedUploadUrls([
          profilePhoto,
          bannerImage,
          panCardUrl,
          aadhaarCardUrl,
          addressProofUrl,
          ...storePhotoUrls,
        ]);
      } catch {
        return res.status(400).json({
          message: "Document URLs must be uploaded via this app (/uploads/…)",
        });
      }
      const acceptedAt = new Date();
      const termsPdfUrl = writeTermsAcceptancePdf({
        userId: String(req.dbUser!._id),
        userName: req.dbUser!.displayName,
        acceptedAt,
        ip: req.ip ?? "",
      });
      const parsedLinks = parseExternalLinks(externalLinks);

      const store = await Store.create({
        owner: req.dbUser!._id,
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
        location: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        hasDelivery: hasDelivery === "true",
        profilePhoto,
        bannerImage,
        category,
        description: (description ?? "").trim(),
        storeType: parseStoreType(storeType),
        approvalStatus: "pending",
        isActive: false,
        requestPendingLabel: "Request Pending",
        termsAcceptedAt: acceptedAt,
        termsAcceptedIp: req.ip,
        termsPdfUrl,
        kyc: {
          gstNumber: (gstNumber ?? "").trim(),
          shopActLicense: (shopActLicense ?? "").trim(),
          panCardUrl,
          aadhaarCardUrl,
          storePhotoUrls,
          addressProofUrl,
        },
        externalLinks: parsedLinks,
        coinDiscountRule: {
          coinsRequired: Math.max(0, Number(coinsRequired) || 0),
          discountPercent: Math.min(90, Math.max(0, Number(discountPercent) || 0)),
          minOrderInr: Math.max(0, Number(minOrderInr) || 0),
          active: parseStoreType(storeType) !== "b2b" && Number(coinsRequired) > 0 && Number(discountPercent) > 0,
        },
      });

      // Save storeId on user
      await User.findByIdAndUpdate(req.dbUser!._id, { storeId: store._id });
      invalidateCachedUid(req.firebaseUser!.uid);

      res.status(201).json({ store });
    } catch (err) {
      console.error("[storeRoutes] POST /stores error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/** PUT /stores/:id — update store (owner only) */
storeRouter.put(
  "/:id",
  requireVerifiedUser,
  (req, res, next) => uploadStoreMedia(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const store = await Store.findById(req.params.id);
      if (!store) return res.status(404).json({ message: "Store not found" });
      if (String(store.owner) !== String(req.dbUser!._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const {
        name,
        phone,
        city,
        address,
        lat,
        lng,
        hasDelivery,
        category,
        description,
        storeType,
        gstNumber,
        shopActLicense,
        acceptedTerms,
        externalLinks,
        coinsRequired,
        discountPercent,
        minOrderInr,
        removeProfilePhoto,
        removeBannerImage,
      } = req.body as Record<string, string>;
      const files = req.files as Record<string, Express.Multer.File[]>;
      const panCardUrl = files?.panCard?.[0] ? fileToUrl(files.panCard[0]) : "";
      const aadhaarCardUrl = files?.aadhaarCard?.[0] ? fileToUrl(files.aadhaarCard[0]) : "";
      const addressProofUrl = files?.addressProof?.[0] ? fileToUrl(files.addressProof[0]) : "";
      const storePhotoUrls = (files?.storePhotos ?? []).map(fileToUrl);
      const hasKycOrPlanSubmission = Boolean(
        storeType !== undefined ||
          gstNumber !== undefined ||
          shopActLicense !== undefined ||
          acceptedTerms !== undefined ||
          externalLinks !== undefined ||
          coinsRequired !== undefined ||
          discountPercent !== undefined ||
          minOrderInr !== undefined ||
          panCardUrl ||
          aadhaarCardUrl ||
          addressProofUrl ||
          storePhotoUrls.length > 0,
      );
      if (!store.kyc) {
        store.set("kyc", {
          gstNumber: "",
          shopActLicense: "",
          panCardUrl: "",
          aadhaarCardUrl: "",
          storePhotoUrls: [],
          addressProofUrl: "",
        });
      }

      if (name) store.name = name.trim();
      if (phone) store.phone = phone.trim();
      if (city) store.city = city.trim();
      if (address) store.address = address.trim();
      if (lat && lng) {
        store.location = { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] };
      }
      if (hasDelivery !== undefined) store.hasDelivery = hasDelivery === "true";
      if (category) store.category = category as never;
      if (description !== undefined) store.description = description.trim();
      if (removeProfilePhoto === "true") store.profilePhoto = "";
      if (removeBannerImage === "true") store.bannerImage = "";
      if (files?.profilePhoto?.[0]) store.profilePhoto = fileToUrl(files.profilePhoto[0]);
      if (files?.bannerImage?.[0]) store.bannerImage = fileToUrl(files.bannerImage[0]);
      if (storeType !== undefined) store.storeType = parseStoreType(storeType);
      if (externalLinks !== undefined) store.externalLinks = parseExternalLinks(externalLinks);

      if (gstNumber !== undefined) store.kyc.gstNumber = gstNumber.trim();
      if (shopActLicense !== undefined) store.kyc.shopActLicense = shopActLicense.trim();
      if (panCardUrl) store.kyc.panCardUrl = panCardUrl;
      if (aadhaarCardUrl) store.kyc.aadhaarCardUrl = aadhaarCardUrl;
      if (addressProofUrl) store.kyc.addressProofUrl = addressProofUrl;
      if (storePhotoUrls.length > 0) store.kyc.storePhotoUrls = storePhotoUrls;

      if (coinsRequired !== undefined || discountPercent !== undefined || minOrderInr !== undefined || storeType !== undefined) {
        const nextCoins = coinsRequired !== undefined ? Number(coinsRequired) : Number(store.coinDiscountRule?.coinsRequired ?? 0);
        const nextDiscount = discountPercent !== undefined ? Number(discountPercent) : Number(store.coinDiscountRule?.discountPercent ?? 0);
        const nextMinOrder = minOrderInr !== undefined ? Number(minOrderInr) : Number(store.coinDiscountRule?.minOrderInr ?? 0);
        store.coinDiscountRule = {
          coinsRequired: Math.max(0, nextCoins || 0),
          discountPercent: Math.min(90, Math.max(0, nextDiscount || 0)),
          minOrderInr: Math.max(0, nextMinOrder || 0),
          active: store.storeType !== "b2b" && nextCoins > 0 && nextDiscount > 0,
        };
      }

      if (acceptedTerms === "true") {
        const acceptedAt = new Date();
        store.termsAcceptedAt = acceptedAt;
        store.termsAcceptedIp = req.ip ?? "";
        store.termsPdfUrl = writeTermsAcceptancePdf({
          userId: String(req.dbUser!._id),
          userName: req.dbUser!.displayName,
          acceptedAt,
          ip: req.ip ?? "",
        });
      }

      if (hasKycOrPlanSubmission) {
        if (!store.kyc.gstNumber?.trim() && !store.kyc.shopActLicense?.trim()) {
          return res.status(400).json({message: "GST Number or Shop Act License is required"});
        }
        if (!store.kyc.panCardUrl || !store.kyc.aadhaarCardUrl || !store.kyc.addressProofUrl || !store.kyc.storePhotoUrls?.length) {
          return res.status(400).json({message: "PAN Card, Aadhaar Card, store photos and address proof are required"});
        }
        if (!store.termsPdfUrl) {
          return res.status(400).json({message: "Accept Terms & Conditions is required"});
        }
        store.approvalStatus = "pending";
        store.isActive = false;
        store.requestPendingLabel = "Request Pending";
        store.rejectionReason = "";
        store.set("approvedAt", undefined);
        store.set("approvedBy", undefined);
      }

      try {
        const k = store.kyc;
        assertOwnedUploadUrls([
          store.profilePhoto,
          store.bannerImage,
          k?.panCardUrl,
          k?.aadhaarCardUrl,
          k?.addressProofUrl,
          ...(k?.storePhotoUrls ?? []),
        ]);
      } catch {
        return res.status(400).json({
          message: "Document URLs must be uploaded via this app (/uploads/…)",
        });
      }

      await store.save();
      res.json({ store: toStoreView(store, String(req.dbUser!._id)) });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  },
);

/** GET /stores/:id/dashboard — owner metrics */
storeRouter.get("/:id/dashboard", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) return res.status(404).json({message: "Store not found"});
    if (String(store.owner) !== String(req.dbUser!._id)) return res.status(403).json({message: "Forbidden"});
    const [products, leads, redemptions] = await Promise.all([
      StoreProduct.countDocuments({store: store._id, isActive: true}),
      StoreLead.countDocuments({store: store._id}),
      StoreRedemption.find({store: store._id}).sort({createdAt: -1}).limit(50).lean(),
    ]);
    const redeemedCoins = redemptions.reduce((sum, row) => sum + Number(row.coinsDeducted || 0), 0);
    return res.json({
      reviews: [],
      ratings: {average: store.ratingAvg ?? 0, count: store.ratingCount ?? 0},
      dailyReach: store.totalViews ?? 0,
      engagement: {favorites: (store.favoritedBy ?? []).length, leads, redemptions: redemptions.length},
      views: store.totalViews ?? 0,
      products,
      redeemedCoins,
      recentRedemptions: redemptions,
    });
  } catch (err) {
    console.error("[storeRoutes] dashboard error:", err);
    res.status(500).json({message: "Server error"});
  }
});

/** GET /stores/:id/leads — B2B owner leads */
storeRouter.get("/:id/leads", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) return res.status(404).json({message: "Store not found"});
    if (String(store.owner) !== String(req.dbUser!._id)) return res.status(403).json({message: "Forbidden"});
    const leads = await StoreLead.find({store: store._id}).sort({createdAt: -1}).limit(200).lean();
    res.json({leads});
  } catch (err) {
    console.error("[storeRoutes] leads list error:", err);
    res.status(500).json({message: "Server error"});
  }
});

/** POST /stores/:id/b2b-leads — create bulk inquiry lead */
storeRouter.post("/:id/b2b-leads", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({_id: req.params.id, isActive: true, approvalStatus: "approved"}).lean();
    if (!store) return res.status(404).json({message: "Store not found"});
    if (store.storeType !== "b2b") return res.status(400).json({message: "This store is not a B2B store"});
    const body = req.body as Record<string, unknown>;
    const contactName = String(body.contactName ?? req.dbUser!.displayName).trim();
    const contactPhone = String(body.contactPhone ?? "").trim();
    if (!contactPhone) return res.status(400).json({message: "contactPhone is required"});
    if (body.consent !== true) {
      return res.status(400).json({message: "Consent is required to share contact details"});
    }
    const lead = await StoreLead.create({
      store: store._id,
      buyer: req.dbUser!._id,
      owner: store.owner,
      contactName,
      phone: contactPhone,
      quantity: String(body.quantity ?? "").trim(),
      details: String(body.details ?? "").trim(),
      consentAt: new Date(),
    });
    await Store.updateOne({_id: store._id}, {$inc: {"b2b.leadCount": 1}});
    res.status(201).json({lead});
  } catch (err) {
    console.error("[storeRoutes] b2b lead error:", err);
    res.status(500).json({message: "Server error"});
  }
});

function calculateDiscount(totalInr: number, rule: StoreDoc["coinDiscountRule"]) {
  const coinsRequired = Math.max(0, Number(rule?.coinsRequired) || 0);
  const discountPercent = Math.min(90, Math.max(0, Number(rule?.discountPercent) || 0));
  const minOrderInr = Math.max(0, Number(rule?.minOrderInr) || 0);
  const eligible = Boolean(rule?.active && coinsRequired > 0 && discountPercent > 0 && totalInr >= minOrderInr);
  const discountInr = eligible ? Math.round(totalInr * discountPercent) / 100 : 0;
  const payableInr = Math.max(0, Math.round((totalInr - discountInr) * 100) / 100);
  return {eligible, coinsRequired, discountPercent, minOrderInr, discountInr, payableInr};
}

/** POST /stores/:id/redeem-calc — quote coin discount */
storeRouter.post("/:id/redeem-calc", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({_id: req.params.id, isActive: true, approvalStatus: "approved"}).lean();
    if (!store) return res.status(404).json({message: "Store not found"});
    const totalInr = Math.max(0, Number((req.body as {totalInr?: unknown}).totalInr) || 0);
    const quote = calculateDiscount(totalInr, store.coinDiscountRule);
    res.json({
      ...quote,
      message: quote.eligible ? `Pay ₹${quote.payableInr} to Store` : "Offer not available for this order",
    });
  } catch (err) {
    console.error("[storeRoutes] redeem calc error:", err);
    res.status(500).json({message: "Server error"});
  }
});

/** POST /stores/:id/redeem — QR/physical-store coin redemption */
storeRouter.post("/:id/redeem", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({_id: req.params.id, isActive: true, approvalStatus: "approved"});
    if (!store) return res.status(404).json({message: "Store not found"});
    const totalInr = Math.max(0, Number((req.body as {totalInr?: unknown}).totalInr) || 0);
    const quote = calculateDiscount(totalInr, store.coinDiscountRule);
    if (!quote.eligible) return res.status(400).json({message: "Offer not available for this order"});
    const debit = await debitWallet(
      req.dbUser!._id,
      quote.coinsRequired,
      "store_redemption",
      "Store",
      store._id,
      {totalInr, discountInr: quote.discountInr, payableInr: quote.payableInr},
      `store:${store._id}:user:${req.dbUser!._id}:${Date.now()}`,
    );
    if (!debit.success) return res.status(402).json({message: "Not enough coins", balance: debit.balance});
    const otp = String(100000 + Math.floor(Math.random() * 900000));
    const qrToken = `redeem_${Date.now()}_${randomBytes(6).toString("hex")}`;
    const redemption = await StoreRedemption.create({
      store: store._id,
      user: req.dbUser!._id,
      owner: store.owner,
      orderTotalInr: totalInr,
      coinsDeducted: quote.coinsRequired,
      discountPercent: quote.discountPercent,
      payableInr: quote.payableInr,
      qrToken,
      otp,
      status: "pending",
    });
    res.status(201).json({
      redemption,
      otp,
      qrPayload: {token: qrToken, otp},
      balance: debit.balance,
      message: `Pay ₹${quote.payableInr} to Store · Share OTP ${otp} with cashier`,
      ownerMessage: `Collect only ₹${quote.payableInr} from this customer`,
    });
  } catch (err) {
    console.error("[storeRoutes] redeem error:", err);
    res.status(500).json({message: "Server error"});
  }
});

/** POST /stores/:id/redemptions/:rid/confirm — owner verifies OTP at checkout */
storeRouter.post("/:id/redemptions/:rid/confirm", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({_id: req.params.id, owner: req.dbUser!._id}).lean();
    if (!store) return res.status(404).json({message: "Store not found"});
    const rid = String(req.params.rid);
    if (!mongoose.Types.ObjectId.isValid(rid)) return res.status(400).json({message: "Invalid redemption"});
    const otp = String((req.body as {otp?: unknown}).otp ?? "").trim();
    const redemption = await StoreRedemption.findOne({_id: rid, store: store._id});
    if (!redemption) return res.status(404).json({message: "Redemption not found"});
    if (redemption.status !== "pending") return res.status(400).json({message: "Already processed"});
    if (redemption.otp !== otp) return res.status(400).json({message: "Invalid OTP"});
    redemption.status = "redeemed";
    redemption.redeemedAt = new Date();
    redemption.ownerConfirmedAt = new Date();
    await redemption.save();
    return res.json({ok: true});
  } catch (err) {
    console.error("[storeRoutes] redeem confirm error:", err);
    res.status(500).json({message: "Server error"});
  }
});

const STORE_PUSH_LIMITS: Record<StorePaidPlanId, number> = {
  basic: 5,
  premium: 50,
  gold: Number.MAX_SAFE_INTEGER,
};

/** POST /stores/:id/push — plan-limited customer push */
storeRouter.post("/:id/push", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({message: "Store not found"});
    if (String(store.owner) !== String(req.dbUser!._id)) return res.status(403).json({message: "Forbidden"});
    if (store.approvalStatus !== "approved" || !store.isActive) {
      return res.status(403).json({message: "Store must be approved before sending push notifications"});
    }
    const planId = store.subscription.planId;
    if (!isPaidPlanId(planId) || store.subscription.status !== "active") {
      return res.status(402).json({message: "Active Basic, Premium or Gold plan is required"});
    }
    const monthKey = new Date().toISOString().slice(0, 7);
    if (store.notificationUsage.monthKey !== monthKey) {
      store.notificationUsage.monthKey = monthKey;
      store.notificationUsage.sentCount = 0;
    }
    const limit = STORE_PUSH_LIMITS[planId];
    if (store.notificationUsage.sentCount >= limit) {
      return res.status(429).json({message: "Monthly notification limit reached"});
    }
    const title = String((req.body as {title?: unknown}).title ?? store.name).trim().slice(0, 80);
    const body = String((req.body as {body?: unknown}).body ?? "").trim().slice(0, 240);
    if (!body) return res.status(400).json({message: "body is required"});
    const favoriteUsers = await User.find({_id: {$in: store.favoritedBy ?? []}}).select("_id").limit(2000).lean();
    await Promise.allSettled(
      favoriteUsers.map((user) =>
        sendPushToUser(String(user._id), {
          title,
          body,
          data: {type: "store_push", storeId: String(store._id), planId},
        }),
      ),
    );
    store.notificationUsage.sentCount += 1;
    await store.save();
    res.json({ok: true, sentTo: favoriteUsers.length, remaining: limit === Number.MAX_SAFE_INTEGER ? null : limit - store.notificationUsage.sentCount});
  } catch (err) {
    console.error("[storeRoutes] push error:", err);
    res.status(500).json({message: "Server error"});
  }
});

// ─── Products ────────────────────────────────────────────────────

/** GET /stores/:id/products */
storeRouter.get("/:id/products", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const { category } = req.query as { category?: string };
    const store = await Store.findOne({_id: req.params.id, ...PUBLIC_STORE_FILTER}).select("_id").lean();
    if (!store) return res.status(404).json({ message: "Store not found" });
    const filter: Record<string, unknown> = { store: req.params.id, isActive: true };
    if (category) filter.category = category;

    const products = await StoreProduct.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ products });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** POST /stores/:id/products */
storeRouter.post(
  "/:id/products",
  requireVerifiedUser,
  (req, res, next) => uploadProductPhotos(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const store = await Store.findById(req.params.id);
      if (!store) return res.status(404).json({ message: "Store not found" });
      if (String(store.owner) !== String(req.dbUser!._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (store.approvalStatus !== "approved" || !store.isActive) {
        return res.status(403).json({ message: "Store must be admin approved before adding products" });
      }

      const { name, description, price, originalPrice, category, inStock, tags, videoUrl } = req.body as Record<string, string>;
      if (!name || !price || !category) {
        return res.status(400).json({ message: "name, price, category required" });
      }

      const photos = (req.files as Express.Multer.File[])?.map(fileToUrl) ?? [];

      const product = await StoreProduct.create({
        store: store._id,
        owner: req.dbUser!._id,
        name: name.trim(),
        description: (description ?? "").trim(),
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        category: category.trim(),
        inStock: inStock !== "false",
        photos,
        videoUrl: (videoUrl ?? "").trim(),
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });

      await Store.findByIdAndUpdate(store._id, { $inc: { totalProducts: 1 } });
      res.status(201).json({ product });
    } catch (err) {
      console.error("[storeRoutes] POST products error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

/** PUT /stores/:id/products/:pid */
storeRouter.put(
  "/:id/products/:pid",
  requireVerifiedUser,
  (req, res, next) => uploadProductPhotos(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const product = await StoreProduct.findById(req.params.pid);
      if (!product) return res.status(404).json({ message: "Product not found" });
      if (String(product.owner) !== String(req.dbUser!._id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const store = await Store.findOne({_id: req.params.id, owner: req.dbUser!._id});
      if (!store || store.approvalStatus !== "approved" || !store.isActive) {
        return res.status(403).json({ message: "Store must be admin approved before editing products" });
      }

      const { name, description, price, originalPrice, category, inStock, tags, videoUrl, replacePhotos } = req.body as Record<string, string>;
      if (name) product.name = name.trim();
      if (description !== undefined) product.description = description.trim();
      if (price) product.price = parseFloat(price);
      if (originalPrice !== undefined) product.originalPrice = originalPrice ? parseFloat(originalPrice) : undefined;
      if (category) product.category = category.trim();
      if (inStock !== undefined) product.inStock = inStock !== "false";
      if (tags) product.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (videoUrl !== undefined) product.videoUrl = videoUrl.trim();

      const newPhotos = (req.files as Express.Multer.File[])?.map(fileToUrl) ?? [];
      if (replacePhotos === "true") product.photos = newPhotos;
      else if (newPhotos.length > 0) product.photos = newPhotos;

      await product.save();
      res.json({ product });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  },
);

/** DELETE /stores/:id/products/:pid */
storeRouter.delete("/:id/products/:pid", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const product = await StoreProduct.findById(req.params.pid);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (String(product.owner) !== String(req.dbUser!._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const store = await Store.findOne({_id: req.params.id, owner: req.dbUser!._id});
    if (!store || store.approvalStatus !== "approved" || !store.isActive) {
      return res.status(403).json({ message: "Store must be admin approved before deleting products" });
    }
    await product.deleteOne();
    await Store.findByIdAndUpdate(req.params.id, { $inc: { totalProducts: -1 } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Favorites ───────────────────────────────────────────────────

/** POST /stores/:id/favorite */
storeRouter.post("/:id/favorite", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOneAndUpdate({_id: req.params.id, ...PUBLIC_STORE_FILTER}, {
      $addToSet: { favoritedBy: req.dbUser!._id },
    });
    if (!store) return res.status(404).json({ message: "Store not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** DELETE /stores/:id/favorite */
storeRouter.delete("/:id/favorite", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOneAndUpdate({_id: req.params.id, ...PUBLIC_STORE_FILTER}, {
      $pull: { favoritedBy: req.dbUser!._id },
    });
    if (!store) return res.status(404).json({ message: "Store not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});
