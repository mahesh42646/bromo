export type UserLabelId = 'bff' | 'friend' | 'brother' | 'sister' | 'family' | 'work' | null;

export type MessageDelivery = 'sending' | 'sent' | 'delivered' | 'read';

export type ChatPeer = {
  id: string;
  userId?: string;
  displayName: string;
  username: string;
  avatar: string;
  label: UserLabelId;
  verified?: boolean;
  isGroup?: boolean;
};

export type ReactionEntry = {
  emoji: string;
  count: number;
  includesMe: boolean;
};

export type MessageBase = {
  id: string;
  peerId: string;
  senderId: 'me' | string;
  createdAt: number;
  delivery: MessageDelivery;
  editedAt?: number;
  replyToId?: string;
  forwardedFromName?: string;
  reactions: ReactionEntry[];
  /** If present, message was removed for everyone (placeholder kept for thread ordering) */
  unsent?: boolean;
  /** Server-driven delete-for-everyone tombstone (distinct from legacy unsend UX copy). */
  deletedForEveryone?: boolean;
};

export type TextMessage = MessageBase & {kind: 'text'; text: string};

export type ImageMessage = MessageBase & {kind: 'image'; uri: string; width?: number; height?: number};

export type VideoMessage = MessageBase & {kind: 'video'; uri: string; thumbnailUri?: string};

export type AudioMessage = MessageBase & {kind: 'audio'; durationLabel: string; uri?: string};

export type GifMessage = MessageBase & {kind: 'gif'; uri: string; title?: string};

export type StickerMessage = MessageBase & {kind: 'sticker'; uri: string; name?: string};

export type LocationMessage = MessageBase & {
  kind: 'location';
  lat: number;
  lng: number;
  label: string;
};

export type SharedPostMessage = MessageBase & {
  kind: 'shared_post';
  postId?: string;
  previewUri: string;
  authorUsername: string;
  authorAvatar: string;
};

export type ChatMessage =
  | TextMessage
  | ImageMessage
  | VideoMessage
  | AudioMessage
  | GifMessage
  | StickerMessage
  | LocationMessage
  | SharedPostMessage;

export type ChatListFilter = 'all' | 'unread' | 'close';

export const USER_LABEL_OPTIONS: {id: UserLabelId; label: string}[] = [
  {id: 'bff', label: 'BFF'},
  {id: 'friend', label: 'Friend'},
  {id: 'brother', label: 'Brother'},
  {id: 'sister', label: 'Sister'},
  {id: 'family', label: 'Family'},
  {id: 'work', label: 'Work'},
  {id: null, label: 'No label'},
];
