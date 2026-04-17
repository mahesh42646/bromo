import {authedFetch} from './authApi';

export type DraftRecord = {
  _id: string;
  type: 'post' | 'reel' | 'story';
  localUri: string;
  thumbnailUri: string;
  mediaType: 'image' | 'video';
  caption: string;
  location: string;
  locationMeta?: {name: string; lat: number; lng: number};
  tags: string[];
  taggedUserIds: string[];
  productIds: string[];
  music: string;
  feedCategory: string;
  filters?: Record<string, unknown>;
  trim?: {startMs: number; endMs: number};
  settings?: {
    commentsOff?: boolean;
    hideLikes?: boolean;
    allowRemix?: boolean;
    closeFriendsOnly?: boolean;
  };
  durationMs?: number;
  updatedAt: string;
  createdAt: string;
};

export async function listDrafts(): Promise<{drafts: DraftRecord[]}> {
  const res = await authedFetch(`/drafts`);
  if (!res.ok) return {drafts: []};
  return res.json() as Promise<{drafts: DraftRecord[]}>;
}

export async function createDraft(body: Partial<DraftRecord>): Promise<{draft: DraftRecord}> {
  const res = await authedFetch(`/drafts`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save draft');
  return res.json() as Promise<{draft: DraftRecord}>;
}

export async function updateDraft(
  id: string,
  body: Partial<DraftRecord>,
): Promise<{draft: DraftRecord}> {
  const res = await authedFetch(`/drafts/${id}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update draft');
  return res.json() as Promise<{draft: DraftRecord}>;
}

export async function deleteDraft(id: string): Promise<void> {
  await authedFetch(`/drafts/${id}`, {method: 'DELETE'});
}
