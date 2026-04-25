/**
 * Socket.io client service — singleton wrapper.
 * Install: npm install socket.io-client
 */
import {io, type Socket} from 'socket.io-client';
import {getAuth} from '@react-native-firebase/auth';
import {apiBase, getIdToken} from '../api/authApi';
import type {Post} from '../api/postsApi';

type SocketEvents = {
  // Server → client
  'post:new': (post: Post) => void;
  'post:like': (data: {postId: string; likesCount: number; liked: boolean; userId: string}) => void;
  'post:comment': (data: {postId: string; commentsCount: number; comment: object}) => void;
  'post:delete': (data: {postId: string; authorId?: string; type?: string}) => void;
  /** Accurate notification badge — prefer this over polling `/notifications/unread-count`. */
  'notification:unread': (data: {count: number}) => void;
  /** Total unread across all DM conversations for the current user. */
  'chat:unread': (data: {total: number}) => void;
  'story:new': (data: {authorId: string}) => void;
  'story:delete': (data: {authorId: string; storyPostId: string}) => void;
  'live:start': (data: {streamId: string; userId: string; title: string; viewerCount: number}) => void;
  'live:end': (data: {streamId: string}) => void;
  'live:viewer_count': (data: {streamId: string; viewerCount: number}) => void;
  'live:comment': (data: {streamId: string; username: string; text: string}) => void;
  'notification': (data: {type: string; actorId: string; targetId?: string; message: string}) => void;
};

class SocketService {
  private socket: Socket | null = null;
  private lastErrLogAt = 0;
  private lastErrMsg = '';

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const user = getAuth().currentUser;
    if (!user) return;

    let token: string;
    try {
      token = await getIdToken(false);
    } catch {
      return;
    }

    const base = apiBase();
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
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): () => void {
    this.socket?.on(event as string, handler as (...args: unknown[]) => void);
    return () => this.socket?.off(event as string, handler as (...args: unknown[]) => void);
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }

  joinLive(streamId: string): void {
    this.socket?.emit('live:join', {streamId});
  }

  leaveLive(streamId: string): void {
    this.socket?.emit('live:leave', {streamId});
  }

  sendLiveComment(streamId: string, text: string): void {
    this.socket?.emit('live:send_comment', {streamId, text});
  }

  sendLiveLike(streamId: string): void {
    this.socket?.emit('live:send_like', {streamId});
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
