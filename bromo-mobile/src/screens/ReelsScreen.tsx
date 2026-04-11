import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Music2,
  MoreHorizontal,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {useTheme} from '../context/ThemeContext';
import {StoryRing} from '../components/ui/StoryRing';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {getReels, toggleLike, followUser, type Post} from '../api/postsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ReelItem({
  item,
  isActive,
  reelHeight,
  reelWidth,
  navigation,
  onLike,
}: {
  item: Post;
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  navigation: Nav;
  onLike: (id: string) => void;
}) {
  const {palette, contract} = useTheme();
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(item.isFollowing);
  const {borderRadiusScale} = contract.brandGuidelines;
  const avatarUri = item.author.profilePicture || `https://ui-avatars.com/api/?name=${item.author.displayName}`;

  const handleFollow = async () => {
    try {
      await followUser(item.author._id);
      setFollowing(true);
    } catch {}
  };

  return (
    <View style={{width: reelWidth, height: reelHeight, position: 'relative'}}>
      <Image
        source={{uri: item.mediaUrl}}
        style={{width: '100%', height: '100%', resizeMode: 'cover'}}
      />

      <View style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, backgroundColor: palette.overlay}} />

      {!isActive && (
        <View
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: [{translateX: -24}, {translateY: -24}],
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: palette.overlay, alignItems: 'center', justifyContent: 'center',
          }}>
          <Play size={22} color={palette.foreground} fill={palette.foreground} />
        </View>
      )}

      {/* Right side actions */}
      <View style={{position: 'absolute', right: 14, bottom: 120, alignItems: 'center', gap: 22}}>
        <View style={{position: 'relative'}}>
          <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: item.author._id})}>
            <StoryRing uri={avatarUri} size={44} />
          </Pressable>
          {!following && (
            <Pressable
              onPress={handleFollow}
              style={{
                position: 'absolute', bottom: -10, left: '50%',
                transform: [{translateX: -10}],
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: palette.primary, alignItems: 'center',
                justifyContent: 'center', borderWidth: 2, borderColor: palette.background,
              }}>
              <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '900', lineHeight: 14}}>+</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => onLike(item._id)} style={{alignItems: 'center', gap: 4}}>
          <Heart size={28} color={item.isLiked ? palette.destructive : palette.foreground} fill={item.isLiked ? palette.destructive : 'transparent'} />
          <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '700'}}>{formatCount(item.likesCount)}</Text>
        </Pressable>

        <Pressable onPress={() => parentNavigate(navigation, 'Comments', {postId: item._id})} style={{alignItems: 'center', gap: 4}}>
          <MessageCircle size={28} color={palette.foreground} />
          <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '700'}}>{formatCount(item.commentsCount)}</Text>
        </Pressable>

        <Pressable onPress={() => parentNavigate(navigation, 'ShareSend', {postId: item._id})} style={{alignItems: 'center', gap: 4}}>
          <Send size={28} color={palette.foreground} />
          <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '700'}}>{formatCount(item.viewsCount)}</Text>
        </Pressable>

        <Pressable onPress={() => setBookmarked(p => !p)}>
          <Bookmark size={28} color={bookmarked ? palette.primary : palette.foreground} fill={bookmarked ? palette.primary : 'transparent'} />
        </Pressable>

        <Pressable>
          <MoreHorizontal size={28} color={palette.foreground} />
        </Pressable>

        <Pressable onPress={() => parentNavigate(navigation, 'ReuseAudio', {audioId: item._id})}>
          <View style={{width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: palette.foreground, overflow: 'hidden'}}>
            <Image source={{uri: avatarUri}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
          </View>
        </Pressable>
      </View>

      {/* Bottom info */}
      <View style={{position: 'absolute', bottom: 90, left: 14, right: 80, gap: 8}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: item.author._id})}>
            <Text style={{color: palette.foreground, fontSize: 14, fontWeight: '900'}}>@{item.author.username}</Text>
          </Pressable>
          {item.author.emailVerified && (
            <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
          )}
          {!following && (
            <Pressable
              onPress={handleFollow}
              style={{
                borderWidth: 1, borderColor: palette.foreground,
                borderRadius: borderRadiusScale === 'bold' ? 8 : 5,
                paddingHorizontal: 10, paddingVertical: 3, marginLeft: 4,
              }}>
              <Text style={{color: palette.foreground, fontSize: 11, fontWeight: '800'}}>Follow</Text>
            </Pressable>
          )}
        </View>
        {item.caption ? (
          <Text style={{color: palette.borderFaint, fontSize: 13, lineHeight: 18}} numberOfLines={2}>
            {item.caption}
          </Text>
        ) : null}
        {item.music ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Music2 size={12} color={palette.borderFaint} />
            <Text style={{color: palette.borderFaint, fontSize: 11}} numberOfLines={1}>{item.music}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => setMuted(p => !p)}
        style={{
          position: 'absolute', top: 16, right: 14,
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: palette.overlay, alignItems: 'center', justifyContent: 'center',
        }}>
        {muted ? <VolumeX size={16} color={palette.foreground} /> : <Volume2 size={16} color={palette.foreground} />}
      </Pressable>
    </View>
  );
}

export function ReelsScreen() {
  const navigation = useNavigation() as Nav;
  const {palette} = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const win = Dimensions.get('window');
  const [reelHeight, setReelHeight] = useState(win.height);
  const [reelWidth, setReelWidth] = useState(win.width);
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadReels = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const res = await getReels(p);
      if (reset) {
        setReels(res.posts);
        setPage(2);
      } else {
        setReels(prev => [...prev, ...res.posts]);
        setPage(p + 1);
      }
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('[ReelsScreen] load error:', err);
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    loadReels(true).finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReels(true);
    setRefreshing(false);
  }, [loadReels]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadReels(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loadReels]);

  const handleLike = useCallback((postId: string) => {
    setReels(prev =>
      prev.map(p =>
        p._id === postId
          ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1}
          : p,
      ),
    );
    toggleLike(postId).catch(() => {
      setReels(prev =>
        prev.map(p =>
          p._id === postId
            ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1}
            : p,
        ),
      );
    });
  }, []);

  const onListLayout = (e: LayoutChangeEvent) => {
    const {height: h, width: w} = e.nativeEvent.layout;
    if (h > 0) setReelHeight(h);
    if (w > 0) setReelWidth(w);
  };

  if (loading) {
    return (
      <ThemedSafeScreen style={{backgroundColor: '#000'}} edges={['top', 'left', 'right']}>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </ThemedSafeScreen>
    );
  }

  return (
    <ThemedSafeScreen style={{backgroundColor: '#000'}} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1}} onLayout={onListLayout}>
        <FlatList
          style={{flex: 1}}
          data={reels}
          keyExtractor={item => item._id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={reelHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          onMomentumScrollEnd={e => {
            const index = Math.round(e.nativeEvent.contentOffset.y / reelHeight);
            setActiveIndex(index);
          }}
          getItemLayout={(_data, index) => ({
            length: reelHeight,
            offset: reelHeight * index,
            index,
          })}
          ListEmptyComponent={
            <View style={{height: reelHeight, alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '600'}}>No reels yet</Text>
              <Text style={{color: palette.mutedForeground, marginTop: 8}}>Post your first reel!</Text>
            </View>
          }
          renderItem={({item, index}) => (
            <ReelItem
              item={item}
              isActive={index === activeIndex}
              reelHeight={reelHeight}
              reelWidth={reelWidth}
              navigation={navigation}
              onLike={handleLike}
            />
          )}
        />
      </View>
    </ThemedSafeScreen>
  );
}
