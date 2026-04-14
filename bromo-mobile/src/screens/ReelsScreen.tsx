import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  type ViewabilityConfig,
  type ViewToken,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
  Maximize2,
  Repeat,
  QrCode,
  Info,
  CheckCircle2,
  XCircle,
  Flag,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {StoryRing} from '../components/ui/StoryRing';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {followUser} from '../api/followApi';
import {createStoryFromReel, getReels, toggleLike, recordView, recordShare, type Post} from '../api/postsApi';
import {socketService} from '../services/socketService';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import type {ThemePalette} from '../config/platform-theme';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

type Quality = 'auto' | 'low' | 'medium' | 'high';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type ReelFeedTab = 'forYou' | 'friends';

function ReelMoreSheet({
  visible,
  onClose,
  palette,
  bottomInset,
  autoScroll,
  onAutoScroll,
  reel,
}: {
  visible: boolean;
  onClose: () => void;
  palette: ThemePalette;
  bottomInset: number;
  autoScroll: boolean;
  onAutoScroll: (v: boolean) => void;
  reel: Post | null;
}) {
  const row = (icon: React.ReactNode, label: string, onPress?: () => void, danger?: boolean) => (
    <Pressable
      key={label}
      onPress={() => {
        onPress?.();
        onClose();
      }}
      style={({pressed}) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? `${palette.foreground}12` : 'transparent',
      })}>
      {icon}
      <Text style={{flex: 1, color: danger ? palette.destructive : palette.foreground, fontSize: 15, fontWeight: '500'}}>
        {label}
      </Text>
    </Pressable>
  );

  const groupStyle = {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden' as const,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'}} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingBottom: 12 + bottomInset,
            maxHeight: '78%',
          }}
          onPress={e => e.stopPropagation()}>
          <View style={{alignItems: 'center', paddingTop: 10, paddingBottom: 6}}>
            <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              paddingVertical: 16,
              paddingHorizontal: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: palette.border,
            }}>
            <Pressable
              style={{alignItems: 'center', width: 88, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.background}}
              onPress={() => Alert.alert('Saved', 'Saved to your device (coming soon).')}>
              <Bookmark size={22} color={palette.foreground} />
              <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>Save</Text>
            </Pressable>
            <Pressable
              style={{alignItems: 'center', width: 88, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.background}}
              onPress={() => Alert.alert('Remix', 'Remix will be available in a future update.')}>
              <Repeat size={22} color={palette.foreground} />
              <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>Remix</Text>
            </Pressable>
            <Pressable
              style={{alignItems: 'center', width: 88, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.background}}
              onPress={() => Alert.alert('Sequence', 'Multi-clip sequences are coming soon.')}>
              <Maximize2 size={22} color={palette.foreground} />
              <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>Sequence</Text>
            </Pressable>
          </View>
          <ScrollView style={{maxHeight: 420}} showsVerticalScrollIndicator={false}>
            <View style={[groupStyle, {backgroundColor: palette.background, borderColor: palette.border}]}>
              {row(<Maximize2 size={20} color={palette.foreground} />, 'View full-screen', () =>
                Alert.alert('Full screen', 'Rotate device or use system full-screen when supported.'),
              )}
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, paddingVertical: 12, paddingHorizontal: 16}}>
                  <Repeat size={20} color={palette.foreground} />
                  <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '500'}}>Auto-scroll</Text>
                </View>
                <Switch value={autoScroll} onValueChange={onAutoScroll} style={{marginRight: 12}} />
              </View>
            </View>
            <View style={[groupStyle, {backgroundColor: palette.background, borderColor: palette.border, marginTop: 10}]}>
              {row(<Sparkles size={20} color={palette.accent} />, 'Add reel to your story', () => {
                if (!reel) return;
                createStoryFromReel(reel._id)
                  .then(() => {
                    DeviceEventEmitter.emit('bromo:storiesChanged');
                    Alert.alert('Story', 'This reel was added to your story.');
                  })
                  .catch(e => Alert.alert('Could not add', e instanceof Error ? e.message : 'Try again.'));
              })}
              {row(<QrCode size={20} color={palette.foreground} />, 'QR code', () => Alert.alert('QR code', 'Share link as QR (coming soon).'))}
            </View>
            <View style={[groupStyle, {backgroundColor: palette.background, borderColor: palette.border, marginTop: 10}]}>
              {row(<Info size={20} color={palette.foreground} />, "Why you're seeing this post", () =>
                Alert.alert('Why this reel', 'Shown because it is public and matches what you watch.'),
              )}
              {row(<CheckCircle2 size={20} color={palette.foreground} />, 'Interested', () => Alert.alert('Thanks', "We'll show more like this."))}
              {row(<XCircle size={20} color={palette.foreground} />, 'Not interested', () => Alert.alert('OK', "We'll tune your feed."))}
              {row(<Flag size={20} color={palette.destructive} />, 'Report', () => Alert.alert('Report', 'Thanks — moderation tools are coming soon.'), true)}
            </View>
            <View style={[groupStyle, {backgroundColor: palette.background, borderColor: palette.border, marginTop: 10, marginBottom: 8}]}>
              {row(<SlidersHorizontal size={20} color={palette.foreground} />, 'Manage content preferences', () =>
                Alert.alert('Preferences', 'Open Settings → Content to tune recommendations (coming soon).'),
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ReelItem({
  item,
  isActive,
  reelHeight,
  reelWidth,
  navigation,
  onLike,
  autoScroll,
  onAutoScrollChange,
  onAutoAdvanceClip,
}: {
  item: Post;
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  navigation: Nav;
  onLike: (id: string) => void;
  autoScroll: boolean;
  onAutoScrollChange: (v: boolean) => void;
  onAutoAdvanceClip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const {palette, contract} = useTheme();
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(item.isFollowing);
  const [coverSpinner, setCoverSpinner] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(!isActive);
  const viewRecorded = useRef(false);
  const watchStartMs = useRef(0);
  const accumulatedWatchMs = useRef(0);
  const durationRef = useRef(0);
  const lastProgTick = useRef(0);
  const clearedSpinnerOnProgress = useRef(false);
  // Rotating disc animation
  const discRotation = useRef(new Animated.Value(0)).current;
  const discAnim = useRef<Animated.CompositeAnimation | null>(null);
  const {borderRadiusScale} = contract.brandGuidelines;
  const avatarUri = item.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author.displayName)}&background=random`;

  useEffect(() => {
    setCoverSpinner(true);
    setProgress(0);
    durationRef.current = 0;
    clearedSpinnerOnProgress.current = false;
  }, [item._id, item.mediaUrl]);

  useEffect(() => {
    setPaused(!isActive);
  }, [isActive]);

  // Disc spin: start/stop with active state
  useEffect(() => {
    if (isActive && !paused) {
      discAnim.current = Animated.loop(
        Animated.timing(discRotation, {
          toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true,
        }),
      );
      discAnim.current.start();
    } else {
      discAnim.current?.stop();
    }
  }, [isActive, paused, discRotation]);

  // Record view + accumulate watch time
  useEffect(() => {
    if (isActive) {
      if (!viewRecorded.current) {
        viewRecorded.current = true;
        watchStartMs.current = Date.now();
        recordView(item._id, 0);
      } else {
        watchStartMs.current = Date.now();
      }
    } else if (watchStartMs.current > 0) {
      accumulatedWatchMs.current += Date.now() - watchStartMs.current;
      watchStartMs.current = 0;
      // Send accumulated watch time on deactivate
      if (accumulatedWatchMs.current > 500) {
        recordView(item._id, accumulatedWatchMs.current);
        accumulatedWatchMs.current = 0;
        viewRecorded.current = false;
      }
    }
  }, [isActive, item._id]);

  const handleFollow = async () => {
    try {
      await followUser(item.author._id);
      setFollowing(true);
    } catch {}
  };

  const playUri = resolveMediaUrl(item.mediaUrl);
  const thumbUri = resolveMediaUrl(item.thumbnailUrl ?? '') || playUri;

  /** Stable so `NetworkVideo` safety timer / native callbacks are not reset every progress tick. */
  const hideCoverSpinner = useCallback(() => {
    setCoverSpinner(false);
  }, []);

  return (
    <View style={{width: reelWidth, height: reelHeight, position: 'relative', backgroundColor: '#000'}}>
      {item.mediaType === 'video' ? (
        <NetworkVideo
          key={item._id}
          context="reel"
          uri={playUri}
          posterUri={item.thumbnailUrl ? thumbUri : undefined}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
          repeat={!autoScroll}
          paused={paused}
          muted={muted}
          ignoreSilentSwitch="ignore"
          preventsDisplaySleepDuringVideoPlayback
          posterOverlayUntilReady
          onDecoderReady={hideCoverSpinner}
          onPlaybackError={hideCoverSpinner}
          onLoad={d => {
            const dur = typeof d.duration === 'number' && Number.isFinite(d.duration) ? d.duration : 0;
            if (dur > 0) durationRef.current = dur;
          }}
          onProgress={d => {
            if (!clearedSpinnerOnProgress.current && d.currentTime > 0.02) {
              clearedSpinnerOnProgress.current = true;
              hideCoverSpinner();
            }
            const now = Date.now();
            if (now - lastProgTick.current < 180) return;
            lastProgTick.current = now;
            let dur = durationRef.current;
            if (dur <= 0) {
              dur = d.seekableDuration || d.playableDuration || 0;
              if (dur > 0) durationRef.current = dur;
            }
            if (dur > 0) {
              setProgress(Math.min(1, Math.max(0, d.currentTime / dur)));
            }
          }}
          onEnd={() => {
            if (isActive && autoScroll) {
              onAutoAdvanceClip();
            }
          }}
        />
      ) : (
        <Image
          source={{uri: thumbUri}}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
        />
      )}

      {/* First-frame / buffer cover (do not tie to isActive-only — that caused endless spinner after swipe back) */}
      {isActive && coverSpinner && item.mediaType === 'video' && (
        <View style={{...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center'}} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* Progress (Instagram-style thin bar) */}
      {item.mediaType === 'video' ? (
        <View style={{position: 'absolute', bottom: 4, left: 0, right: 0, height: 2, zIndex: 12}} pointerEvents="none">
          <View style={{height: 2, backgroundColor: 'rgba(255,255,255,0.22)'}}>
            <View style={{height: 2, width: `${Math.round(progress * 1000) / 10}%`, backgroundColor: '#fff'}} />
          </View>
        </View>
      ) : null}

      {/* Gradient overlay */}
      <View style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 320, backgroundColor: palette.overlay}} />

      {/* Pause indicator */}
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

      {/* Tap center: mute only (fullscreen tap used to pause and looked like a black/frozen reel). */}
      <Pressable
        style={{...StyleSheet.absoluteFillObject, zIndex: 1}}
        onPress={() => setMuted(m => !m)}
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

        <Pressable
          onPress={() => {
            recordShare(item._id);
            parentNavigate(navigation, 'ShareSend', {postId: item._id});
          }}
          style={{alignItems: 'center', gap: 4}}>
          <Send size={28} color="#fff" />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(item.sharesCount ?? 0)}</Text>
        </Pressable>

        <Pressable onPress={() => setBookmarked(p => !p)} style={{alignItems: 'center', gap: 4}}>
          <Bookmark
            size={28}
            color={bookmarked ? palette.primary : '#fff'}
            fill={bookmarked ? palette.primary : 'transparent'}
          />
        </Pressable>

        <Pressable onPress={() => setMoreOpen(true)}>
          <MoreHorizontal size={28} color="#fff" />
        </Pressable>

        {/* Rotating music disc */}
        <Pressable onPress={() => parentNavigate(navigation, 'ReuseAudio', {audioId: item._id})}>
          <Animated.View style={{
            width: 40, height: 40, borderRadius: 20,
            borderWidth: 2, borderColor: '#fff', overflow: 'hidden',
            transform: [{rotate: discRotation.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']})}],
          }}>
            <Image source={{uri: avatarUri}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
          </Animated.View>
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

      <ReelMoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        palette={palette}
        bottomInset={insets.bottom}
        autoScroll={autoScroll}
        onAutoScroll={onAutoScrollChange}
        reel={item}
      />
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
  const {ready: authReady} = useAuth();
  const [screenFocused, setScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false); // pause all on blur
    }, []),
  );
  const insets = useSafeAreaInsets();
  const [feedTab, setFeedTab] = useState<ReelFeedTab>('forYou');
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
  const [autoScroll, setAutoScroll] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const activeIndexRef = useRef(0);
  const displayReelsLenRef = useRef(0);
  const reelHeightRef = useRef(reelHeight);

  const displayReels = useMemo(
    () => (feedTab === 'friends' ? reels.filter(r => r.isFollowing) : reels),
    [feedTab, reels],
  );

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    reelHeightRef.current = reelHeight;
  }, [reelHeight]);

  useEffect(() => {
    displayReelsLenRef.current = displayReels.length;
  }, [displayReels.length]);

  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({offset: 0, animated: false});
  }, [feedTab]);

  const onAutoAdvanceClip = useCallback(() => {
    const next = activeIndexRef.current + 1;
    if (next >= displayReelsLenRef.current) return;
    try {
      listRef.current?.scrollToIndex({index: next, animated: true});
    } catch {
      listRef.current?.scrollToOffset({offset: next * reelHeightRef.current, animated: true});
    }
  }, []);

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

  // Wait for Firebase auth to restore session before hitting the API.
  // Without this guard, the first call fires before auth().currentUser is set
  // → "Not authenticated" error → empty reel list forever (no retry).
  useEffect(() => {
    if (!authReady) return;
    setLoading(true);
    loadReels(true).finally(() => setLoading(false));
  }, [authReady, loadReels]);

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
      activeIndexRef.current = first.index;
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

      {/* Reels / Friends (Instagram-style) */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 4,
          left: 0,
          right: 0,
          zIndex: 25,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 28,
        }}
        pointerEvents="box-none">
        <Pressable onPress={() => setFeedTab('forYou')} hitSlop={10}>
          <Text
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: feedTab === 'forYou' ? '800' : '500',
              opacity: feedTab === 'forYou' ? 1 : 0.55,
            }}>
            Reels
          </Text>
          {feedTab === 'forYou' ? (
            <View style={{height: 2, marginTop: 4, borderRadius: 1, backgroundColor: palette.accent}} />
          ) : (
            <View style={{height: 2, marginTop: 4}} />
          )}
        </Pressable>
        <Pressable onPress={() => setFeedTab('friends')} hitSlop={10}>
          <Text
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: feedTab === 'friends' ? '800' : '500',
              opacity: feedTab === 'friends' ? 1 : 0.55,
            }}>
            Friends
          </Text>
          {feedTab === 'friends' ? (
            <View style={{height: 2, marginTop: 4, borderRadius: 1, backgroundColor: palette.accent}} />
          ) : (
            <View style={{height: 2, marginTop: 4}} />
          )}
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        style={{flex: 1}}
        data={displayReels}
        keyExtractor={item => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
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
        windowSize={4}
        removeClippedSubviews={false}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={info => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({index: info.index, animated: true, viewPosition: 0.5});
          }, 350);
        }}
        ListEmptyComponent={
          <View style={{height: reelHeight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24}}>
            <Text style={{color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center'}}>
              {feedTab === 'friends' ? 'No reels from people you follow yet' : 'No reels yet'}
            </Text>
            <Text style={{color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center'}}>
              {feedTab === 'friends' ? 'Follow creators to see them here.' : 'Post your first reel!'}
            </Text>
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
            isActive={screenFocused && index === activeIndex}
            reelHeight={reelHeight}
            reelWidth={reelWidth}
            navigation={navigation}
            onLike={handleLike}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            onAutoAdvanceClip={onAutoAdvanceClip}
          />
        )}
      />

      {/* Quality picker */}
      <View style={{position: 'absolute', top: insets.top + 52, left: 14, zIndex: 20}}>
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
