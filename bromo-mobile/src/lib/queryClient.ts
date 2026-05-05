import AsyncStorage from '@react-native-async-storage/async-storage';
import {QueryClient} from '@tanstack/react-query';
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';
import type {Post, PostAuthor} from '../api/postsApi';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@bromo/query-cache/v1',
  throttleTime: 1500,
});

function isPost(value: unknown): value is Post {
  return Boolean(
    value &&
      typeof value === 'object' &&
      '_id' in value &&
      'author' in value &&
      'mediaUrl' in value,
  );
}

function visitPosts(value: unknown, cb: (post: Post) => void): void {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach(item => visitPosts(item, cb));
    return;
  }
  if (typeof value !== 'object') return;
  if (isPost(value)) {
    cb(value);
    return;
  }
  const objectValue = value as Record<string, unknown>;
  if (Array.isArray(objectValue.posts)) {
    objectValue.posts.forEach(item => visitPosts(item, cb));
  }
  if (Array.isArray(objectValue.pages)) {
    objectValue.pages.forEach(item => visitPosts(item, cb));
  }
  if (objectValue.post) {
    visitPosts(objectValue.post, cb);
  }
  if (objectValue.data) {
    visitPosts(objectValue.data, cb);
  }
}

export function primePostCache(post: Post): void {
  queryClient.setQueryData(['post', post._id], post);
  primeAuthorCache(post.author);
}

export function primePostsCache(posts: Post[]): void {
  posts.forEach(primePostCache);
}

export function findCachedPost(postId: string): Post | undefined {
  const direct = queryClient.getQueryData<Post>(['post', postId]);
  if (direct) return direct;
  let found: Post | undefined;
  for (const [, data] of queryClient.getQueriesData({predicate: query => query.queryKey.some(part => part === 'feed' || part === 'reels' || part === 'posts')})) {
    visitPosts(data, post => {
      if (!found && post._id === postId) found = post;
    });
    if (found) break;
  }
  if (found) primePostCache(found);
  return found;
}

export function primeAuthorCache(author: PostAuthor): void {
  queryClient.setQueryData(['user-snapshot', author._id], author);
}

export function findCachedAuthor(userId: string): PostAuthor | undefined {
  const direct = queryClient.getQueryData<PostAuthor>(['user-snapshot', userId]);
  if (direct) return direct;
  let found: PostAuthor | undefined;
  for (const [, data] of queryClient.getQueriesData({predicate: query => query.queryKey.some(part => part === 'feed' || part === 'reels' || part === 'posts' || part === 'post')})) {
    visitPosts(data, post => {
      if (!found && post.author._id === userId) found = post.author;
    });
    if (found) break;
  }
  if (found) primeAuthorCache(found);
  return found;
}
