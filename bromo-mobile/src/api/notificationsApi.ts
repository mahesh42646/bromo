import {authedFetch} from './authApi';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'follow_accept'
  | 'mention'
  | 'message'
  | 'milestone';

export type AppNotification = {
  _id: string;
  actorId: {
    _id: string;
    username: string;
    displayName: string;
    profilePicture: string;
  };
  type: NotificationType;
  postId?: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
  page: number;
  hasMore: boolean;
};

export async function getNotifications(page = 1, unreadOnly = false): Promise<NotificationsResponse> {
  const res = await authedFetch(`/notifications?page=${page}&unreadOnly=${unreadOnly}`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json() as Promise<NotificationsResponse>;
}

export async function getUnreadCount(): Promise<number> {
  try {
    const res = await authedFetch('/notifications/unread-count');
    if (!res.ok) return 0;
    const data = await res.json() as {count: number};
    return data.count;
  } catch {
    return 0;
  }
}

export async function markAllRead(): Promise<void> {
  await authedFetch('/notifications/read-all', {method: 'POST'}).catch(() => null);
}

export async function markRead(id: string): Promise<void> {
  await authedFetch(`/notifications/${id}/read`, {method: 'PATCH'}).catch(() => null);
}
