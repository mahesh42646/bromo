import React, {useCallback, useEffect, useRef, useState} from 'react';
import Video, {type OnLoadData, type OnProgressData} from 'react-native-video';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ViewabilityConfig,
  type ViewToken,
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
  Wifi,
} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {useTheme} from '../context/ThemeContext';
import {StoryRing} from '../components/ui/StoryRing';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {followUser} from '../api/followApi';
import {getReels, toggleLike, recordView, type Post} from '../api/postsApi';
import {socketService} from '../services/socketService';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

type Quality = 'auto' | 'low' | 'medium' | 'high';

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
  quality,
}: {
  item: Post;
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  navigation: Nav;
  onLike: (id: string) => void;
  quality: Quality;
}) {
  const {palette, contract} = useTheme();
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(item.isFollowing);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [paused, setPaused] = useState(!isActive);
  const viewRecorded = useRef(false);
  const {borderRadiusScale} = contract.brandGuidelines;
  const avatarUri = item.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author.displayName)}&background=random`;

  // Sync pause state when active changes
  useEffect(() => {
    setPaused(!isActive);
    if (isActive) {
      setVideoError(false);
    }
  }, [isActive]);

  // Record view once per active session
  useEffect(() => {
    if (isActive && !viewRecorded.current) {
      viewRecorded.current = true;
      recordView(item._id);
    }
    if (!isActive) {
      viewRecorded.current = false;
    }
  }, [isActive, item._id]);

  const handleFollow = async () => {
    try {
      await followUser(item.author._id);
      setFollowing(true);
    } catch {}
  };

  const onVideoLoad = (_data: OnLoadData) => {
    setVideoLoading(false);
  };

  const onVideoProgress = (_data: OnProgressData) => {
    if (videoLoading) setVideoLoading(false);
  };

  const onVideoError = () => {
    setVideoError(true);
    setVideoLoading(false);
  };

  // Quality → bitrate hint for react-native-video
  const bufferConfig = {
    minBufferMs: quality === 'low' ? 3000 : quality === 'medium' ? 5000 : 8000,
    maxBufferMs: quality === 'low' ? 10000 : quality === 'medium' ? 20000 : 30000,
    bufferForPlaybackMs: quality === 'low' ? 1500 : 2500,
    bufferForPlaybackAfterRebufferMs: quality === 'low' ? 3000 : 5000,
    backBufferDurationMs: 30000,
  };

  return (
    <View style={{width: reelWidth, height: reelHeight, position: 'relative', backgroundColor: '#000'}}>
      {item.mediaType === 'video' && !videoError ? (
        <Video
          source={{uri: item.mediaUrl}}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
          repeat
          paused={paused}
          muted={muted}
          ignoreSilentSwitch="ignore"
          playWhenInactive={false}
          onLoad={onVideoLoad}
          onProgress={onVideoProgress}
          onError={onVideoError}
          bufferConfig={bufferConfig}
          poster={item.thumbnailUrl || undefined}
          posterResizeMode="cover"
          preventsDisplaySleepDuringVideoPlayback
        />
      ) : (
        <Image
          source={{uri: item.thumbnailUrl || item.mediaUrl}}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
        />
      )}

      {/* Loading indicator */}
      {isActive && videoLoading && item.mediaType === 'video' && !videoError && (
        <View style={{...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* Video error fallback */}
      {videoError && (
        <View style={{...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111'}}>
          <Text style={{color: '#888', fontSize: 13}}>Video unavailable</Text>
        </View>
      )}

      {/* Gradient overlay */}
      <View style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 320, backgroundColor: palette.overlay}} />

      {/* Pause indicator */}
      {!isActive && !videoError && (
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

      {/* Tap to pause/play */}
      <Pressable
        style={{...StyleSheet.absoluteFillObject, zIndex: 1}}
        onPress={() => setPaused(p => !p)}
        onLongPress={() => setPaused(true)}
      />

      {/* Right side actions */}
      <View style={{position: 'absolute', right: 14, bottom: 120, alignItems: 'center', gap: 22, zIndex: 10}}>
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
                justifyContent: 'center', borderWidth: 2, borderColor: '#000',
              }}>
              <Text style={{color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 14}}>+</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => onLike(item._id)} style={{alignItems: 'center', gap: 4}}>
          <Heart
            size={28}
            color={item.isLiked ? palette.destructive : '#fff'}
            fill={item.isLiked ? palette.destructive : 'transparent'}
          />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(item.likesCount)}</Text>
        </Pressable>

        <Pressable onPress={() => parentNavigate(navigation, 'Comments', {postId: item._id})} style={{alignItems: 'center', gap: 4}}>
          <MessageCircle size={28} color="#fff" />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(item.commentsCount)}</Text>
        </Pressable>

        <Pressable onPress={() => parentNavigate(navigation, 'ShareSend', {postId: item._id})} style={{alignItems: 'center', gap: 4}}>
          <Send size={28} color="#fff" />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(item.viewsCount)}</Text>
        </Pressable>

        <Pressable onPress={() => setBookmarked(p => !p)}>
          <Bookmark
            size={28}
            color={bookmarked ? palette.primary : '#fff'}
            fill={bookmarked ? palette.primary : 'transparent'}
          />
        </Pressable>

        <Pressable>
          <MoreHorizontal size={28} color="#fff" />
        </Pressable>

        <Pressable onPress={() => parentNavigate(navigation, 'ReuseAudio', {audioId: item._id})}>
          <View style={{width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff', overflow: 'hidden'}}>
            <Image source={{uri: avatarUri}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
          </View>
        </Pressable>
      </View>

      {/* Bottom info */}
      <View style={{position: 'absolute', bottom: 90, left: 14, right: 80, gap: 8, zIndex: 10}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: item.author._id})}>
            <Text style={{color: '#fff', fontSize: 14, fontWeight: '900'}}>@{item.author.username}</Text>
          </Pressable>
          {item.author.emailVerified && (
            <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
          )}
          {!following && (
            <Pressable
              onPress={handleFollow}
              style={{
                borderWidth: 1, borderColor: '#fff',
                borderRadius: borderRadiusScale === 'bold' ? 8 : 5,
                paddingHorizontal: 10, paddingVertical: 3, marginLeft: 4,
              }}>
              <Text style={{color: '#fff', fontSize: 11, fontWeight: '800'}}>Follow</Text>
            </Pressable>
          )}
        </View>
        {item.caption ? (
          <Text style={{color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18}} numberOfLines={2}>
            {item.caption}
          </Text>
        ) : null}
        {item.music ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Music2 size={12} color="rgba(255,255,255,0.7)" />
            <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 11}} numberOfLines={1}>{item.music}</Text>
          </View>
        ) : null}
      </View>

      {/* Top controls */}
      <View style={{position: 'absolute', top: 16, right: 14, flexDirection: 'row', gap: 10, zIndex: 10}}>
        <Pressable
          onPress={() => setMuted(p => !p)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
          }}>
          {muted ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
        </Pressable>
      </View>
    </View>
  );
}

const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 60,
  minimumViewTime: 100,
};

export function ReelsScreen() {
  const navigation = useNavigation() as Nav;
  const {palette} = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const win = Dimensions.get('window');
  const [reelHeight, setReelHeight] = useState(win.height);
  const [reelWidth, setReelWidth] = useState(win.width);
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [quality, setQuality] = useState<Quality>('auto');
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const loadReels = useCallback(async (reset = false) => {
    const p = reset ? 1 : pageRef.current;
    try {
      const res = await getReels(p);
      if (reset) {
        setReels(res.posts);
        pageRef.current = 2;
        setPage(2);
      } else {
        setReels(prev => {
          // Unload reels more than 10 positions behind current to save memory
          const combined = [...prev, ...res.posts];
          return combined;
        });
        pageRef.current = p + 1;
        setPage(p + 1);
      }
      hasMoreRef.current = res.hasMore;
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('[ReelsScreen] load error:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadReels(true).finally(() => setLoading(false));
  }, [loadReels]);

  // Real-time: new reels & like updates via socket
  useEffect(() => {
    const unsubLike = socketService.on('post:like', ({postId, likesCount, liked}) => {
      setReels(prev =>
        prev.map(r => r._id === postId ? {...r, likesCount, isLiked: liked} : r),
      );
    });
    const unsubDelete = socketService.on('post:delete', ({postId}) => {
      setReels(prev => prev.filter(r => r._id !== postId));
    });
    return () => {
      unsubLike();
      unsubDelete();
    };
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    await loadReels(false);
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [loadReels]);

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

  const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: ViewToken[]}) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setActiveIndex(first.index);
    }
  }).current;

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

      <FlatList
        ref={listRef}
        style={{flex: 1}}
        data={reels}
        keyExtractor={item => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={reelHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onLayout={e => {
          const {height, width} = e.nativeEvent.layout;
          if (height > 0) setReelHeight(height);
          if (width > 0) setReelWidth(width);
        }}
        onEndReached={onLoadMore}
        onEndReachedThreshold={2}
        getItemLayout={(_data, index) => ({
          length: reelHeight,
          offset: reelHeight * index,
          index,
        })}
        // Instagram-style: render 1 ahead, keep 3 in window, unload rest
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        ListEmptyComponent={
          <View style={{height: reelHeight, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: '#fff', fontSize: 16, fontWeight: '600'}}>No reels yet</Text>
            <Text style={{color: 'rgba(255,255,255,0.5)', marginTop: 8}}>Post your first reel!</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{height: 60, alignItems: 'center', justifyContent: 'center'}}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null
        }
        renderItem={({item, index}) => (
          <ReelItem
            item={item}
            isActive={index === activeIndex}
            reelHeight={reelHeight}
            reelWidth={reelWidth}
            navigation={navigation}
            onLike={handleLike}
            quality={quality}
          />
        )}
      />

      {/* Quality picker */}
      <View style={{position: 'absolute', top: 16, left: 14, zIndex: 20}}>
        <Pressable
          onPress={() => setShowQualityPicker(p => !p)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
          }}>
          <Wifi size={12} color="#fff" />
          <Text style={{color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase'}}>{quality}</Text>
        </Pressable>
        {showQualityPicker && (
          <View style={{
            marginTop: 6, backgroundColor: 'rgba(0,0,0,0.85)',
            borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
          }}>
            {(['auto', 'low', 'medium', 'high'] as Quality[]).map(q => (
              <Pressable
                key={q}
                onPress={() => { setQuality(q); setShowQualityPicker(false); }}
                style={{
                  paddingHorizontal: 16, paddingVertical: 10,
                  backgroundColor: quality === q ? 'rgba(255,255,255,0.15)' : 'transparent',
                }}>
                <Text style={{color: '#fff', fontSize: 13, fontWeight: quality === q ? '800' : '400', textTransform: 'capitalize'}}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ThemedSafeScreen>
  );
}
