import { Router, type Response } from "express";
import { getAuth } from "../config/firebase.js";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { invalidateCachedUid } from "../middleware/firebaseAuth.js";
import { User } from "../models/User.js";
import {
  validateUsername,
  isUsernameAvailable,
  generateSuggestions,
} from "../utils/username.js";
import { assertTrustedCreatorMediaUrl } from "../utils/trustedCreatorMediaUrl.js";

export const userAuthRouter = Router();

// ── POST /register ────────────────────────────────────────────────
// Called after Firebase client-side createUser + email verification.
// Creates the DB user doc if it doesn't exist.
userAuthRouter.post(
  "/register",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const fb = req.firebaseUser!;

      const existing = await User.findOne({ firebaseUid: fb.uid });
      if (existing) {
        return res.json({ user: existing, created: false });
      }

      const displayName =
        (req.body.displayName as string | undefined)?.trim() || fb.email.split("@")[0];
      const phone = (req.body.phone as string | undefined)?.trim() || "";

      const user = await User.create({
        firebaseUid: fb.uid,
        email: fb.email,
        displayName,
        phone,
        emailVerified: fb.emailVerified,
        provider: "email",
        isVerified: false,
        verificationStatus: "none",
      });
      invalidateCachedUid(fb.uid);

      return res.status(201).json({ user, created: true });
    } catch (err: unknown) {
      console.error("[userAuth] register error:", err);
      return res.status(500).json({ message: "Registration failed" });
    }
  },
);

// ── POST /google ──────────────────────────────────────────────────
// Called after Google sign-in on client. Find-or-create user.
userAuthRouter.post(
  "/google",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const fb = req.firebaseUser!;

      let user = await User.findOne({ firebaseUid: fb.uid });
      if (user) {
        if (!user.emailVerified && fb.emailVerified) {
          user.emailVerified = true;
          await user.save();
        }
        return res.json({ user, created: false });
      }

      const displayName =
        (req.body.displayName as string | undefined)?.trim() || fb.email.split("@")[0];

      user = await User.create({
        firebaseUid: fb.uid,
        email: fb.email,
        displayName,
        emailVerified: true,
        provider: "google",
        profilePicture: (req.body.photoURL as string | undefined) ?? "",
        isVerified: false,
        verificationStatus: "none",
      });
      invalidateCachedUid(fb.uid);

      return res.status(201).json({ user, created: true });
    } catch (err: unknown) {
      console.error("[userAuth] google error:", err);
      return res.status(500).json({ message: "Google sign-in failed" });
    }
  },
);

// ── POST /forgot-password ─────────────────────────────────────────
// Public — triggers Firebase password reset email.
userAuthRouter.post("/forgot-password", async (req, res) => {
  try {
    const email = (req.body.email as string | undefined)?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    await getAuth().generatePasswordResetLink(email);
    return res.json({ message: "Password reset email sent" });
  } catch (err: unknown) {
    // Don't leak whether the email exists
    return res.json({ message: "If the account exists, a reset link was sent" });
  }
});

// Legacy compatibility: GET /forgot-password/sendOtp?email=...
userAuthRouter.get("/forgot-password/sendOtp", async (req, res) => {
  try {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    await getAuth().generatePasswordResetLink(email);
    return res.json({ message: "Password reset email sent" });
  } catch {
    return res.json({ message: "If the account exists, a reset link was sent" });
  }
});

// ── GET /me ───────────────────────────────────────────────────────
/** Always load from DB — do not return LRU-cached `req.dbUser` (stale storeId, counts, etc.). */
userAuthRouter.get(
  "/me",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const fb = req.firebaseUser!;
      const user = await User.findOne({ firebaseUid: fb.uid });

      if (!user) {
        return res.status(404).json({
          message: "User not registered",
          needsRegistration: true,
        });
      }

      // Sync email verification status from Firebase
      if (!user.emailVerified && fb.emailVerified) {
        user.emailVerified = true;
        await user.save();
      }

      if (typeof user.postsCount === "number" && user.postsCount < 0) {
        user.postsCount = 0;
        await user.save();
      }

      return res.json({ user });
    } catch (err: unknown) {
      console.error("[userAuth] /me error:", err);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  },
);

// ── GET /email-by-username/:username ─────────────────────────────
// Public — look up email from username for username-based login.
userAuthRouter.get("/email-by-username/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    const user = await User.findOne({ username }).select("email").lean();
    if (!user) {
      return res.status(404).json({ message: "No account found with this username" });
    }
    return res.json({ email: (user as { email: string }).email });
  } catch (err: unknown) {
    console.error("[userAuth] email-by-username error:", err);
    return res.status(500).json({ message: "Lookup failed" });
  }
});

// ── GET /check-username/:username ─────────────────────────────────
// Public — real-time availability check.
userAuthRouter.get("/check-username/:username", async (req, res) => {
  try {
    const raw = req.params.username.toLowerCase().trim();
    const validation = validateUsername(raw);
    if (!validation.valid) {
      return res.json({
        available: false,
        error: validation.error,
        suggestions: await generateSuggestions(raw),
      });
    }

    const available = await isUsernameAvailable(raw);
    const suggestions = available ? [] : await generateSuggestions(raw);

    return res.json({ available, suggestions });
  } catch (err: unknown) {
    console.error("[userAuth] check-username error:", err);
    return res.status(500).json({ message: "Check failed" });
  }
});

