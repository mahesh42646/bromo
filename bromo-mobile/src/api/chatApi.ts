import {authedFetch, apiBase} from './authApi';

export type ConversationParticipant = {
  _id: string;
  username: string;
  displayName: string;
  profilePicture: string;
};

export type ApiConversation = {
  _id: string;
  participants: ConversationParticipant[];
  otherParticipants: ConversationParticipant[];
  lastMessageText: string;
  lastMessageAt: string;
  isGroup: boolean;
  groupName: string;
  groupAvatar: string;
  unreadCount: number;
};

export type ApiMessage = {
  _id: string;
  conversationId: string;
  senderId: ConversationParticipant;
  type: 'text' | 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'location';
  text: string;
  mediaUrl: string;
  meta: Record<string, unknown>;
  replyToId?: ApiMessage;
  isUnsent: boolean;
  editedAt?: string;
  reactions: Array<{userId: string; emoji: string}>;
  createdAt: string;
};

export async function getConversations(): Promise<{conversations: ApiConversation[]}> {
  const res = await authedFetch('/chat/conversations');
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json() as Promise<{conversations: ApiConversation[]}>;
}

export async function createConversation(participantId: string): Promise<{conversation: ApiConversation; created: boolean}> {
  const res = await authedFetch('/chat/conversations', {
    method: 'POST',
    body: JSON.stringify({participantId}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed to create conversation');
  }
  return res.json() as Promise<{conversation: ApiConversation; created: boolean}>;
}

export async function getMessages(
  conversationId: string,
  page = 1,
): Promise<{messages: ApiMessage[]; hasMore: boolean}> {
  const res = await authedFetch(`/chat/conversations/${conversationId}/messages?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json() as Promise<{messages: ApiMessage[]; hasMore: boolean}>;
}

export async function sendMessage(
  conversationId: string,
  data: {
    type: string;
    text?: string;
    mediaUrl?: string;
    meta?: Record<string, unknown>;
    replyToId?: string;
  },
): Promise<{message: ApiMessage}> {
  const res = await authedFetch(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as {message?: string}).message ?? 'Failed to send message');
  }
  return res.json() as Promise<{message: ApiMessage}>;
}

export async function unsendMessage(messageId: string): Promise<void> {
  const res = await authedFetch(`/chat/messages/${messageId}/unsend`, {method: 'PUT'});
  if (!res.ok) throw new Error('Failed to unsend message');
}

export async function editMessage(messageId: string, text: string): Promise<void> {
  const res = await authedFetch(`/chat/messages/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify({text}),
  });
  if (!res.ok) throw new Error('Failed to edit message');
}

export async function reactToMessage(messageId: string, emoji: string): Promise<void> {
  const res = await authedFetch(`/chat/messages/${messageId}/react`, {
    method: 'POST',
    body: JSON.stringify({emoji}),
  });
  if (!res.ok) throw new Error('Failed to react');
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await authedFetch(`/chat/conversations/${conversationId}/read`, {method: 'POST'}).catch(() => null);
}

export async function uploadChatMedia(localUri: string): Promise<{url: string}> {
  const auth = (await import('@react-native-firebase/auth')).default;
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken(true);
  const base = apiBase();

  const filename = localUri.split('/').pop() ?? 'media.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime',
    gif: 'image/gif', aac: 'audio/aac', m4a: 'audio/mp4',
  };

  const form = new FormData();
  form.append('file', {uri: localUri, type: mimeMap[ext] ?? 'application/octet-stream', name: filename} as unknown as Blob);

  const res = await fetch(`${base}/media/upload`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json() as Promise<{url: string}>;
}
