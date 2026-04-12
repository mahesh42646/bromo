import express from "express";
import path from "node:path";

const uploadsRoot = path.resolve(process.cwd(), "uploads");

function contentTypeForUpload(absPath: string): string {
  const ext = path.extname(absPath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return map[ext] ?? "application/octet-stream";
}
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { settingsRouter } from "./routes/settings.js";
import { userAuthRouter } from "./routes/userAuth.js";
import { adminUsersRouter } from "./routes/adminUsers.js";
import { postsRouter } from "./routes/posts.js";
import { followRouter } from "./routes/follow.js";
import { mediaRouter } from "./routes/media.js";
import { chatRouter } from "./routes/chat.js";
import { liveRouter } from "./routes/live.js";
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
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(morgan("dev"));
  app.use("/uploads", (req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (res.statusCode >= 400) {
        console.warn(`[uploads] ${res.statusCode} ${req.method} ${req.originalUrl} (${Date.now() - started}ms)`);
      }
    });
    next();
  });
  app.use(
    "/uploads",
    express.static(uploadsRoot, {
      setHeaders(res, absPath) {
        res.setHeader("Content-Type", contentTypeForUpload(absPath));
        res.setHeader("Accept-Ranges", "bytes");
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter);
  app.use("/settings", settingsRouter);
  app.use("/user-auth", userAuthRouter);
  app.use("/admin", adminUsersRouter);
  app.use("/posts", postsRouter);
  app.use("/users", followRouter);
  app.use("/media", mediaRouter);
  app.use("/chat", chatRouter);
  app.use("/live", liveRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  return app;
}

function envOrDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
