import {Router, type Express, type Request, type Response} from "express";
import mongoose from "mongoose";
import {Post} from "../models/Post.js";
import {User} from "../models/User.js";
import {rewritePublicMediaUrl} from "../utils/publicMediaUrl.js";

export const shareLandingRouter = Router();

const SHARE_HOST = process.env.PUBLIC_SHARE_HOST || "https://bromo.darkunde.in";
const PLAY_STORE_URL = process.env.PLAY_STORE_URL || SHARE_HOST;
const APP_STORE_URL = process.env.APP_STORE_URL || SHARE_HOST;
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE_NAME || "com.bromo.platform";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absolute(raw?: string): string {
  const value = String(raw ?? "").trim();
  return value ? rewritePublicMediaUrl(value) : "";
}

function landingHtml(input: {
  title: string;
  description: string;
  image?: string;
  canonical: string;
  appUrl: string;
  type?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(input.title)}</title>
  <link rel="canonical" href="${esc(input.canonical)}" />
  <meta property="og:title" content="${esc(input.title)}" />
  <meta property="og:description" content="${esc(input.description)}" />
  <meta property="og:type" content="${esc(input.type || "website")}" />
  <meta property="og:url" content="${esc(input.canonical)}" />
  ${input.image ? `<meta property="og:image" content="${esc(input.image)}" />` : ""}
  <meta name="twitter:card" content="${input.image ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${esc(input.title)}" />
  <meta name="twitter:description" content="${esc(input.description)}" />
  ${input.image ? `<meta name="twitter:image" content="${esc(input.image)}" />` : ""}
  <style>
    body{margin:0;background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}
    main{max-width:420px;width:100%;text-align:center}
    img{width:100%;max-height:520px;object-fit:cover;border-radius:12px;background:#151515}
    a{display:inline-flex;margin-top:18px;background:#fff;color:#000;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:800}
    p{color:#c8c8c8;line-height:1.45}
  </style>
</head>
<body>
  <main>
    ${input.image ? `<img src="${esc(input.image)}" alt="" />` : ""}
    <h1>${esc(input.title)}</h1>
    <p>${esc(input.description)}</p>
    <a href="${esc(input.appUrl)}">Open in BROMO</a>
  </main>
  <script>
    const started = Date.now();
    location.href = ${JSON.stringify(input.appUrl)};
    setTimeout(() => {
      if (Date.now() - started < 2200) {
        location.href = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? ${JSON.stringify(APP_STORE_URL)} : ${JSON.stringify(PLAY_STORE_URL)};
      }
    }, 900);
  </script>
</body>
</html>`;
}

async function postLanding(req: Request, res: Response, kind: "r" | "p" | "s") {
  const id = String(req.params.id ?? "");
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).send("Not found");
  const post = await Post.findOne({_id: id, isDeleted: {$ne: true}})
    .populate("authorId", "username displayName profilePicture")
    .lean();
  if (!post) return res.status(404).send("Not found");
  const author = post.authorId as unknown as {username?: string; displayName?: string; profilePicture?: string};
  const title =
    kind === "r"
      ? `@${author?.username ?? "bromo"} on BROMO`
      : kind === "s"
        ? `${author?.displayName ?? "BROMO"}'s story`
        : `${author?.displayName ?? "BROMO"}'s post`;
  const image = absolute(post.thumbnailUrl || post.mediaUrl);
  const path = `/${kind}/${id}`;
  res.type("html").send(
    landingHtml({
      title,
      description: String(post.caption || "Open this on BROMO."),
      image,
      canonical: `${SHARE_HOST}${path}`,
      appUrl: `bromo://${kind}/${id}`,
      type: kind === "r" || kind === "s" ? "video.other" : "article",
    }),
  );
}

shareLandingRouter.get("/r/:id", (req, res, next) => postLanding(req, res, "r").catch(next));
shareLandingRouter.get("/p/:id", (req, res, next) => postLanding(req, res, "p").catch(next));
shareLandingRouter.get("/s/:id", (req, res, next) => postLanding(req, res, "s").catch(next));

shareLandingRouter.get("/u/:username", async (req, res, next) => {
  try {
    const username = String(req.params.username ?? "").replace(/^@/, "").trim();
    const user = await User.findOne({username})
      .select("username displayName profilePicture bio")
      .lean();
    if (!user) return res.status(404).send("Not found");
    const path = `/u/${encodeURIComponent(username)}`;
    res.type("html").send(
      landingHtml({
        title: `${user.displayName || user.username} on BROMO`,
        description: user.bio || `@${user.username} on BROMO`,
        image: absolute(user.profilePicture),
        canonical: `${SHARE_HOST}${path}`,
        appUrl: `bromo://u/${encodeURIComponent(username)}`,
        type: "profile",
      }),
    );
  } catch (err) {
    next(err);
  }
});

shareLandingRouter.get("/.well-known/apple-app-site-association", (_req, res) => {
  const appIDs = String(process.env.APPLE_APP_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  res.type("application/json").send({
    applinks: {
      apps: [],
      details: appIDs.map(appID => ({
        appIDs: [appID],
        components: [
          {"/": "/r/*"},
          {"/": "/p/*"},
          {"/": "/u/*"},
          {"/": "/s/*"},
          {"/": "/chat/*"},
        ],
      })),
    },
  });
});

shareLandingRouter.get("/.well-known/assetlinks.json", (_req, res) => {
  const fingerprints = String(process.env.ANDROID_SHA256_CERT_FINGERPRINTS || process.env.ANDROID_SHA256 || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  res.type("application/json").send(
    fingerprints.map(fingerprint => ({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [fingerprint],
      },
    })),
  );
});

export function mountShareLanding(app: Express): void {
  app.use("/", shareLandingRouter);
}
