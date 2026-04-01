const fmt = (d: Date) =>
  d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit', hour12: true});

export function formatThreadRowTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return fmt(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYest =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYest) return 'Yesterday';
  return d.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
}

export function formatBubbleTime(ts: number): string {
  return fmt(new Date(ts)).toUpperCase();
}

/** Returns a centered date line label when day changes (compare to previous message ts). */
export function daySeparatorLabel(ts: number, prevTs: number | null): string | null {
  if (prevTs === null) return null;
  const a = new Date(ts);
  const b = new Date(prevTs);
  const same =
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();
  if (same) return null;
  return a
    .toLocaleDateString(undefined, {weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true})
    .toUpperCase();
}
