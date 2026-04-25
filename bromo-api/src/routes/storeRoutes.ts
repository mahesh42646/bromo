import express, { type Response } from "express";
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
import { StoreProduct } from "../models/StoreProduct.js";
import { User } from "../models/User.js";
import { uploadsRoot, publicUrlForUploadRelative } from "../utils/uploadFiles.js";
import { mirrorUploadRelative } from "../services/s3Mirror.js";

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
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  cb(null, allowed.includes(file.mimetype));
};

const uploadStoreMedia = multer({
  storage: makeStoreStorage("store"),
  fileFilter: storeImgFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
}).fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
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

function toStoreView(store: ReturnType<typeof Store.prototype.toObject>, myId?: string) {
  const obj = typeof store.toObject === "function" ? store.toObject() : store;
  if (obj.subscription?.status === "active" && obj.subscription?.endsAt && new Date(obj.subscription.endsAt).getTime() <= Date.now()) {
    obj.subscription.status = "expired";
  }
  const activePlan =
    obj.subscription?.status === "active" && obj.subscription?.planId && obj.subscription.planId !== "none"
      ? STORE_PLAN_CATALOG[obj.subscription.planId as StorePaidPlanId]
      : null;
  return {
    ...obj,
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
      { $match: { isActive: true } },
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
    } = req.query as Record<string, string>;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter: Record<string, unknown> = { isActive: true };
    if (city) filter.city = { $regex: new RegExp(escapeRegExp(city), "i") };
    if (delivery === "true") filter.hasDelivery = true;
    if (category) filter.category = category;
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
    const store = await Store.findById(req.params.id);
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
        removeProfilePhoto,
        removeBannerImage,
      } = req.body as Record<string, string>;

      if (!name || !phone || !city || !address || !lat || !lng || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const files = req.files as Record<string, Express.Multer.File[]>;
      const profilePhoto = files?.profilePhoto?.[0] ? fileToUrl(files.profilePhoto[0]) : "";
      const bannerImage = files?.bannerImage?.[0] ? fileToUrl(files.bannerImage[0]) : "";

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
        removeProfilePhoto,
        removeBannerImage,
      } = req.body as Record<string, string>;
      const files = req.files as Record<string, Express.Multer.File[]>;

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

      await store.save();
      res.json({ store });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// ─── Products ────────────────────────────────────────────────────

/** GET /stores/:id/products */
storeRouter.get("/:id/products", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const { category } = req.query as { category?: string };
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
    await Store.findByIdAndUpdate(req.params.id, {
      $addToSet: { favoritedBy: req.dbUser!._id },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** DELETE /stores/:id/favorite */
storeRouter.delete("/:id/favorite", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    await Store.findByIdAndUpdate(req.params.id, {
      $pull: { favoritedBy: req.dbUser!._id },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});
