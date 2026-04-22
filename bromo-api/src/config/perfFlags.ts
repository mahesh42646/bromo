function isEnabled(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export const perfFlags = {
  feedOrchestratorV2: isEnabled(process.env.FEED_ORCHESTRATOR_V2, true),
  reelsOrchestratorV2: isEnabled(process.env.REELS_ORCHESTRATOR_V2, true),
  cursorApiV2: isEnabled(process.env.CURSOR_API_V2, true),
  adaptiveAbrV2: isEnabled(process.env.ADAPTIVE_ABR_V2, true),
  canaryPercent: Math.max(0, Math.min(100, Number(process.env.PERF_CANARY_PERCENT ?? 100))),
} as const;

export function isCanaryUser(userId: string): boolean {
  if (perfFlags.canaryPercent >= 100) return true;
  let acc = 0;
  for (let i = 0; i < userId.length; i += 1) acc = (acc + userId.charCodeAt(i)) % 100;
  return acc < perfFlags.canaryPercent;
}
