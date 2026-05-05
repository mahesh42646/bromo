import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {
  fetchStories,
  getFeed,
  getPost,
  getReels,
  getUserPosts,
  type FeedResponse,
  type Post,
} from '../../api/postsApi';
import {getConversations, getMessages} from '../../api/chatApi';
import {getUserProfile, type UserProfile} from '../../api/followApi';
import {findCachedAuthor, primePostsCache} from '../../lib/queryClient';

type PageParam = number;

function nextPage(lastPage: FeedResponse): number | undefined {
  return lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined;
}

export function useFeed(tab?: string) {
  return useInfiniteQuery({
    queryKey: ['feed', tab ?? 'default'],
    initialPageParam: 1 as PageParam,
    queryFn: async ({pageParam}) => {
      const data = await getFeed({tab, page: pageParam});
      primePostsCache(data.posts ?? []);
      return data;
    },
    getNextPageParam: nextPage,
  });
}

export function useReels() {
  return useInfiniteQuery({
    queryKey: ['reels'],
    initialPageParam: 1 as PageParam,
    queryFn: async ({pageParam}) => {
      const data = await getReels(pageParam);
      primePostsCache(data.posts ?? []);
      return data;
    },
    getNextPageParam: nextPage,
  });
}

export function useUserPosts(userId: string, type = 'post') {
  return useInfiniteQuery({
    queryKey: ['posts', 'user', userId, type],
    enabled: Boolean(userId),
    initialPageParam: 1 as PageParam,
    queryFn: async ({pageParam}) => {
      const data = await getUserPosts(userId, type, pageParam);
      primePostsCache(data.posts ?? []);
      return data;
    },
    getNextPageParam: nextPage,
  });
}

export function useStories() {
  return useQuery({
    queryKey: ['stories'],
    queryFn: () => fetchStories(),
  });
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['user-profile', userId],
    enabled: Boolean(userId),
    placeholderData: (): {user: UserProfile} | undefined => {
      const author = findCachedAuthor(userId);
      if (!author) return undefined;
      return {
        user: {
          ...author,
          bio: '',
          website: '',
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isPrivate: false,
          emailVerified: false,
          followStatus: 'none',
        } as UserProfile,
      };
    },
    queryFn: () => getUserProfile(userId),
  });
}

export function usePostById(postId: string, initialPost?: Post | null) {
  return useQuery({
    queryKey: ['post', postId],
    enabled: Boolean(postId),
    initialData: initialPost ?? undefined,
    queryFn: async () => (await getPost(postId)).post,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => getConversations({force: true}),
    staleTime: 30_000,
  });
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['chat', 'messages', conversationId],
    enabled: Boolean(conversationId),
    initialPageParam: 1 as PageParam,
    queryFn: ({pageParam}) => getMessages(conversationId, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    staleTime: 30_000,
  });
}
