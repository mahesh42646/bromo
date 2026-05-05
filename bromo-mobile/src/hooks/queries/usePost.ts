import {useQuery} from '@tanstack/react-query';
import {getPost, type Post} from '../../api/postsApi';
import {findCachedPost, primePostCache} from '../../lib/queryClient';

export function usePost(postId: string, initialPost?: Post | null) {
  return useQuery({
    queryKey: ['post', postId],
    enabled: Boolean(postId),
    initialData: initialPost ?? findCachedPost(postId),
    queryFn: async () => {
      const {post} = await getPost(postId);
      primePostCache(post);
      return post;
    },
  });
}
