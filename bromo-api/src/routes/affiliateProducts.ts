import { Router, type Response } from "express";
import mongoose from "mongoose";
import { AffiliateProduct } from "../models/AffiliateProduct.js";
import { requireAdminToken, type AuthedRequest } from "../middleware/authBearer.js";
import {
  requireFirebaseToken,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";

export const affiliateAdminRouter = Router();
export const affiliatePublicRouter = Router();

/* ── Admin CRUD ──────────────────────────────────────────────────────── */

affiliateAdminRouter.get("/", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "30"), 10));
    const search = String(req.query.search ?? "").trim();
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }
    const [items, total] = await Promise.all([
      AffiliateProduct.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AffiliateProduct.countDocuments(filter),
    ]);
    return res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[affiliate-admin] list:", err);
    return res.status(500).json({ message: "Failed to list products" });
  }
});

affiliateAdminRouter.post("/", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const doc = await AffiliateProduct.create({
      title: String(b.title ?? "").trim(),
      description: String(b.description ?? "").trim(),
      imageUrl: String(b.imageUrl ?? "").trim(),
      productUrl: String(b.productUrl ?? "").trim(),
      price: Number(b.price ?? 0),
      currency: String(b.currency ?? "INR"),
      category: String(b.category ?? "general"),
      brand: String(b.brand ?? ""),
      isActive: b.isActive === undefined ? true : Boolean(b.isActive),
      createdBy: req.admin?.id ? new mongoose.Types.ObjectId(req.admin.id) : undefined,
    });
    return res.status(201).json(doc);
  } catch (err) {
    console.error("[affiliate-admin] create:", err);
    return res.status(500).json({ message: "Failed to create product" });
  }
});

affiliateAdminRouter.patch("/:id", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  try {
    const allowed = [
      "title",
      "description",
      "imageUrl",
      "productUrl",
      "price",
      "currency",
      "category",
      "brand",
      "isActive",
    ] as const;
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (k in req.body) update[k] = (req.body as Record<string, unknown>)[k];
    const doc = await AffiliateProduct.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ message: "Product not found" });
    return res.json(doc);
  } catch (err) {
    console.error("[affiliate-admin] update:", err);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

affiliateAdminRouter.delete("/:id", requireAdminToken, async (req: AuthedRequest, res: Response) => {
  try {
    const doc = await AffiliateProduct.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Product not found" });
    return res.json({ success: true });
  } catch (err) {
    console.error("[affiliate-admin] delete:", err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

/* ── Public (mobile picker) ─────────────────────────────────────────── */

affiliatePublicRouter.get(
  "/",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10));
      const search = String(req.query.q ?? "").trim();
      const category = String(req.query.category ?? "").trim();
      const filter: Record<string, unknown> = { isActive: true };
      if (category) filter.category = category;
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { brand: { $regex: search, $options: "i" } },
        ];
      }
      const items = await AffiliateProduct.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return res.json({ items });
    } catch (err) {
      console.error("[affiliate-public] list:", err);
      return res.status(500).json({ message: "Failed to list products" });
    }
  },
);

affiliatePublicRouter.post(
  "/resolve",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const ids = (req.body as { ids?: string[] })?.ids ?? [];
      const valid = ids
        .filter((x) => typeof x === "string" && mongoose.Types.ObjectId.isValid(x))
        .slice(0, 20);
      const items = await AffiliateProduct.find({ _id: { $in: valid }, isActive: true }).lean();
      return res.json({ items });
    } catch (err) {
      console.error("[affiliate-public] resolve:", err);
      return res.status(500).json({ message: "Failed to resolve products" });
    }
  },
);
