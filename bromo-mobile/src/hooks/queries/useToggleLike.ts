import {useMutation, useQueryClient} from '@tanstack/react-query';
import {toggleLike} from '../../api/postsApi';

/** Like/unlike with cache refresh for feed, reels, and post detail. */
export function useToggleLike(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => toggleLike(postId),
    onSuccess: res => {
      qc.setQueryData(['post', postId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const p = old as {isLiked?: boolean; likesCount?: number};
        return {...p, isLiked: res.liked, likesCount: res.likesCount};
      });
      void qc.invalidateQueries({queryKey: ['feed']});
      void qc.invalidateQueries({queryKey: ['reels']});
    },
  });
}
