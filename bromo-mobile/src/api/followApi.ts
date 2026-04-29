import {authedFetch} from './authApi';
import {DeviceEventEmitter} from 'react-native';

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
  isVerified?: boolean;
  isCreator?: boolean;
  creatorStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  creatorBadge?: boolean;
  connectedStore?: {enabled?: boolean; website?: string; planId?: string};
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

export async function getNearbyUsers(lat: number, lng: number): Promise<{users: Array<SuggestedUser & {distanceMeters?: number}>}> {
  const res = await authedFetch(`/users/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
  if (!res.ok) throw new Error('Failed to get nearby users');
  return res.json() as Promise<{users: Array<SuggestedUser & {distanceMeters?: number}>}>;
}

export async function updateMyLocation(lat: number, lng: number): Promise<void> {
  await authedFetch('/users/location', {
    method: 'POST',
    body: JSON.stringify({lat, lng}),
  }).catch(() => null);
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
  const out = (await res.json()) as {status: 'accepted' | 'pending'};
  DeviceEventEmitter.emit('bromo:followChanged', {
    userId,
    following: out.status === 'accepted',
    requested: out.status === 'pending',
  });
  return out;
}

export async function unfollowUser(userId: string): Promise<void> {
  const res = await authedFetch(`/users/${userId}/follow`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to unfollow');
  DeviceEventEmitter.emit('bromo:followChanged', {userId, following: false, requested: false});
}

export async function blockUser(userId: string): Promise<void> {
  const res = await authedFetch(`/users/${userId}/block`, {method: 'POST'});
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed to block user');
  }
  DeviceEventEmitter.emit('bromo:userBlocked', {userId});
}

export async function unblockUser(userId: string): Promise<void> {
  const res = await authedFetch(`/users/${userId}/block`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to unblock user');
  DeviceEventEmitter.emit('bromo:userUnblocked', {userId});
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
