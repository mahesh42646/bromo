import {Linking, Platform} from 'react-native';
import type {LinkingOptions} from '@react-navigation/native';
import type {BootstrapParamList} from './bootstrapParamList';
import {navigationRef} from './rootNavigation';
import {prefetchDeepLinkContent} from '../lib/deepLinkPrefetch';
import {universalLinkHost} from '../config/settings';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const linkingConfig: LinkingOptions<BootstrapParamList>['config'] = {
  screens: {
    App: {
      screens: {
        Main: {
          screens: {
            Reels: 'r/:initialPostId',
          },
        },
        PostDetail: 'p/:postId',
        OtherUserProfile: 'u/:username',
        StoryView: 's/:storyId',
        MessagesFlow: {
          screens: {
            ChatThread: 'chat/:peerId',
          },
        },
      },
    },
  },
};

export function createDeepLinkingOptions(): LinkingOptions<BootstrapParamList> {
  const httpsPrefix = `https://${universalLinkHost}`;
  /** iOS Personal Team: no Associated Domains — only custom scheme until you have a paid account. */
  const prefixes = Platform.OS === 'ios' ? ['bromo://'] : ['bromo://', httpsPrefix];
  return {
    prefixes,
    config: linkingConfig,
    async getInitialURL() {
      const url = await Linking.getInitialURL();
      if (url) void prefetchDeepLinkContent(url);
      return url;
    },
    subscribe(listener) {
      const sub = Linking.addEventListener('url', ({url}) => {
        void prefetchDeepLinkContent(url);
        listener(url);
      });
      return () => sub.remove();
    },
  };
}

/** Single instance; host is read from `bromo-config.json` at bundle load. */
export const linking = createDeepLinkingOptions();

function normalizePath(url: string): string {
  const hostPattern = new RegExp(`^https?://${escapeRegex(universalLinkHost)}/?`, 'i');
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'bromo:') {
      return `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, '');
    }
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return url.replace(/^bromo:\/\//, '').replace(hostPattern, '');
  }
}

export function openBromoDeepLink(url?: string | null): boolean {
  if (!url) return false;
  const [kind, rawId] = normalizePath(url).split('/');
  const id = decodeURIComponent(rawId ?? '').trim();
  if (!kind || !id || !navigationRef.isReady()) return false;

  if (kind === 'r') {
    navigationRef.navigate('App', {screen: 'Main', params: {screen: 'Reels', params: {initialPostId: id}}});
    return true;
  }
  if (kind === 'p') {
    navigationRef.navigate('App', {screen: 'PostDetail', params: {postId: id}});
    return true;
  }
  if (kind === 'u') {
    navigationRef.navigate('App', {screen: 'OtherUserProfile', params: {username: id}});
    return true;
  }
  if (kind === 's') {
    navigationRef.navigate('App', {screen: 'StoryView', params: {storyId: id}});
    return true;
  }
  if (kind === 'chat') {
    navigationRef.navigate('App', {screen: 'MessagesFlow', params: {screen: 'ChatThread', params: {peerId: id}}});
    return true;
  }
  return false;
}

export function subscribeToDeepLinks(): () => void {
  const sub = Linking.addEventListener('url', event => {
    openBromoDeepLink(event.url);
  });
  return () => sub.remove();
}
