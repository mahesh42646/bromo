import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {ChatListFilter, ChatMessage, ChatPeer, MessageDelivery, UserLabelId} from './messageTypes';
import {INITIAL_MESSAGES, INITIAL_THREAD_ORDER, USER_DIRECTORY} from './mockMessaging';

const SELF = 'me' as const;

function newMsgId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export {newMsgId};

function peersRecord(): Record<string, ChatPeer> {
  const r: Record<string, ChatPeer> = {};
  for (const p of USER_DIRECTORY) {
    r[p.id] = {...p};
  }
  return r;
}

function cloneMessages(): Record<string, ChatMessage[]> {
  const out: Record<string, ChatMessage[]> = {};
  for (const k of Object.keys(INITIAL_MESSAGES)) {
    out[k] = INITIAL_MESSAGES[k].map(m => ({
      ...m,
      reactions: m.reactions.map(x => ({...x})),
    }));
  }
  return out;
}

function initialLastRead(): Record<string, number> {
  const now = Date.now();
  const r: Record<string, number> = {};
  for (const id of INITIAL_THREAD_ORDER) {
    const msgs = INITIAL_MESSAGES[id];
    const last = msgs?.[msgs.length - 1];
    r[id] = id === 'u3' ? now - 120 * 60000 : last?.createdAt ?? 0;
  }
  return r;
}

function initialLastTouched(): Record<string, number> {
  const r: Record<string, number> = {};
  for (const id of INITIAL_THREAD_ORDER) {
    const msgs = INITIAL_MESSAGES[id];
    const last = msgs?.[msgs.length - 1];
    r[id] = last?.createdAt ?? Date.now();
  }
  return r;
}

function messagePreview(m: ChatMessage): string {
  if (m.unsent) return 'You unsent a message';
  switch (m.kind) {
    case 'text':
      return m.text;
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎬 Video';
    case 'audio':
      return '🎤 Voice message';
    case 'gif':
      return 'GIF';
    case 'sticker':
      return 'Sticker';
    case 'location':
      return `📍 ${m.label}`;
    case 'shared_post':
      return `Shared a post · @${m.authorUsername}`;
    default:
      return 'Message';
  }
}

