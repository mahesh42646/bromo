/**
 * Socket.io client service — singleton wrapper.
 * Install: npm install socket.io-client
 */
import {io, type Socket} from 'socket.io-client';
import {getAuth} from '@react-native-firebase/auth';
import {apiBase, getIdToken} from '../api/authApi';
import type {Post} from '../api/postsApi';
import type {ApiMessage} from '../api/chatApi';

export type CallSocketIncoming = {
  callId: string;
  fromUserId: string;
  callType: 'audio' | 'video';
  callerName?: string;
};

type SocketEvents = {
  // Server → client
  'post:new': (post: Post) => void;
  'post:like': (data: {postId: string; likesCount: number; liked: boolean; userId: string}) => void;
  'post:comment': (data: {postId: string; commentsCount: number; comment: object}) => void;
  'post:share': (data: {postId: string; sharesCount: number}) => void;
  'post:delete': (data: {postId: string; authorId?: string; type?: string}) => void;
  /** Accurate notification badge — prefer this over polling `/notifications/unread-count`. */
  'notification:unread': (data: {count: number}) => void;
  /** Total unread across all DM conversations for the current user. */
  'chat:unread': (data: {total: number}) => void;
  'chat:message': (data: {conversationId: string; message: ApiMessage}) => void;
  'chat:message_updated': (data: {conversationId: string; message: ApiMessage}) => void;
  'chat:read': (data: {conversationId: string; readerId: string}) => void;
  'message:new': (data: {conversationId: string; message: ApiMessage}) => void;
  'message:edited': (data: {conversationId: string; message: ApiMessage}) => void;
  'message:unsent': (data: {conversationId: string; message: ApiMessage}) => void;
  'message:reaction': (data: {conversationId: string; message: ApiMessage}) => void;
  'message:read': (data: {conversationId: string; readerId: string}) => void;
  'typing:start': (data: {conversationId: string; userId: string}) => void;
  'typing:stop': (data: {conversationId: string; userId: string}) => void;
  'presence:online': (data: {userId: string}) => void;
  'presence:offline': (data: {userId: string}) => void;
  'story:new': (data: {authorId: string}) => void;
  'story:delete': (data: {authorId: string; storyPostId: string}) => void;
  'live:start': (data: {streamId: string; userId: string; title: string; viewerCount: number}) => void;
  'live:end': (data: {streamId: string}) => void;
  'live:viewer_count': (data: {streamId: string; viewerCount: number}) => void;
  'live:comment': (data: {streamId: string; username: string; text: string}) => void;
  'notification': (data: {type: string; actorId: string; targetId?: string; message: string}) => void;

  'call:incoming': (data: CallSocketIncoming) => void;
  'call:accepted': (data: {callId: string; peerUserId: string}) => void;
  'call:rejected': (data: {callId: string}) => void;
  'call:ended': (data: {callId: string; byUserId: string}) => void;
  'call:sdp': (data: {
    callId: string;
    fromUserId: string;
    sdp: string;
    sdpType: 'offer' | 'answer';
  }) => void;
  'call:ice': (data: {
    callId: string;
    fromUserId: string;
    candidate: Record<string, unknown> | null;
  }) => void;
};

class SocketService {
  private socket: Socket | null = null;
  private connectPromise: Promise<void> | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private pendingEmits: Array<{event: string; data?: unknown}> = [];
  private lastErrLogAt = 0;
  private lastErrMsg = '';

  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.connectInternal().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async connectInternal(): Promise<void> {
    const user = getAuth().currentUser;
    if (!user) return;

    let token: string;
    try {
      token = await getIdToken(false);
    } catch {
      return;
    }

    const base = apiBase();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = io(base, {
      auth: {token},
      // Polling first: many reverse proxies break immediate WebSocket handshakes; upgrade when possible.
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 15000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      const q = this.pendingEmits.splice(0);
      q.forEach(item => this.socket?.emit(item.event, item.data));
    });

    this.socket.on('disconnect', reason => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', err => {
      const msg = err?.message || 'unknown';
      const now = Date.now();
      if (msg !== this.lastErrMsg || now - this.lastErrLogAt > 8000) {
        this.lastErrMsg = msg;
        this.lastErrLogAt = now;
        console.warn('[Socket] Connect error:', msg);
      }
    });
    this.attachListeners();
  }

  private attachListeners(): void {
    if (!this.socket) return;
    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.pendingEmits = [];
  }

  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): () => void {
    const eventName = event as string;
    const cb = handler as (...args: unknown[]) => void;
    const set = this.listeners.get(eventName) ?? new Set<(...args: unknown[]) => void>();
    set.add(cb);
    this.listeners.set(eventName, set);
    this.socket?.on(eventName, cb);
    return () => {
      this.listeners.get(eventName)?.delete(cb);
      this.socket?.off(eventName, cb);
    };
  }

  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      return;
    }
    this.pendingEmits.push({event, data});
    this.connect().catch(() => null);
  }

  emitTyping(conversationId: string, typing: boolean): void {
    this.emit(typing ? 'typing:start' : 'typing:stop', {conversationId});
  }

  joinLive(streamId: string): void {
    this.emit('live:join', {streamId});
  }

  leaveLive(streamId: string): void {
    this.emit('live:leave', {streamId});
  }

  sendLiveComment(streamId: string, text: string): void {
    this.emit('live:send_comment', {streamId, text});
  }

  sendLiveLike(streamId: string): void {
    this.emit('live:send_like', {streamId});
  }

  emitCallInvite(payload: {
    callId: string;
    toUserId: string;
    callType: 'audio' | 'video';
    callerName?: string;
  }): void {
    this.emit('call:invite', payload);
  }

  emitCallAccept(payload: {callId: string}): void {
    this.emit('call:accept', payload);
  }

  emitCallReject(payload: {callId: string}): void {
    this.emit('call:reject', payload);
  }

  emitCallEnd(payload: {callId: string}): void {
    this.emit('call:end', payload);
  }

  emitCallSdp(payload: {
    toUserId: string;
    callId: string;
    sdp: string;
    sdpType: 'offer' | 'answer';
  }): void {
    this.emit('call:sdp', payload);
  }

  emitCallIce(payload: {
    toUserId: string;
    callId: string;
    candidate: Record<string, unknown>;
  }): void {
    this.emit('call:ice', payload);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
