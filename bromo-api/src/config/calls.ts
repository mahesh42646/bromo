export const CALLS_CONFIG = {
  turnUrls: (process.env.TURN_URLS ?? "turn:localhost:3478?transport=udp")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  ttlSeconds: Math.max(60, Number(process.env.TURN_TTL_SECONDS ?? 600)),
  maxConcurrentCallsPerProcess: Math.max(
    10,
    Number(process.env.MAX_CONCURRENT_CALLS_PER_PROCESS ?? 400),
  ),
} as const;