type MessagingContextValue = {
  peers: Record<string, ChatPeer>;
  threadOrder: string[];
  messagesByPeer: Record<string, ChatMessage[]>;
  lastReadAt: Record<string, number>;
  ensureThread: (peerId: string) => void;
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
  filterThreads: (
    filter: ChatListFilter,
    search: string,
  ) => {peer: ChatPeer; preview: string; time: number; unread: number}[];
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({children}: {children: ReactNode}) {
  const [peers, setPeers] = useState(peersRecord);
  const [threadOrder, setThreadOrder] = useState<string[]>(() => [...INITIAL_THREAD_ORDER]);
  const [messagesByPeer, setMessagesByPeer] = useState(cloneMessages);
  const [lastReadAt, setLastReadAt] = useState(initialLastRead);
  const [lastTouched, setLastTouched] = useState(initialLastTouched);

  const ensureThread = useCallback((peerId: string) => {
    if (!peers[peerId]) return;
    const t = Date.now();
    setLastTouched(prev => ({...prev, [peerId]: t}));
    setThreadOrder(prev =>
      prev.includes(peerId) ? [peerId, ...prev.filter(id => id !== peerId)] : [peerId, ...prev],
    );
    setMessagesByPeer(prev => (prev[peerId] ? prev : {...prev, [peerId]: []}));
  }, [peers]);

  const setPeerLabel = useCallback((peerId: string, label: UserLabelId) => {
    setPeers(prev => {
      const p = prev[peerId];
      if (!p) return prev;
      return {...prev, [peerId]: {...p, label}};
    });
  }, []);

  const markRead = useCallback((peerId: string) => {
    const t = Date.now();
    setLastReadAt(prev => ({...prev, [peerId]: t}));
  }, []);

  const sendMessage = useCallback((peerId: string, msg: ChatMessage) => {
    const t = Date.now();
    setLastTouched(prev => ({...prev, [peerId]: t}));
    setMessagesByPeer(prev => {
      const list = [...(prev[peerId] ?? []), msg];
      return {...prev, [peerId]: list};
    });
    setThreadOrder(prev => [peerId, ...prev.filter(id => id !== peerId)]);
  }, []);

  const finalizeOutgoing = useCallback((peerId: string, messageId: string) => {
    setMessagesByPeer(prev => {
      const list = (prev[peerId] ?? []).map(m =>
        m.id === messageId && m.senderId === SELF ? {...m, delivery: 'read' as const} : m,
      );
      return {...prev, [peerId]: list};
    });
  }, []);

  const setDelivery = useCallback((peerId: string, messageId: string, delivery: MessageDelivery) => {
    setMessagesByPeer(prev => ({
      ...prev,
      [peerId]: (prev[peerId] ?? []).map(m =>
        m.id === messageId ? {...m, delivery} : m,
      ),
    }));
  }, []);

  const editTextMessage = useCallback((peerId: string, messageId: string, text: string) => {
    setMessagesByPeer(prev => {
      const list = (prev[peerId] ?? []).map(m =>
        m.id === messageId && m.kind === 'text' && m.senderId === SELF
          ? {...m, text, editedAt: Date.now()}
          : m,
      );
      return {...prev, [peerId]: list};
    });
  }, []);

  const unsendMessage = useCallback((peerId: string, messageId: string) => {
    setMessagesByPeer(prev => {
      const list = (prev[peerId] ?? []).map(m =>
        m.id === messageId && m.senderId === SELF ? {...m, unsent: true} : m,
      );
      return {...prev, [peerId]: list};
    });
  }, []);

  const toggleReaction = useCallback((peerId: string, messageId: string, emoji: string) => {
    setMessagesByPeer(prev => {
      const list = (prev[peerId] ?? []).map(m => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find(r => r.emoji === emoji);
        if (existing?.includesMe) {
          const next = m.reactions
            .map(r =>
              r.emoji === emoji ? {...r, count: Math.max(0, r.count - 1), includesMe: false} : r,
            )
            .filter(r => r.count > 0);
          return {...m, reactions: next};
        }
        if (existing) {
          return {
            ...m,
            reactions: m.reactions.map(r =>
              r.emoji === emoji ? {...r, count: r.count + 1, includesMe: true} : r,
            ),
          };
        }
        return {...m, reactions: [...m.reactions, {emoji, count: 1, includesMe: true}]};
      });
      return {...prev, [peerId]: list};
    });
  }, []);

  const forwardMessage = useCallback((fromPeerId: string, messageId: string, toPeerId: string) => {
    const src = messagesByPeer[fromPeerId]?.find(m => m.id === messageId);
    if (!src || src.unsent || !peers[toPeerId]) return;
    const copy = {
      ...src,
      id: newMsgId(),
      peerId: toPeerId,
      senderId: SELF,
      createdAt: Date.now(),
      delivery: 'sending' as MessageDelivery,
      replyToId: undefined,
      forwardedFromName: peers[fromPeerId]?.displayName ?? 'Chat',
      reactions: [] as ChatMessage['reactions'],
      unsent: false,
    } as ChatMessage;
    sendMessage(toPeerId, copy);
    setTimeout(() => finalizeOutgoing(toPeerId, copy.id), 400);
  }, [messagesByPeer, peers, sendMessage, finalizeOutgoing]);

  const unreadForPeer = useCallback(
    (peerId: string) => {
      const lr = lastReadAt[peerId] ?? 0;
      const msgs = messagesByPeer[peerId] ?? [];
      return msgs.filter(m => m.senderId !== SELF && m.createdAt > lr).length;
    },
    [lastReadAt, messagesByPeer],
  );

  const searchDirectory = useCallback(
    (q: string) => {
      const s = q.trim().toLowerCase();
      if (!s) return Object.values(peers);
      return Object.values(peers).filter(
        p =>
          p.displayName.toLowerCase().includes(s) || p.username.toLowerCase().includes(s),
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

        if (s) {
          const match =
            peer.displayName.toLowerCase().includes(s) || peer.username.toLowerCase().includes(s);
          if (!match) continue;
        }

        if (filter === 'unread' && unreadForPeer(id) === 0) continue;
        if (filter === 'close') {
          const close = peer.label === 'bff' || peer.label === 'friend' || peer.label === 'family';
          if (!close) continue;
        }

        const last = msgs?.[msgs.length - 1];
        const time = last?.createdAt ?? lastTouched[id] ?? 0;
        rows.push({
          peer,
          preview: last ? messagePreview(last) : 'New conversation',
          time,
          unread: unreadForPeer(id),
        });
      }
      return rows.sort((a, b) => b.time - a.time);
    },
    [threadOrder, peers, messagesByPeer, lastTouched, unreadForPeer],
  );

  const value = useMemo(
    () => ({
      peers,
      threadOrder,
      messagesByPeer,
      lastReadAt,
      ensureThread,
      setPeerLabel,
      markRead,
      sendMessage,
      finalizeOutgoing,
      setDelivery,
      editTextMessage,
      unsendMessage,
      toggleReaction,
      forwardMessage,
      unreadForPeer,
      searchDirectory,
      filterThreads,
    }),
    [
      peers,
      threadOrder,
      messagesByPeer,
      lastReadAt,
      ensureThread,
      setPeerLabel,
      markRead,
      sendMessage,
      finalizeOutgoing,
      setDelivery,
      editTextMessage,
      unsendMessage,
      toggleReaction,
      forwardMessage,
      unreadForPeer,
      searchDirectory,
      filterThreads,
    ],
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging(): MessagingContextValue {
  const ctx = useContext(MessagingContext);
  if (!ctx) {
    throw new Error('useMessaging requires MessagingProvider');
  }
  return ctx;
}
