import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {ChatListFilter, ChatMessage, ChatPeer, MessageDelivery, UserLabelId} from './messageTypes';
import {USER_DIRECTORY} from './mockMessaging';
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  unsendMessage as apiUnsendMessage,
  editMessage as apiEditMessage,
  createConversation as apiCreateConversation,
  markConversationRead,
  type ApiConversation,
  type ApiMessage,
} from '../api/chatApi';

const SELF = 'me' as const;

function newMsgId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
export {newMsgId};

function isMongoId(s: string): boolean {
  return /^[a-f0-9]{24}$/i.test(s);
}

function apiMsgToLocal(m: ApiMessage, myDbUserId: string, peerId: string): ChatMessage {
  const isMine = m.senderId._id === myDbUserId || (m.senderId as unknown as string) === myDbUserId;
  const base = {
    id: m._id,
    peerId,
    senderId: isMine ? (SELF as 'me') : m.senderId._id,
    createdAt: new Date(m.createdAt).getTime(),
    delivery: 'read' as MessageDelivery,
    reactions: m.reactions.map(r => ({emoji: r.emoji, count: 1, includesMe: r.userId === myDbUserId})),
    unsent: m.isUnsent,
    editedAt: m.editedAt ? new Date(m.editedAt).getTime() : undefined,
    replyToId: m.replyToId?._id,
  };
  switch (m.type) {
    case 'image':
      return {...base, kind: 'image' as const, uri: m.mediaUrl};
    case 'video':
      return {...base, kind: 'video' as const, uri: m.mediaUrl};
    case 'audio':
      return {...base, kind: 'audio' as const, durationLabel: '0:00', uri: m.mediaUrl};
    case 'gif':
      return {...base, kind: 'gif' as const, uri: m.mediaUrl};
    case 'sticker':
      return {...base, kind: 'sticker' as const, uri: m.mediaUrl};
    case 'location': {
      const meta = m.meta as {lat?: number; lng?: number; label?: string};
      return {...base, kind: 'location' as const, lat: meta.lat ?? 0, lng: meta.lng ?? 0, label: meta.label ?? ''};
    }
    default:
      return {...base, kind: 'text' as const, text: m.text};
  }
}

function apiConvToPeer(conv: ApiConversation, myDbUserId: string): ChatPeer {
  if (conv.isGroup) {
    return {
      id: conv._id,
      displayName: conv.groupName || 'Group',
      username: conv._id,
      avatar: conv.groupAvatar || '',
      label: null,
      isGroup: true,
    };
  }
  const other = conv.otherParticipants.find(p => p._id !== myDbUserId) ?? conv.otherParticipants[0];
  return {
    id: conv._id,
    displayName: other?.displayName ?? 'User',
    username: other?.username ?? '',
    avatar: other?.profilePicture ?? '',
    label: null,
    verified: false,
  };
}

function messagePreview(m: ChatMessage): string {
  if (m.unsent) return 'You unsent a message';
  switch (m.kind) {
    case 'text': return m.text;
    case 'image': return '📷 Photo';
    case 'video': return '🎬 Video';
    case 'audio': return '🎤 Voice message';
    case 'gif': return 'GIF';
    case 'sticker': return 'Sticker';
    case 'location': return `📍 ${m.label}`;
    case 'shared_post': return `Shared a post · @${m.authorUsername}`;
    default: return 'Message';
  }
}

