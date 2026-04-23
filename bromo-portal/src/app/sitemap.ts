import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url.replace(/\/+$/, "");
  const paths = [
    "",
    "/login",
    "/register",
    "/about",
    "/contact",
    "/support",
    "/faq",
    "/privacy",
    "/terms",
    "/cookies",
  ];
  const now = new Date();
  return paths.map((p) => ({
    url: `${base}${p || "/"}`,
    lastModified: now,
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : 0.65,
  }));
}
