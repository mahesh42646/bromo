import type { NextConfig } from "next";

/** Hostnames allowed to load Next dev assets (HMR / Turbopack). Required for ngrok/Cloudflare Tunnel. */
function collectAllowedDevOrigins(): string[] {
  const out = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw?.trim()) return;
    for (const part of raw.split(",")) {
      const host = part
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        ?.split(":")[0];
      if (host) out.add(host);
    }
  };
  add(process.env.NEXT_DEV_ALLOWED_ORIGINS);
  add(process.env.NGROK_HOST);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      const h = new URL(site).hostname;
      if (h && h !== "localhost" && !h.startsWith("127.")) out.add(h);
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const devOrigins = collectAllowedDevOrigins();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(process.env.NODE_ENV !== "production" && devOrigins.length > 0
    ? { allowedDevOrigins: devOrigins }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
