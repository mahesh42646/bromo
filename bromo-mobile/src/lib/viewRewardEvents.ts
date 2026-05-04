type Listener = (coins: number) => void;
const listeners = new Set<Listener>();

export function addViewCoinListener(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitViewCoins(coins: number): void {
  if (coins <= 0) return;
  for (const fn of listeners) {
    try {
      fn(coins);
    } catch {
      /* ignore */
    }
  }
}
