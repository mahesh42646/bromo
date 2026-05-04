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
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  isCreator?: boolean;
  creatorStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  creatorBadge?: boolean;
  connectedStore?: {
    enabled?: boolean;
    website?: string;
    planId?: string;
    provider?: string;
    productCatalogUrl?: string;
    icon?: boolean;
  };
  interests?: string[];
  followStatus: 'none' | 'following' | 'requested';
  followsMe?: boolean;
  relation?: UserRelation;
};

export type UserRelation = {
  iFollow: boolean;
  followsMe: boolean;
  isMe: boolean;
  chatId?: string;
};

export type SuggestedUser = Omit<UserProfile, 'bio' | 'website' | 'followStatus'> & {
  followStatus?: UserProfile['followStatus'];
};

export async function getUserSuggestions(
  limit = 10,
  opts?: {context?: 'profile'; peerId?: string},
): Promise<{users: SuggestedUser[]}> {
  const params = new URLSearchParams({limit: String(limit)});
  if (opts?.context) params.set('context', opts.context);
  if (opts?.peerId) params.set('peerId', opts.peerId);
  const res = await authedFetch(`/users/suggestions?${params.toString()}`);
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

export async function getUserMutuals(userId: string, limit = 3): Promise<{count: number; sample: SuggestedUser[]}> {
  const res = await authedFetch(`/users/${userId}/mutuals?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to get mutuals');
  return res.json() as Promise<{count: number; sample: SuggestedUser[]}>;
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

export type FollowAttributionSummary = {kind: string; refId?: string; count: number; lastAt: string};

export async function getMyFollowAttribution(): Promise<{items: FollowAttributionSummary[]}> {
  const res = await authedFetch('/users/me/follow-attribution');
  if (!res.ok) throw new Error('Failed to load follow attribution');
  return res.json() as Promise<{items: FollowAttributionSummary[]}>;
}

export type FollowAttribution = {
  kind: 'profile' | 'post' | 'reel' | 'story' | 'search' | 'discover' | 'chat' | 'wallet';
  refId?: string;
};

export async function followUser(
  userId: string,
  attribution?: FollowAttribution,
): Promise<{status: 'accepted' | 'pending'}> {
  const res = await authedFetch(`/users/${userId}/follow`, {
    method: 'POST',
    body: JSON.stringify(
      attribution ? {source: {kind: attribution.kind, ...(attribution.refId ? {refId: attribution.refId} : {})}} : {},
    ),
  });
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

export async function removeFollower(userId: string): Promise<void> {
  const res = await authedFetch(`/users/${userId}/follower`, {method: 'DELETE'});
  if (!res.ok) throw new Error('Failed to remove follower');
  DeviceEventEmitter.emit('bromo:followerRemoved', {userId});
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

export async function reportUser(userId: string, reason = 'other'): Promise<void> {
  const res = await authedFetch(`/users/${userId}/report`, {
    method: 'POST',
    body: JSON.stringify({reason}),
  });
  if (!res.ok) throw new Error('Failed to report user');
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
