import express, { type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { requireVerifiedUser, type FirebaseAuthedRequest } from "../middleware/firebaseAuth.js";
import { Store } from "../models/Store.js";
import { StoreProduct } from "../models/StoreProduct.js";
import { User } from "../models/User.js";
import { uploadsRoot, publicUrlForUploadRelative } from "../utils/uploadFiles.js";

export const storeRouter = express.Router();

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
  return publicUrlForUploadRelative(rel);
}

function toStoreView(store: ReturnType<typeof Store.prototype.toObject>, myId?: string) {
  const obj = typeof store.toObject === "function" ? store.toObject() : store;
  return {
    ...obj,
    isFavorited: myId ? (obj.favoritedBy ?? []).some((id: unknown) => String(id) === myId) : false,
    favoritedBy: undefined,
  };
}

// ─── Routes ──────────────────────────────────────────────────────

/** GET /stores/featured — top 6 random active stores */
storeRouter.get("/featured", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const stores = await Store.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 6 } },
      {
        $project: {
          favoritedBy: 0,
        },
      },
    ]);
    res.json({ stores });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** GET /stores/mine — own store (requires auth) */
storeRouter.get("/mine", requireVerifiedUser, async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const store = await Store.findOne({ owner: req.dbUser!._id });
    if (!store) return res.status(404).json({ message: "No store found" });
    res.json({ store: toStoreView(store, String(req.dbUser!._id)) });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/** GET /stores — list all with filters */
storeRouter.get("/", async (req: FirebaseAuthedRequest, res: Response) => {
  try {
    const { city, delivery, lat, lng, maxDistance, q, category, page = "1", limit = "20" } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { isActive: true };
    if (city) filter.city = { $regex: new RegExp(city, "i") };
    if (delivery === "true") filter.hasDelivery = true;
    if (category) filter.category = category;
    if (q) filter.$text = { $search: q };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let stores;
    if (lat && lng && maxDistance) {
      stores = await Store.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
            distanceField: "distance",
            maxDistance: parseFloat(maxDistance),
            spherical: true,
            query: filter,
          },
        },
        { $skip: skip },
        { $limit: parseInt(limit) },
        { $project: { favoritedBy: 0 } },
      ]);
    } else {
      stores = await Store.find(filter)
        .sort({ totalViews: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      stores = stores.map((s) => ({ ...s, favoritedBy: undefined }));
    }

    const total = await Store.countDocuments(filter);
    res.json({ stores, total, page: parseInt(page) });
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

      const { name, phone, city, address, lat, lng, hasDelivery, category, description } = req.body as Record<string, string>;

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

      const { name, phone, city, address, lat, lng, hasDelivery, category, description } = req.body as Record<string, string>;
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

      const { name, description, price, originalPrice, category, inStock, tags } = req.body as Record<string, string>;
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

      const { name, description, price, originalPrice, category, inStock, tags } = req.body as Record<string, string>;
      if (name) product.name = name.trim();
      if (description !== undefined) product.description = description.trim();
      if (price) product.price = parseFloat(price);
      if (originalPrice !== undefined) product.originalPrice = originalPrice ? parseFloat(originalPrice) : undefined;
      if (category) product.category = category.trim();
      if (inStock !== undefined) product.inStock = inStock !== "false";
      if (tags) product.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const newPhotos = (req.files as Express.Multer.File[])?.map(fileToUrl) ?? [];
      if (newPhotos.length > 0) product.photos = newPhotos;

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
