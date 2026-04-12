import express from "express";
import path from "node:path";
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
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

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
