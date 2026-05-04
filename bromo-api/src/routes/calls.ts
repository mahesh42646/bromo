import { createHmac, randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { requireVerifiedUser, type FirebaseAuthedRequest } from "../middleware/firebaseAuth.js";
import { CALLS_CONFIG } from "../config/calls.js";

export const callsRouter = Router();

callsRouter.get("/config", requireVerifiedUser, (_req: FirebaseAuthedRequest, res: Response) => {
  res.json({
    maxConcurrentCallsPerProcess: CALLS_CONFIG.maxConcurrentCallsPerProcess,
    ttlSeconds: CALLS_CONFIG.ttlSeconds,
  });
});

callsRouter.post(
  "/turn-credentials",
  requireVerifiedUser,
  async (req: FirebaseAuthedRequest, res: Response) => {
    try {
      const user = req.dbUser!;
      const secret = process.env.TURN_SECRET ?? "";
      if (!secret) {
        return res.status(503).json({ message: "TURN server is not configured" });
      }

      const expiresAt = Math.floor(Date.now() / 1000) + CALLS_CONFIG.ttlSeconds;
      const username = `${expiresAt}:${String(user._id)}`;
      const credential = createHmac("sha1", secret).update(username).digest("base64");

      return res.json({
        iceServers: [
          {
            urls: CALLS_CONFIG.turnUrls,
            username,
            credential,
          },
        ],
        nonce: randomUUID(),
        expiresAt,
      });
    } catch (err) {
      console.error("[calls] turn credentials error", err);
      return res.status(500).json({ message: "Failed to issue TURN credentials" });
    }
  },
);
