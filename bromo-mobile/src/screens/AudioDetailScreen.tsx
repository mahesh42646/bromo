import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {ChevronLeft, Music2, Pause, Play} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {parentNavigate} from '../navigation/parentNavigate';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {
  getOriginalAudioDetail,
  getPostsByOriginalAudio,
  type OriginalAudioDetail,
  type Post,
} from '../api/postsApi';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {followUser, getUserProfile, unfollowUser} from '../api/followApi';
import {followSourceForContext} from '../lib/followSource';
import {useAudioPreview} from '../create/useAudioPreview';
import {AudioPreviewHost} from '../components/media/AudioPreviewHost';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type R = RouteProp<AppStackParamList, 'AudioDetail'>;

function formatMs(ms?: number) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `${s}s`;
}

export function AudioDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const {width} = useWindowDimensions();
  const audioId = route.params.audioId ?? route.params.trackId;
  const {previewUri, play, stop, isPlaying} = useAudioPreview();

  const [detail, setDetail] = useState<OriginalAudioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [following, setFollowing] = useState(false);

  const cellW = (width - 32 - 8) / 3;

  const load = useCallback(async () => {
    if (!audioId) return;
    setLoading(true);
    try {
      const {audio} = await getOriginalAudioDetail(audioId);
      setDetail(audio);
      const grid = await getPostsByOriginalAudio(audioId, {limit: 21});
      setPosts(grid.posts);
      setCursor(grid.nextCursor);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [audioId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const ownerId = detail?.owner?._id;
  useEffect(() => {
    if (!ownerId) {
      setFollowing(false);
      return;
    }
    if (dbUser?._id && String(dbUser._id) === String(ownerId)) {
      setFollowing(false);
      return;
    }
    let cancelled = false;
    getUserProfile(String(ownerId))
      .then(({user}) => {
        if (!cancelled) setFollowing(user.followStatus === 'following');
      })
      .catch(() => {
        if (!cancelled) setFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, dbUser?._id]);

  const loadMore = useCallback(async () => {
    if (!audioId || !cursor || moreLoading) return;
    setMoreLoading(true);
    try {
      const next = await getPostsByOriginalAudio(audioId, {cursor, limit: 21});
      setPosts(p => [...p, ...next.posts]);
      setCursor(next.nextCursor);
    } catch {
      /* ignore */
    } finally {
      setMoreLoading(false);
    }
  }, [audioId, cursor, moreLoading]);

  const toggleFollow = async () => {
    if (!detail?.owner?._id) return;
    try {
      if (following) {
        await unfollowUser(detail.owner._id);
        setFollowing(false);
      } else {
        await followUser(
          detail.owner._id,
          followSourceForContext({surface: 'audio_detail', postId: detail.sourcePostId}),
        );
        setFollowing(true);
      }
    } catch {
      /* ignore */
    }
  };

  const cover = detail?.coverUrl ? resolveMediaUrl(detail.coverUrl) || detail.coverUrl : '';
  const canPreview = Boolean(detail?.audioUrl);

  const shellBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
        <ChevronLeft size={28} color={palette.foreground} />
      </Pressable>
    </View>
  );

  if (!audioId) {
    return (
      <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
        {shellBar}
        <Text style={{color: palette.foreground, padding: 20, textAlign: 'center'}}>Missing audio</Text>
      </ThemedSafeScreen>
    );
  }

  if (loading) {
    return (
      <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
        {shellBar}
        <ActivityIndicator color={palette.primary} style={{marginTop: 40}} />
      </ThemedSafeScreen>
    );
  }

  if (!detail) {
    return (
      <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
        {shellBar}
        <Text style={{color: palette.foreground, padding: 20, textAlign: 'center'}}>Could not load this sound</Text>
      </ThemedSafeScreen>
    );
  }

  const owner = detail.owner;
  const avatar =
    owner?.profilePicture && typeof owner.profilePicture === 'string'
      ? resolveMediaUrl(owner.profilePicture) || owner.profilePicture
      : '';

  return (
    <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
      <AudioPreviewHost uri={previewUri} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={28} color={palette.foreground} />
          </Pressable>
        </View>

        <View style={{alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16}}>
          {cover ? (
            <Image source={{uri: cover}} style={styles.heroCover} />
          ) : (
            <View style={[styles.heroCover, styles.heroPlaceholder, {backgroundColor: palette.card}]}>
              <Music2 size={48} color={palette.foregroundMuted} />
            </View>
          )}
          <Text style={[styles.title, {color: palette.foreground}]} numberOfLines={3}>
            {detail.title}
          </Text>
          {owner ? (
            <Pressable
              onPress={() => navigation.navigate('OtherUserProfile', {userId: owner._id})}
              style={styles.ownerRow}>
              {avatar ? (
                <Image source={{uri: avatar}} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, {backgroundColor: palette.card}]} />
              )}
              <Text style={{color: palette.foreground, fontWeight: '800', flex: 1}}>
                @{owner.username ?? 'user'}
              </Text>
              {String(dbUser?._id) !== String(owner._id) ? (
                <Pressable
                  onPress={toggleFollow}
                  style={[
                    styles.followBtn,
                    {backgroundColor: following ? palette.card : palette.primary},
                  ]}>
                  <Text
                    style={{
                      color: following ? palette.foreground : palette.primaryForeground,
                      fontWeight: '800',
                      fontSize: 13,
                    }}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.statsRow}>
            <Text style={{color: palette.foregroundSubtle, fontSize: 13}}>
              {detail.useCount.toLocaleString()} posts
            </Text>
            <Text style={{color: palette.foregroundSubtle, fontSize: 13}}>
              {Number(detail.totalViews ?? 0).toLocaleString()} views on posts
            </Text>
            <Text style={{color: palette.foregroundSubtle, fontSize: 13}}>
              {formatMs(detail.durationMs)} long
            </Text>
          </View>

          {canPreview ? (
            <Pressable
              onPress={() => detail.audioUrl && play(detail.audioUrl)}
              style={[styles.bigPlay, {backgroundColor: palette.primary}]}>
              {isPlaying(detail.audioUrl) ? (
                <Pause size={28} color={palette.primaryForeground} />
              ) : (
                <Play size={28} color={palette.primaryForeground} />
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              parentNavigate(navigation, 'CreateFlow', {
                mode: 'reel',
                bootstrapTs: Date.now(),
                preselectedAudioId: detail._id,
              });
            }}
            style={[styles.useBtn, {backgroundColor: palette.accent}]}>
            <Text style={{color: palette.accentForeground, fontWeight: '900', fontSize: 16}}>
              Use audio
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            paddingHorizontal: 16,
            marginBottom: 10,
            color: palette.foreground,
            fontWeight: '900',
            fontSize: 15,
          }}>
          Popular posts
        </Text>
        <FlatList
          data={posts}
          numColumns={3}
          scrollEnabled={false}
          keyExtractor={item => item._id}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadMore()}
          columnWrapperStyle={{gap: 4, paddingHorizontal: 16, marginBottom: 4}}
          ListFooterComponent={
            moreLoading ? <ActivityIndicator color={palette.primary} style={{padding: 16}} /> : null
          }
          renderItem={({item}) => (
            <Pressable
              onPress={() => parentNavigate(navigation, 'Main', {screen: 'Reels', params: {initialPostId: item._id}})}
              style={{width: cellW, aspectRatio: 9 / 16, borderRadius: 6, overflow: 'hidden'}}>
              <Image
                source={{uri: resolveMediaUrl(item.thumbnailUrl ?? item.mediaUrl) ?? item.mediaUrl}}
                style={{width: '100%', height: '100%'}}
                resizeMode="cover"
              />
            </Pressable>
          )}
        />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

const styles = StyleSheet.create({
  topBar: {paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4},
  heroCover: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroPlaceholder: {alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 12},
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  avatar: {width: 40, height: 40, borderRadius: 20},
  followBtn: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10},
  statsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16, justifyContent: 'center'},
  bigPlay: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  useBtn: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
});
