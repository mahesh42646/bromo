import {Linking} from 'react-native';
import {getPost, type PostAuthor} from '../api/postsApi';
import {getUserProfileByUsername} from '../api/followApi';
import {primePostCache, primeAuthorCache} from './queryClient';

function normalizePath(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === 'bromo:') {
    return `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, '');
  }
  return parsed.pathname.replace(/^\/+/, '');
}

/** Best-effort warm cache before navigation paints (cold start / universal links). */
export async function prefetchDeepLinkContent(url: string): Promise<void> {
  try {
    const path = normalizePath(url);
    const [kind, rawId] = path.split('/');
    const id = decodeURIComponent(rawId ?? '').trim();
    if (!kind || !id) return;

    if (kind === 'p' || kind === 'r') {
      const {post} = await getPost(id);
      primePostCache(post);
      primeAuthorCache(post.author);
      return;
    }

    if (kind === 'u') {
      const {user} = await getUserProfileByUsername(id);
      const author: PostAuthor = {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        isPrivate: user.isPrivate,
        emailVerified: user.emailVerified,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        isCreator: user.isCreator,
        creatorStatus: user.creatorStatus,
        creatorBadge: user.creatorBadge,
        connectedStore: user.connectedStore,
      };
      primeAuthorCache(author);
    }
  } catch {
    /* non-fatal */
  }
}

export async function prefetchInitialUrlIfAny(): Promise<void> {
  const url = await Linking.getInitialURL();
  if (url) await prefetchDeepLinkContent(url);
}
