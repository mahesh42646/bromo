import {settings} from '../config/settings';

export type ShareKind = 'reel' | 'post' | 'profile' | 'story' | 'chat';

const PATH_PREFIX: Record<ShareKind, string> = {
  reel: 'r',
  post: 'p',
  profile: 'u',
  story: 's',
  chat: 'chat',
};

export function getShareUrl(input: {kind: ShareKind; id: string}): string {
  const host = settings.shareHost || settings.apiBaseUrl;
  const id = encodeURIComponent(input.id.trim());
  return `${host}/${PATH_PREFIX[input.kind]}/${id}`;
}

export function getInAppUrl(input: {kind: ShareKind; id: string}): string {
  const id = encodeURIComponent(input.id.trim());
  return `bromo://${PATH_PREFIX[input.kind]}/${id}`;
}
