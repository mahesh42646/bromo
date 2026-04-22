type CacheValue = unknown;

type MemoryEntry = {
  value: CacheValue;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();
type RedisLike = {
  get: (k: string) => Promise<string | null>;
  set: (k: string, v: string, opts: { EX: number }) => Promise<unknown>;
};

let redisClientPromise: Promise<RedisLike | null> | null = null;
let redisDisabled = false;

async function getRedisClient() {
  if (redisDisabled) return null;
  if (redisClientPromise) return redisClientPromise;
  redisClientPromise = (async () => {
    const url = process.env.REDIS_URL?.trim();
    if (!url) return null;
    try {
      const mod = await import("redis");
      const client = mod.createClient({
        url,
        socket: { connectTimeout: 1_500 },
      });
      client.on("error", () => null);
      await Promise.race([
        client.connect(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("redis connect timeout")), 2_000)),
      ]);
      return client;
    } catch {
      redisDisabled = true;
      return null;
    }
  })();
  return redisClientPromise;
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  if (redis) {
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  const cached = memoryStore.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return cached.value as T;
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getRedisClient();
  if (redis) {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
