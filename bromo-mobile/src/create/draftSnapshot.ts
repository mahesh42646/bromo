import type {CreateDraftState} from './CreateDraftContext';

const SNAP_KEY = 'clientSnapshot';

/** Stored inside Draft.filters on the API so a device can resume editing. */
export function packClientSnapshot(d: CreateDraftState): Record<string, unknown> {
  return {[SNAP_KEY]: JSON.parse(JSON.stringify(d)) as CreateDraftState};
}

export function unpackClientSnapshot(filters: unknown): CreateDraftState | null {
  if (!filters || typeof filters !== 'object') return null;
  const raw = (filters as Record<string, unknown>)[SNAP_KEY];
  if (!raw || typeof raw !== 'object') return null;
  try {
    return raw as CreateDraftState;
  } catch {
    return null;
  }
}
