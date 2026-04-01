import { Router, type Response } from "express";
import { getAuth } from "../config/firebase.js";
import {
  requireFirebaseToken,
  requireVerifiedUser,
  type FirebaseAuthedRequest,
} from "../middleware/firebaseAuth.js";
import { User } from "../models/User.js";
import {
  validateUsername,
  isUsernameAvailable,
  generateSuggestions,
} from "../utils/username.js";

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

      const user = await User.create({
        firebaseUid: fb.uid,
        email: fb.email,
        displayName,
        emailVerified: fb.emailVerified,
        provider: "email",
      });

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
      });

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

// ── GET /me ───────────────────────────────────────────────────────
userAuthRouter.get(
  "/me",
  requireFirebaseToken,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const fb = req.firebaseUser!;
      const user = req.dbUser;

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

      return res.json({ user });
    } catch (err: unknown) {
      console.error("[userAuth] /me error:", err);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  },
);

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
      const { displayName, bio, profilePicture, phone } = req.body as {
        displayName?: string;
        bio?: string;
        profilePicture?: string;
        phone?: string;
      };

      if (displayName !== undefined) user.displayName = displayName.trim().slice(0, 100);
      if (bio !== undefined) user.bio = bio.trim().slice(0, 300);
      if (profilePicture !== undefined) user.profilePicture = profilePicture;
      if (phone !== undefined) user.phone = phone.trim();

      await user.save();
      return res.json({ user });
    } catch (err: unknown) {
      console.error("[userAuth] profile update error:", err);
      return res.status(500).json({ message: "Profile update failed" });
    }
  },
);
