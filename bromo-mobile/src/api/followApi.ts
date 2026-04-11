import {authedFetch} from './authApi';

export type UserProfile = {
  _id: string;
  username: string;
  displayName: string;
  profilePicture: string;
  bio: string;
  website: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  emailVerified: boolean;
  followStatus: 'none' | 'following' | 'requested';
};

export type SuggestedUser = Omit<UserProfile, 'followStatus' | 'bio' | 'website'>;

export async function getUserSuggestions(limit = 10): Promise<{users: SuggestedUser[]}> {
  const res = await authedFetch(`/users/suggestions?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to get suggestions');
  return res.json() as Promise<{users: SuggestedUser[]}>;
}

export async function searchUsers(q: string): Promise<{users: (SuggestedUser & {followStatus: string})[]}> {
  const res = await authedFetch(`/users/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json() as Promise<{users: (SuggestedUser & {followStatus: string})[]}>;
}

export async function getUserProfile(userId: string): Promise<{user: UserProfile}> {
  const res = await authedFetch(`/users/${userId}/profile`);
  if (!res.ok) throw new Error('User not found');
  return res.json() as Promise<{user: UserProfile}>;
}

export async function getFollowers(userId: string, page = 1): Promise<{users: SuggestedUser[]; hasMore: boolean}> {
  const res = await authedFetch(`/users/${userId}/followers?page=${page}`);
  if (!res.ok) throw new Error('Failed to get followers');
  return res.json() as Promise<{users: SuggestedUser[]; hasMore: boolean}>;
}

export async function getFollowing(userId: string, page = 1): Promise<{users: SuggestedUser[]; hasMore: boolean}> {
  const res = await authedFetch(`/users/${userId}/following?page=${page}`);
  if (!res.ok) throw new Error('Failed to get following');
  return res.json() as Promise<{users: SuggestedUser[]; hasMore: boolean}>;
}

export async function followUser(userId: string): Promise<{status: 'accepted' | 'pending'}> {
  const res = await authedFetch(`/users/${userId}/follow`, {method: 'POST'});
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed to follow');
  }
  return res.json() as Promise<{status: 'accepted' | 'pending'}>;
}

export async function unfollowUser(userId: string): Promise<void> {
  const res = await authedFetch(`/users/${userId}/follow`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to unfollow');
}

export async function getFollowRequests(): Promise<{requests: {_id: string; from: SuggestedUser; createdAt: string}[]}> {
  const res = await authedFetch('/users/follow-requests');
  if (!res.ok) throw new Error('Failed to get follow requests');
  return res.json() as Promise<{requests: {_id: string; from: SuggestedUser; createdAt: string}[]}>;
}

export async function acceptFollowRequest(requestId: string): Promise<void> {
  const res = await authedFetch(`/users/follow-request/${requestId}/accept`, {method: 'PATCH'});
  if (!res.ok) throw new Error('Failed to accept request');
}

export async function rejectFollowRequest(requestId: string): Promise<void> {
  const res = await authedFetch(`/users/follow-request/${requestId}`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to reject request');
}
