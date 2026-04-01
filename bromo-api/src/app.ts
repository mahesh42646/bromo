import express from "express";
import path from "node:path";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { settingsRouter } from "./routes/settings.js";
import { userAuthRouter } from "./routes/userAuth.js";
import { initFirebase } from "./config/firebase.js";

export function createApp() {
  initFirebase();

  const app = express();
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const allowedOrigins = envOrDefault("CORS_ORIGIN", "http://localhost:3000")
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
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan("dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter);
  app.use("/settings", settingsRouter);
  app.use("/user-auth", userAuthRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  return app;
}

function envOrDefault(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