// ── POST /username ────────────────────────────────────────────────
// Set or update the unique username.
userAuthRouter.post(
  "/username",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      // req.dbUser is pre-loaded by requireFirebaseToken middleware — no extra DB query needed
      const user = req.dbUser;
      if (!user) {
        return res.status(404).json({ message: "User not registered" });
      }

      const raw = (req.body.username as string | undefined)?.toLowerCase().trim();
      if (!raw) {
        return res.status(400).json({ message: "Username is required" });
      }

      const validation = validateUsername(raw);
      if (!validation.valid) {
        return res.status(400).json({
          message: validation.error,
          suggestions: await generateSuggestions(raw),
        });
      }

      const available = await isUsernameAvailable(raw);
      if (!available && user.username !== raw) {
        return res.status(409).json({
          message: "Username already taken",
          suggestions: await generateSuggestions(raw),
        });
      }

      user.username = raw;
      user.onboardingComplete = true;
      await user.save();
      invalidateCachedUid(String(user.firebaseUid));

      return res.json({ user });
    } catch (err: unknown) {
      console.error("[userAuth] username error:", err);
      return res.status(500).json({ message: "Failed to set username" });
    }
  },
);

// ── PATCH /profile ────────────────────────────────────────────────
userAuthRouter.patch(
  "/profile",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const { displayName, bio, profilePicture, phone, website } = req.body as {
        displayName?: string;
        bio?: string;
        profilePicture?: string;
        phone?: string;
        website?: string;
      };

      if (displayName !== undefined) user.displayName = displayName.trim().slice(0, 100);
      if (bio !== undefined) user.bio = bio.trim().slice(0, 300);
      if (profilePicture !== undefined) user.profilePicture = profilePicture;
      if (phone !== undefined) user.phone = phone.trim();
      if (website !== undefined) user.website = website.trim().slice(0, 200);

      await user.save();
      return res.json({ user });
    } catch (err: unknown) {
      console.error("[userAuth] profile update error:", err);
      return res.status(500).json({ message: "Profile update failed" });
    }
  },
);

// ── POST /device-token ─────────────────────────────────────────────
userAuthRouter.post(
  "/device-token",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const token = String((req.body as {token?: unknown}).token ?? "").trim();
      if (!token) return res.status(400).json({message: "token is required"});
      await User.updateOne({_id: req.dbUser!._id}, {$addToSet: {fcmTokens: token}});
      return res.json({ok: true});
    } catch (err) {
      console.error("[userAuth] device token error:", err);
      return res.status(500).json({message: "Failed to save device token"});
    }
  },
);

userAuthRouter.delete(
  "/device-token",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const token = String((req.body as {token?: unknown}).token ?? "").trim();
      if (!token) return res.status(400).json({message: "token is required"});
      await User.updateOne({_id: req.dbUser!._id}, {$pull: {fcmTokens: token}});
      return res.json({ok: true});
    } catch (err) {
      console.error("[userAuth] remove device token error:", err);
      return res.status(500).json({message: "Failed to remove device token"});
    }
  },
);

// ── POST /creator-form ─────────────────────────────────────────────
userAuthRouter.post(
  "/creator-form",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const body = req.body as Record<string, unknown>;
      const documents = Array.isArray(body.documents)
        ? body.documents.map((v) => String(v).trim()).filter(Boolean).slice(0, 10)
        : [];
      for (const u of documents) {
        try {
          assertTrustedCreatorMediaUrl(u);
        } catch {
          return res.status(400).json({message: "Each document must be an uploaded file URL (/uploads/…)"});
        }
      }
      user.creatorStatus = "pending";
      user.isCreator = false;
      user.creatorBadge = false;
      user.creatorForm = {
        fullName: String(body.fullName ?? user.displayName).trim().slice(0, 120),
        category: String(body.category ?? "").trim().slice(0, 120),
        bio: String(body.bio ?? user.bio ?? "").trim().slice(0, 500),
        website: String(body.website ?? user.website ?? "").trim().slice(0, 300),
        documents,
        submittedAt: new Date(),
        rejectionReason: "",
      };
      await user.save();
      return res.json({user});
    } catch (err) {
      console.error("[userAuth] creator form error:", err);
      return res.status(500).json({message: "Failed to submit creator form"});
    }
  },
);

// ── POST /connected-store ──────────────────────────────────────────
userAuthRouter.post(
  "/connected-store",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const website = String((req.body as {website?: unknown}).website ?? "").trim();
      const planId = String((req.body as {planId?: unknown}).planId ?? "connect_store").trim();
      if (!website) return res.status(400).json({message: "website is required"});
      user.connectedStore = {
        enabled: true,
        website,
        planId,
        purchasedAt: new Date(),
      };
      await user.save();
      return res.json({user});
    } catch (err) {
      console.error("[userAuth] connected store error:", err);
      return res.status(500).json({message: "Failed to connect store"});
    }
  },
);
