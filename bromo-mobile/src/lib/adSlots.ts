/**
 * Deterministic ad insertion — same content + ad ids always yield the same slots,
 * so list order does not jump when unrelated state (e.g. like counts) updates.
 */

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick insertion slots among `contentCount` items (insert ad AFTER content[idx]).
 * `seed` should be derived from stable ids (e.g. hash of post ids + ad ids).
 */
export function pickAdSlots(contentCount: number, adCount: number, seed: number, minGap = 2): number[] {
  if (contentCount === 0 || adCount === 0) return [];
  const rnd = mulberry32(seed);
  const maxAds = Math.min(adCount, Math.max(1, Math.ceil(contentCount / minGap)));
  const slots: number[] = [];
  let attempts = 0;
  while (slots.length < maxAds && attempts < 200) {
    attempts++;
    const pos = Math.floor(rnd() * contentCount);
    if (slots.every(s => Math.abs(s - pos) >= minGap)) {
      slots.push(pos);
    }
  }
  return slots.sort((a, b) => a - b);
}