type MessagingContextValue = {
  peers: Record<string, ChatPeer>;
  threadOrder: string[];
  messagesByPeer: Record<string, ChatMessage[]>;
  lastReadAt: Record<string, number>;
  myDbUserId: string | null;
  loadingConversations: boolean;
  ensureThread: (peerId: string) => void;
  openThreadForUser: (userId: string, userDisplayName: string, userAvatar: string, userUsername: string) => Promise<string>;
  setPeerLabel: (peerId: string, label: UserLabelId) => void;
  markRead: (peerId: string) => void;
  sendMessage: (peerId: string, msg: ChatMessage) => void;
  finalizeOutgoing: (peerId: string, messageId: string) => void;
  setDelivery: (peerId: string, messageId: string, delivery: MessageDelivery) => void;
  editTextMessage: (peerId: string, messageId: string, text: string) => void;
  unsendMessage: (peerId: string, messageId: string) => void;
  toggleReaction: (peerId: string, messageId: string, emoji: string) => void;
  forwardMessage: (fromPeerId: string, messageId: string, toPeerId: string) => void;
  unreadForPeer: (peerId: string) => number;
  searchDirectory: (q: string) => ChatPeer[];
  filterThreads: (filter: ChatListFilter, search: string) => {peer: ChatPeer; preview: string; time: number; unread: number}[];
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

type Props = {children: ReactNode; myDbUserId: string | null};

export function MessagingProvider({children, myDbUserId}: Props) {
  const [peers, setPeers] = useState<Record<string, ChatPeer>>(() => {
    const r: Record<string, ChatPeer> = {};
    for (const p of USER_DIRECTORY) r[p.id] = {...p};
    return r;
  });
  const [threadOrder, setThreadOrder] = useState<string[]>([]);
  const [messagesByPeer, setMessagesByPeer] = useState<Record<string, ChatMessage[]>>({});
  const [lastReadAt, setLastReadAt] = useState<Record<string, number>>({});
  const [lastTouched, setLastTouched] = useState<Record<string, number>>({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const loadedThreads = useRef<Set<string>>(new Set());

  // Load real conversations when user is logged in
  useEffect(() => {
    if (!myDbUserId) return;

    setLoadingConversations(true);
    getConversations()
      .then(({conversations}) => {
        const newPeers: Record<string, ChatPeer> = {};
        const newOrder: string[] = [];
        const newMessages: Record<string, ChatMessage[]> = {};
        const newLastRead: Record<string, number> = {};
        const newLastTouched: Record<string, number> = {};

        for (const conv of conversations) {
          const peer = apiConvToPeer(conv, myDbUserId);
          newPeers[conv._id] = peer;
          newOrder.push(conv._id);
          newMessages[conv._id] = [];
          newLastRead[conv._id] = Date.now() - (conv.unreadCount > 0 ? 999999 : 0);
          newLastTouched[conv._id] = new Date(conv.lastMessageAt).getTime();
        }

        setPeers(prev => ({...prev, ...newPeers}));
        setThreadOrder(prev => {
          const existing = prev.filter(id => !newPeers[id]);
          return [...newOrder, ...existing];
        });
        setMessagesByPeer(prev => ({...newMessages, ...prev}));
        setLastReadAt(prev => ({...newLastRead, ...prev}));
        setLastTouched(prev => ({...newLastTouched, ...prev}));
      })
      .catch(() => {})
      .finally(() => setLoadingConversations(false));
  }, [myDbUserId]);

  const ensureThread = useCallback(
    (peerId: string) => {
      const t = Date.now();
      setLastTouched(prev => ({...prev, [peerId]: t}));
      setThreadOrder(prev =>
        prev.includes(peerId) ? [peerId, ...prev.filter(id => id !== peerId)] : [peerId, ...prev],
      );
      setMessagesByPeer(prev => (prev[peerId] ? prev : {...prev, [peerId]: []}));

      // Load messages from API for real conversations
      if (isMongoId(peerId) && myDbUserId && !loadedThreads.current.has(peerId)) {
        loadedThreads.current.add(peerId);
        getMessages(peerId, 1)
          .then(({messages}) => {
            const localMsgs = messages.map(m => apiMsgToLocal(m, myDbUserId, peerId));
            setMessagesByPeer(prev => ({...prev, [peerId]: localMsgs}));
          })
          .catch(() => {});
      }
    },
    [myDbUserId],
  );

  // Create or find a real conversation with a user, return the conversationId (peerId)
  const openThreadForUser = useCallback(
    async (userId: string, userDisplayName: string, userAvatar: string, userUsername: string): Promise<string> => {
      if (!myDbUserId) throw new Error('Not logged in');
      const {conversation} = await apiCreateConversation(userId);
      const convId = conversation._id;

      const peer: ChatPeer = {
        id: convId,
        displayName: userDisplayName,
        username: userUsername,
        avatar: userAvatar,
        label: null,
        verified: false,
      };
      setPeers(prev => ({...prev, [convId]: peer}));
      ensureThread(convId);
      return convId;
    },
    [myDbUserId, ensureThread],
  );

  const setPeerLabel = useCallback((peerId: string, label: UserLabelId) => {
    setPeers(prev => {
      const p = prev[peerId];
      if (!p) return prev;
      return {...prev, [peerId]: {...p, label}};
    });
  }, []);

  const markRead = useCallback(
    (peerId: string) => {
      const t = Date.now();
      setLastReadAt(prev => ({...prev, [peerId]: t}));
      if (isMongoId(peerId) && myDbUserId) {
        markConversationRead(peerId).catch(() => {});
      }
    },
    [myDbUserId],
  );

  const sendMessage = useCallback(
    (peerId: string, msg: ChatMessage) => {
      const t = Date.now();
      setLastTouched(prev => ({...prev, [peerId]: t}));
      setMessagesByPeer(prev => ({...prev, [peerId]: [...(prev[peerId] ?? []), msg]}));
      setThreadOrder(prev => [peerId, ...prev.filter(id => id !== peerId)]);

      // Persist to API for real conversations
      if (isMongoId(peerId) && myDbUserId) {
        const apiData: {type: string; text?: string; mediaUrl?: string; meta?: Record<string, unknown>} = {
          type: msg.kind,
        };
        if (msg.kind === 'text') apiData.text = msg.text;
        if (msg.kind === 'image' || msg.kind === 'video' || msg.kind === 'gif' || msg.kind === 'sticker') {
          apiData.mediaUrl = msg.uri;
        }
        if (msg.kind === 'audio' && msg.uri) apiData.mediaUrl = msg.uri;
        if (msg.kind === 'location') {
          apiData.meta = {lat: msg.lat, lng: msg.lng, label: msg.label};
        }
        if (msg.replyToId) apiData.meta = {...(apiData.meta ?? {}), replyToId: msg.replyToId};

        apiSendMessage(peerId, apiData).catch(() => {});
      }
    },
    [myDbUserId],
  );

  const finalizeOutgoing = useCallback((peerId: string, messageId: string) => {
    setMessagesByPeer(prev => ({
      ...prev,
      [peerId]: (prev[peerId] ?? []).map(m =>
        m.id === messageId && m.senderId === SELF ? {...m, delivery: 'read' as const} : m,
      ),
    }));
  }, []);

  const setDelivery = useCallback((peerId: string, messageId: string, delivery: MessageDelivery) => {
    setMessagesByPeer(prev => ({
      ...prev,
      [peerId]: (prev[peerId] ?? []).map(m => m.id === messageId ? {...m, delivery} : m),
    }));
  }, []);

  const editTextMessage = useCallback(
    (peerId: string, messageId: string, text: string) => {
      setMessagesByPeer(prev => ({
        ...prev,
        [peerId]: (prev[peerId] ?? []).map(m =>
          m.id === messageId && m.kind === 'text' && m.senderId === SELF
            ? {...m, text, editedAt: Date.now()}
            : m,
        ),
      }));
      if (isMongoId(peerId) && isMongoId(messageId) && myDbUserId) {
        apiEditMessage(messageId, text).catch(() => {});
      }
    },
    [myDbUserId],
  );

  const unsendMessage = useCallback(
    (peerId: string, messageId: string) => {
      setMessagesByPeer(prev => ({
        ...prev,
        [peerId]: (prev[peerId] ?? []).map(m =>
          m.id === messageId && m.senderId === SELF ? {...m, unsent: true} : m,
        ),
      }));
      if (isMongoId(peerId) && isMongoId(messageId) && myDbUserId) {
        apiUnsendMessage(messageId).catch(() => {});
      }
    },
    [myDbUserId],
  );

  const toggleReaction = useCallback((peerId: string, messageId: string, emoji: string) => {
    setMessagesByPeer(prev => {
      const list = (prev[peerId] ?? []).map(m => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find(r => r.emoji === emoji);
        if (existing?.includesMe) {
          return {...m, reactions: m.reactions.map(r => r.emoji === emoji ? {...r, count: Math.max(0, r.count - 1), includesMe: false} : r).filter(r => r.count > 0)};
        }
        if (existing) {
          return {...m, reactions: m.reactions.map(r => r.emoji === emoji ? {...r, count: r.count + 1, includesMe: true} : r)};
        }
        return {...m, reactions: [...m.reactions, {emoji, count: 1, includesMe: true}]};
      });
      return {...prev, [peerId]: list};
    });
  }, []);

  const forwardMessage = useCallback(
    (fromPeerId: string, messageId: string, toPeerId: string) => {
      const src = messagesByPeer[fromPeerId]?.find(m => m.id === messageId);
      if (!src || src.unsent || !peers[toPeerId]) return;
      const copy = {
        ...src,
        id: newMsgId(),
        peerId: toPeerId,
        senderId: SELF as 'me',
        createdAt: Date.now(),
        delivery: 'sending' as MessageDelivery,
        replyToId: undefined,
        forwardedFromName: peers[fromPeerId]?.displayName ?? 'Chat',
        reactions: [] as ChatMessage['reactions'],
        unsent: false,
      } as ChatMessage;
      sendMessage(toPeerId, copy);
      setTimeout(() => finalizeOutgoing(toPeerId, copy.id), 400);
    },
    [messagesByPeer, peers, sendMessage, finalizeOutgoing],
  );

  const unreadForPeer = useCallback(
    (peerId: string) => {
      const lr = lastReadAt[peerId] ?? 0;
      return (messagesByPeer[peerId] ?? []).filter(m => m.senderId !== SELF && m.createdAt > lr).length;
    },
    [lastReadAt, messagesByPeer],
  );

  const searchDirectory = useCallback(
    (q: string) => {
      const s = q.trim().toLowerCase();
      if (!s) return Object.values(peers);
      return Object.values(peers).filter(
        p => p.displayName.toLowerCase().includes(s) || p.username.toLowerCase().includes(s),
      );
    },
    [peers],
  );

  const filterThreads = useCallback(
    (filter: ChatListFilter, search: string) => {
      const s = search.trim().toLowerCase();
      const rows: {peer: ChatPeer; preview: string; time: number; unread: number}[] = [];
      for (const id of threadOrder) {
        const peer = peers[id];
        const msgs = messagesByPeer[id];
        if (!peer) continue;
        if (s && !peer.displayName.toLowerCase().includes(s) && !peer.username.toLowerCase().includes(s)) continue;
        if (filter === 'unread' && unreadForPeer(id) === 0) continue;
        if (filter === 'close' && peer.label !== 'bff' && peer.label !== 'friend' && peer.label !== 'family') continue;
        const last = msgs?.[msgs.length - 1];
        rows.push({
          peer,
          preview: last ? messagePreview(last) : 'New conversation',
          time: last?.createdAt ?? lastTouched[id] ?? 0,
          unread: unreadForPeer(id),
        });
      }
      return rows.sort((a, b) => b.time - a.time);
    },
    [threadOrder, peers, messagesByPeer, lastTouched, unreadForPeer],
  );

  const value = useMemo(
    () => ({
      peers, threadOrder, messagesByPeer, lastReadAt, myDbUserId, loadingConversations,
      ensureThread, openThreadForUser, setPeerLabel, markRead, sendMessage, finalizeOutgoing,
      setDelivery, editTextMessage, unsendMessage, toggleReaction, forwardMessage,
      unreadForPeer, searchDirectory, filterThreads,
    }),
    [
      peers, threadOrder, messagesByPeer, lastReadAt, myDbUserId, loadingConversations,
      ensureThread, openThreadForUser, setPeerLabel, markRead, sendMessage, finalizeOutgoing,
      setDelivery, editTextMessage, unsendMessage, toggleReaction, forwardMessage,
      unreadForPeer, searchDirectory, filterThreads,
    ],
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging(): MessagingContextValue {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging requires MessagingProvider');
  return ctx;
}
