import {authedFetch} from './authApi';

export type CollaborationRow = {
  _id: string;
  brandUserId: string;
  creatorUserId: string;
  title: string;
  brief: string;
  paid: boolean;
  payoutCoins?: number;
  status: 'invited' | 'accepted' | 'declined' | 'completed';
  createdAt: string;
  updatedAt: string;
};

export async function getCollabInbox(): Promise<{items: CollaborationRow[]}> {
  const res = await authedFetch('/collabs/inbox');
  if (!res.ok) throw new Error('Failed to load collaborations');
  return res.json() as Promise<{items: CollaborationRow[]}>;
}
