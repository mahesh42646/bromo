import {Linking} from 'react-native';
import type {LinkingOptions} from '@react-navigation/native';
import type {BootstrapParamList} from './bootstrapParamList';
import {navigationRef} from './rootNavigation';
import {prefetchDeepLinkContent} from '../lib/deepLinkPrefetch';

export const linking: LinkingOptions<BootstrapParamList> = {
  prefixes: ['bromo://', 'https://bromo.darkunde.in'],
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
  config: {
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
  },
};

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'bromo:') {
      return `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, '');
    }
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return url.replace(/^bromo:\/\//, '').replace(/^https?:\/\/bromo\.darkunde\.in\/?/, '');
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
