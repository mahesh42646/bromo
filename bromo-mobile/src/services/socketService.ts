/**
 * Socket.io client service — singleton wrapper.
 * Install: npm install socket.io-client
 */
import {io, type Socket} from 'socket.io-client';
import auth from '@react-native-firebase/auth';
import {apiBase} from '../api/authApi';
import type {Post} from '../api/postsApi';

type SocketEvents = {
  // Server → client
  'post:new': (post: Post) => void;
  'post:like': (data: {postId: string; likesCount: number; liked: boolean; userId: string}) => void;
  'post:comment': (data: {postId: string; commentsCount: number; comment: object}) => void;
  'post:delete': (data: {postId: string}) => void;
  /** Accurate notification badge — prefer this over polling `/notifications/unread-count`. */
  'notification:unread': (data: {count: number}) => void;
  /** Total unread across all DM conversations for the current user. */
  'chat:unread': (data: {total: number}) => void;
  'story:new': (data: {authorId: string}) => void;
  'live:start': (data: {streamId: string; userId: string; title: string; viewerCount: number}) => void;
  'live:end': (data: {streamId: string}) => void;
  'live:viewer_count': (data: {streamId: string; viewerCount: number}) => void;
  'live:comment': (data: {streamId: string; username: string; text: string}) => void;
  'notification': (data: {type: string; actorId: string; targetId?: string; message: string}) => void;
};

class SocketService {
  private socket: Socket | null = null;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const user = auth().currentUser;
    if (!user) return;

    let token: string;
    try {
      token = await user.getIdToken(false);
    } catch {
      return;
    }

    const base = apiBase();
    this.socket = io(base, {
      auth: {token},
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', reason => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', err => {
      console.warn('[Socket] Connect error:', err.message);
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
