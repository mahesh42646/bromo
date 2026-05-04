import type {FollowAttribution} from '../api/followApi';

/** Maps feature context to server-supported Follow `source` kinds + optional Mongo ref id. */
export function followSourceForContext(
  ctx:
    | {surface: 'home_feed'; postId: string}
    | {surface: 'reels'; postId: string}
    | {surface: 'search'}
    | {surface: 'profile_suggestions'}
    | {surface: 'comments'; postId: string},
): FollowAttribution {
  switch (ctx.surface) {
    case 'home_feed':
      return {kind: 'post', refId: ctx.postId};
    case 'reels':
      return {kind: 'reel', refId: ctx.postId};
    case 'search':
      return {kind: 'search'};
    case 'profile_suggestions':
      return {kind: 'discover'};
    case 'comments':
      return {kind: 'post', refId: ctx.postId};
  }
}
