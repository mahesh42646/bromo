import express from "express";
import path from "node:path";

const uploadsRoot = path.resolve(process.cwd(), "uploads");

function contentTypeForUpload(absPath: string): string {
  const ext = path.extname(absPath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
    ".m4v": "video/x-m4v",
    // HLS
    ".m3u8": "application/vnd.apple.mpegurl",
    ".m4s": "video/iso.segment",
    ".ts": "video/mp2t",
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".pdf": "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { userAuthRouter } from "./routes/userAuth.js";
import { adminUsersRouter } from "./routes/adminUsers.js";
import { postsRouter } from "./routes/posts.js";
import { followRouter } from "./routes/follow.js";
import { mediaRouter } from "./routes/media.js";
import { mediaJobsRouter } from "./routes/mediaJobs.js";
import { chatRouter } from "./routes/chat.js";
import { liveRouter } from "./routes/live.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adsAdminRouter } from "./routes/ads.js";
import { adServeRouter } from "./routes/adServe.js";
import { walletRouter } from "./routes/wallet.js";
import { promotionsRouter } from "./routes/promotions.js";
import { affiliateAdminRouter, affiliatePublicRouter } from "./routes/affiliateProducts.js";
import { draftsRouter } from "./routes/drafts.js";
import { placesRouter } from "./routes/places.js";
import { musicRouter } from "./routes/music.js";
import { collabsRouter } from "./routes/collabs.js";
import { storeRouter } from "./routes/storeRoutes.js";
import { dashboardOverviewRouter } from "./routes/dashboardOverview.js";
import { callsRouter } from "./routes/calls.js";
import { contentRouter } from "./routes/content.js";
import { startPromotionBillingWorker } from "./workers/promotionBillingWorker.js";
import { startScheduledPostWorker } from "./workers/scheduledPostWorker.js";
import { initFirebase } from "./config/firebase.js";

export function createApp() {
  initFirebase();

  const app = express();
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const allowedOrigins = envOrDefault("CORS_ORIGIN", "*")
    .split(",")
    .map((s) => s.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === "production" ? "tiny" : "dev"));
  app.use("/uploads", (req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (res.statusCode >= 400) {
        console.warn(`[uploads] ${res.statusCode} ${req.method} ${req.originalUrl} (${Date.now() - started}ms)`);
      }
    });
    next();
  });
  const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
  const VIDEO_STATIC_EXTS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".mpeg", ".mpg", ".m4v"]);
  // HLS segment/init extensions
  const HLS_SEGMENT_EXTS = new Set([".m4s", ".ts", ".mp4"]);
  const HLS_PLAYLIST_EXTS = new Set([".m3u8"]);

  app.use(
    "/uploads",
    express.static(uploadsRoot, {
      // ETag + Last-Modified enabled by default in express.static — good.
      setHeaders(res, absPath) {
        res.setHeader("Content-Type", contentTypeForUpload(absPath));
        res.setHeader("Accept-Ranges", "bytes");
        const ext = path.extname(absPath).toLowerCase();
        const isHlsDir = absPath.includes(`${path.sep}hls${path.sep}`);

        if (isHlsDir && HLS_SEGMENT_EXTS.has(ext)) {
          // HLS segments are immutable (content-addressed by segment index + job ID)
          // 30 days CDN / 7 days client
          res.setHeader("Cache-Control", "public, max-age=604800, s-maxage=2592000, immutable");
          res.setHeader("Access-Control-Allow-Origin", "*");
        } else if (isHlsDir && HLS_PLAYLIST_EXTS.has(ext)) {
          // Playlists are static once transcode finishes. Cache 1 day client-side
          // so revisiting a reel never re-fetches the master playlist from origin.
          res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        } else if (VIDEO_STATIC_EXTS.has(ext)) {
          // Videos: cache 7 days CDN, 1 day client
          res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
        } else if (IMAGE_EXTS.has(ext)) {
          const underProfile = /[/\\]profile[/\\]/.test(absPath);
          if (underProfile) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
          }
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter);
  app.use("/user-auth", userAuthRouter);
  app.use("/admin", adminUsersRouter);
  app.use("/posts", postsRouter);
  app.use("/users", followRouter);
  app.use("/media", mediaRouter);
  app.use("/media", mediaJobsRouter);
  app.use("/chat", chatRouter);
  app.use("/live", liveRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/admin/ads", adsAdminRouter);
  app.use("/ads", adServeRouter);
  app.use("/wallet", walletRouter);
  app.use("/promotions", promotionsRouter);
  app.use("/admin/products", affiliateAdminRouter);
  app.use("/products", affiliatePublicRouter);
  app.use("/drafts", draftsRouter);
  app.use("/places", placesRouter);
  app.use("/music", musicRouter);
  app.use("/collabs", collabsRouter);
  app.use("/stores", storeRouter);
  app.use("/dashboard", dashboardOverviewRouter);
  app.use("/calls", callsRouter);
  app.use("/content", contentRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // Start background workers
  startPromotionBillingWorker();
  startScheduledPostWorker();

  return app;
}

function envOrDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
