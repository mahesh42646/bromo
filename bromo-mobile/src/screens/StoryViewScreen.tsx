import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {ChevronLeft} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getStories, type StoryGroup} from '../api/postsApi';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {postThumbnailUri} from '../lib/postMediaDisplay';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryView'>;

export function StoryViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {userId} = route.params;
  const {width: w, height: h} = Dimensions.get('window');

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [idx, setIdx] = useState(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getStories()
      .then(r => {
        setGroups(r.stories);
        setLoadErr(null);
      })
      .catch(err => {
        const m = err instanceof Error ? err.message : String(err);
        setLoadErr(m);
        console.error('[StoryView] getStories failed', m, err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const group = useMemo(
    () =>
      groups.find(g => g.author._id === userId || g.author.username === userId),
    [groups, userId],
  );

  const stories = group?.stories ?? [];
  const current = stories[idx];

  useEffect(() => {
    if (stories.length > 0 && idx > stories.length - 1) {
      setIdx(stories.length - 1);
    }
  }, [idx, stories.length]);

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (loadErr) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center'}}>
        <StatusBar barStyle="light-content" />
        <Text style={{color: '#f87171', fontWeight: '800'}}>Stories unavailable</Text>
        <Text style={{color: '#a3a3a3', marginTop: 8}}>{loadErr}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{marginTop: 24}} hitSlop={12}>
          <Text style={{color: palette.foreground, fontWeight: '700'}}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!group || stories.length === 0 || !current) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <StatusBar barStyle="light-content" />
        <Text style={{color: '#fff', fontWeight: '700', textAlign: 'center'}}>No stories for this account</Text>
        <Pressable onPress={() => navigation.goBack()} style={{marginTop: 20}} hitSlop={12}>
          <ChevronLeft color="#fff" size={28} />
        </Pressable>
      </View>
    );
  }

  const mediaUri = resolveMediaUrl(current.mediaUrl);
  const poster = postThumbnailUri(current) || undefined;

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <StatusBar barStyle="light-content" />
      <Pressable
        onPress={() => navigation.goBack()}
        style={{position: 'absolute', top: 52, left: 8, zIndex: 20, padding: 8}}
        hitSlop={12}>
        <ChevronLeft color="#fff" size={28} />
      </Pressable>

      {current.mediaType === 'video' ? (
        <NetworkVideo
          key={current._id}
          context="story"
          uri={mediaUri}
          posterUri={poster}
          style={{width: w, height: h}}
          repeat={false}
          muted={false}
          paused={false}
          resizeMode="cover"
          posterOverlayUntilReady
        />
      ) : (
        <Image source={{uri: mediaUri}} style={{width: w, height: h}} resizeMode="cover" />
      )}

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 100,
          left: 0,
          right: 0,
          bottom: 100,
          flexDirection: 'row',
        }}>
        <Pressable style={{flex: 1}} onPress={() => setIdx(i => Math.max(0, i - 1))} />
        <Pressable style={{flex: 1}} onPress={() => setIdx(i => Math.min(stories.length - 1, i + 1))} />
      </View>

      <View style={{position: 'absolute', bottom: 36, left: 0, right: 0, alignItems: 'center'}} pointerEvents="none">
        <Text style={{color: '#fff', opacity: 0.85, fontWeight: '600'}}>
          @{group.author.username} · {idx + 1}/{stories.length}
        </Text>
      </View>
    </View>
  );
}
