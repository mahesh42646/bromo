import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Reanimated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {AtSign, BarChart2, ChevronLeft, MoreVertical, Send, Share2, Users} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {useMessaging} from '../messaging/MessagingContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {
  deletePost,
  getStoryAnalytics,
  getStoryViewers,
  markStorySeenPost,
  reactToStory,
  recordStoryTap,
  resolveVideoUrl,
  type PostAuthor,
  type StoryGroup,
  type StoryReactionKey,
} from '../api/postsApi';
import {loadStoriesFeedDeduped, peekStoriesFromCache} from '../lib/storiesFeedCache';
import {prefetchStoryVideoToDisk, resolveStoryVideoPlayUri} from '../lib/storyVideoCache';
import {prefetchHlsSegments} from '../lib/hlsPrefetch';
import {usePlaybackNetworkCap} from '../lib/usePlaybackNetworkCap';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {parentNavigate} from '../navigation/parentNavigate';
import type {OnLoadData, OnProgressData} from 'react-native-video';
import {ThemedConfirmModal} from '../components/ui/ThemedConfirmModal';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryView'>;

const STORY_DURATION_IMAGE_MS = 5000;
const STORY_DURATION_VIDEO_FALLBACK_MS = 15000;
const STORY_DURATION_VIDEO_MIN_MS = 4000;
const STORY_DURATION_VIDEO_MAX_MS = 30000;
const PREFETCH_LOOKAHEAD = 3;
const STORIES_FOCUS_REFRESH_MIN_MS = 120_000;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = '@bromo/story_media_cache_v2';
const {width: W, height: H} = Dimensions.get('window');

const STORY_REACTION_ROW: Array<{key: StoryReactionKey; sym: string}> = [
  {key: 'like', sym: '❤️'},
  {key: 'love', sym: '💕'},
  {key: 'haha', sym: '😂'},
  {key: 'wow', sym: '😮'},
  {key: 'sad', sym: '😢'},
  {key: 'fire', sym: '🔥'},
];

function reactionEmoji(key: string): string {
  const row = STORY_REACTION_ROW.find(r => r.key === key);
  return row?.sym ?? key;
}

type StoryMediaCache = Record<string, number>;

// Story overlay types stored in storyMeta
type StoryOverlay = {
  id: string;
  type: 'text' | 'emoji' | 'music' | 'sticker' | 'mention' | 'link';
  content: string;
  x: number; // 0–1 relative to W
  y: number; // 0–1 relative to H
  color?: string;
  fontSize?: number;
  targetUserId?: string;
  scale?: number;
};

type StoryMeta = {
  bgColor?: string;
  overlays?: StoryOverlay[];
};

function storyExpiresAt(createdAt: string): number {
  const createdMs = new Date(createdAt).getTime();
  return (Number.isFinite(createdMs) ? createdMs : Date.now()) + STORY_TTL_MS;
}

export function StoryViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const {openThreadForUser} = useMessaging();
  const insets = useSafeAreaInsets();
  const {userId, storyId} = route.params;

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const {isCellular, maxBitRate} = usePlaybackNetworkCap();
  const [paused, setPaused] = useState(false);
  const [pickedReaction, setPickedReaction] = useState<StoryReactionKey | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [ownMenuOpen, setOwnMenuOpen] = useState(false);
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null);
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [storyViewers, setStoryViewers] = useState<
    Array<{viewedAt: string; user: PostAuthor; reaction?: string | null; reactedAt?: string | null}>
  >([]);
  const [storyAnalytics, setStoryAnalytics] = useState<{
    viewersCount: number;
    impressions: number;
    views: number;
    replyCount: number;
    linkTapCount: number;
    mentionTapCount: number;
    sharesCount?: number;
    reactions?: Record<string, number>;
  } | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [storyDurationMs, setStoryDurationMs] = useState(STORY_DURATION_IMAGE_MS);
  /** null = resolving disk vs remote; avoids mounting the player on `https://` when a cache hit will use `file://`. */
  const [storyVideoPlayUri, setStoryVideoPlayUri] = useState<string | null>(null);

  // Animated values — never setState on progress tick to avoid re-renders
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const videoProgressAnim = useRef(new Animated.Value(0)).current;

  const inputRef = useRef<TextInput>(null);
  const mediaCacheRef = useRef<StoryMediaCache>({});
  const activeStoryIdRef = useRef<string | undefined>(undefined);

  // ─── critical fix: only position group/story on the INITIAL groups load ──────
  // Without this, the 20-second refresh resets storyIdx every time, causing the
  // video to restart from the beginning and producing the buffering/loop glitch.
  const groupsInitialized = useRef(false);
  const lastStoriesFetchAt = useRef(0);
  const storiesFocusHandledOnce = useRef(false);

  const loadCacheIndex = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoryMediaCache;
      const now = Date.now();
      const cleaned: StoryMediaCache = {};
      for (const [k, exp] of Object.entries(parsed)) {
        if (exp > now) cleaned[k] = exp;
      }
      mediaCacheRef.current = cleaned;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cleaned));
    } catch {}
  }, []);

  const saveCacheIndex = useCallback(async () => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(mediaCacheRef.current));
    } catch {}
  }, []);

  const runInitialStories = useCallback(async () => {
    try {
      const cached = await peekStoriesFromCache();
      if (cached?.length) {
        setGroups(cached);
        setLoading(false);
      }
      const fresh = await loadStoriesFeedDeduped({});
      setGroups(fresh);
      lastStoriesFetchAt.current = Date.now();
    } catch {
      // keep cached UI if peekStoriesFromCache already rendered
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCacheIndex().finally(() => null);
    runInitialStories();
  }, [runInitialStories, loadCacheIndex]);

  useFocusEffect(
    useCallback(() => {
      if (!storiesFocusHandledOnce.current) {
        storiesFocusHandledOnce.current = true;
        return;
      }
      const now = Date.now();
      if (now - lastStoriesFetchAt.current < STORIES_FOCUS_REFRESH_MIN_MS) return;
      lastStoriesFetchAt.current = now;
      loadStoriesFeedDeduped({})
        .then(s => setGroups(s))
        .catch(() => null);
    }, []),
  );

  // Position to the correct group/story — ONLY on the very first groups load.
  useEffect(() => {
    if (groups.length === 0 || groupsInitialized.current) return;
    groupsInitialized.current = true;
    if (storyId) {
      const groupIndex = groups.findIndex(g => g.stories.some(story => story._id === storyId));
      if (groupIndex >= 0) {
        setGroupIdx(groupIndex);
        const nextStoryIndex = groups[groupIndex]?.stories.findIndex(story => story._id === storyId) ?? 0;
        setStoryIdx(Math.max(0, nextStoryIndex));
        return;
      }
    }
    if (userId) {
      const i = groups.findIndex(g => g.author._id === userId || g.author.username === userId);
      setGroupIdx(Math.max(0, i));
    }
    setStoryIdx(0);
  }, [groups, storyId, userId]);

  const group = groups[groupIdx];
  const stories = group?.stories ?? [];
  const current = stories[storyIdx];
  activeStoryIdRef.current = current?._id;

  const allStories = useMemo(() => groups.flatMap(g => g.stories), [groups]);

  const warmStoryMedia = useCallback(
    async (
      story: StoryGroup['stories'][number] | undefined,
      opts?: {prefetchToDisk?: boolean},
    ) => {
      if (!story) return;
      const known = mediaCacheRef.current[story._id] ?? 0;
      if (known > Date.now()) return; // already warmed within this session

      const expiresAt = storyExpiresAt(story.createdAt);

      if (story.mediaType === 'image') {
        const mediaUri = resolveMediaUrl(story.mediaUrl);
        if (mediaUri) await Image.prefetch(mediaUri).catch(() => false);
      } else if (story.hlsMasterUrl) {
        // HLS story: prefetch first 6 segments
        const masterUrl = isCellular
          ? story.hlsMasterUrl.replace(/master\.m3u8$/, 'master_cell.m3u8')
          : story.hlsMasterUrl;
        prefetchHlsSegments(masterUrl, story._id, isCellular, 6);
        const thumb = postThumbnailUri(story);
        if (thumb) await Image.prefetch(resolveMediaUrl(thumb)).catch(() => false);
      } else {
        // Legacy progressive MP4
        const mediaUri = resolveMediaUrl(story.mediaUrl);
        if (!mediaUri) { mediaCacheRef.current[story._id] = expiresAt; return; }
        const thumb = postThumbnailUri(story);
        if (thumb) await Image.prefetch(resolveMediaUrl(thumb)).catch(() => false);
        if (opts?.prefetchToDisk) {
          prefetchStoryVideoToDisk(mediaUri, story._id);
        }
      }
      mediaCacheRef.current[story._id] = expiresAt;
      saveCacheIndex().catch(() => null);
    },
    [saveCacheIndex, isCellular],
  );

  useEffect(() => {
    if (!current || current.mediaType !== 'video') {
      setStoryVideoPlayUri(null);
      return;
    }

    // For HLS stories: use master URL directly (no disk cache needed — segments are prefetched)
    if (current.hlsMasterUrl) {
      const hlsUrl = resolveVideoUrl(current, isCellular);
      setStoryVideoPlayUri(resolveMediaUrl(hlsUrl));
      return;
    }

    // Legacy progressive MP4: check disk cache first
    const remote = resolveMediaUrl(current.mediaUrl);
    if (!remote?.trim()) {
      setStoryVideoPlayUri(null);
      return;
    }
    const storyId = current._id;
    setStoryVideoPlayUri(null);
    let alive = true;
    void (async () => {
      const uri = await resolveStoryVideoPlayUri(remote, storyId);
      if (!alive) return;
      if (activeStoryIdRef.current !== storyId) return;
      setStoryVideoPlayUri(uri);
    })();
    return () => {
      alive = false;
    };
  }, [current, isCellular]);

  const goNext = useCallback(() => {
    const leavingId = current?._id;
    if (leavingId) {
      void markStorySeenPost(leavingId).then(() => {
        DeviceEventEmitter.emit('bromo:storiesChanged');
      });
    }
    if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(gi => gi + 1);
      setStoryIdx(0);
    } else {
      navigation.goBack();
    }
    setPickedReaction(null);
  }, [current?._id, storyIdx, stories.length, groupIdx, groups.length, navigation]);

  const onStoryVideoEnd = useCallback(() => {
    // For legacy MP4 stories, cache to disk for instant replay
    if (current?.mediaType === 'video' && !current.hlsMasterUrl) {
      const u = resolveMediaUrl(current.mediaUrl);
      if (u?.trim()) prefetchStoryVideoToDisk(u, current._id);
    }
    goNext();
  }, [current, goNext]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(gi => gi - 1);
      setStoryIdx(0);
    }
    setPickedReaction(null);
  }, [storyIdx, groupIdx]);

  // Reset per-story state when the current story changes
  useEffect(() => {
    setMediaReady(false);
    videoProgressAnim.setValue(0);
    progressAnim.setValue(0);
    setStoryDurationMs(
      current?.mediaType === 'video'
        ? STORY_DURATION_VIDEO_FALLBACK_MS
        : STORY_DURATION_IMAGE_MS,
    );
  }, [current?._id, current?.mediaType, videoProgressAnim, progressAnim]);

  // Auto-advance timer — images only; videos advance on `onEnd`
  useEffect(() => {
    if (!current || current.mediaType !== 'image' || paused || showReply || !mediaReady) return;
    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: storyDurationMs,
      useNativeDriver: false,
    });
    progressRef.current = anim;
    anim.start(({finished}) => { if (finished) goNext(); });
    return () => { anim.stop(); };
  }, [current, paused, showReply, goNext, mediaReady, storyDurationMs, progressAnim]);

  // Prefetch current + next stories
  useEffect(() => {
    if (!current) return;
    const idx = allStories.findIndex(s => s._id === current._id);
    if (idx < 0) return;
    warmStoryMedia(current).catch(() => null);
    for (let i = 1; i <= PREFETCH_LOOKAHEAD; i++) {
      const next = allStories[idx + i];
      if (!next) break;
      warmStoryMedia(next, {prefetchToDisk: i === 1}).catch(() => null);
    }
  }, [allStories, current?._id, warmStoryMedia, current]);

  // Video progress — updates Animated.Value directly (zero re-renders)
  const onVideoProgress = useCallback((d: OnProgressData) => {
    const dur = Number(d.seekableDuration || 0);
    if (dur > 0) {
      videoProgressAnim.setValue(Math.max(0, Math.min(1, d.currentTime / dur)));
    }
  }, [videoProgressAnim]);

  const handleStoryReaction = useCallback(
    async (key: StoryReactionKey) => {
      if (!current || !group) return;
      if (dbUser?._id && String(group.author._id) === String(dbUser._id)) return;
      setPickedReaction(key);
      try {
        await reactToStory(current._id, key);
      } catch {
        setPickedReaction(null);
      }
    },
    [current, group, dbUser?._id],
  );

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !group) return;
    try {
      const convId = await openThreadForUser(
        group.author._id,
        group.author.displayName,
        group.author.profilePicture ?? '',
        group.author.username,
      );
      parentNavigate(navigation, 'MessagesFlow', {
        screen: 'ChatThread',
        params: {peerId: convId, prefilledText: `Replied to your story: ${replyText.trim()}`},
      });
    } catch {}
    setReplyText('');
    setShowReply(false);
  }, [replyText, group, openThreadForUser, navigation]);

  /** Pinch/zoom on story media — must run before any early return (Rules of Hooks). */
  const mediaScale = useSharedValue(1);
  const mediaTx = useSharedValue(0);
  const mediaTy = useSharedValue(0);
  const pinchBase = useSharedValue(1);
  const panOriginX = useSharedValue(0);
  const panOriginY = useSharedValue(0);

  useEffect(() => {
    mediaScale.value = 1;
    mediaTx.value = 0;
    mediaTy.value = 0;
    pinchBase.value = 1;
  }, [current?._id, mediaScale, mediaTx, mediaTy, pinchBase]);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchBase.value = mediaScale.value;
    })
    .onUpdate(e => {
      mediaScale.value = Math.min(4, Math.max(1, pinchBase.value * e.scale));
    })
    .onEnd(() => {
      if (mediaScale.value < 1.02) {
        mediaScale.value = withTiming(1);
        mediaTx.value = withTiming(0);
        mediaTy.value = withTiming(0);
      }
      pinchBase.value = mediaScale.value;
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      panOriginX.value = mediaTx.value;
      panOriginY.value = mediaTy.value;
    })
    .onUpdate(e => {
      if (mediaScale.value > 1.02) {
        mediaTx.value = panOriginX.value + e.translationX;
        mediaTy.value = panOriginY.value + e.translationY;
      }
    });

  const storyZoomGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const storyZoomStyle = useAnimatedStyle(() => ({
    width: W,
    height: H,
    transform: [{translateX: mediaTx.value}, {translateY: mediaTy.value}, {scale: mediaScale.value}],
  }));

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!group || stories.length === 0 || !current) {
    return (
      <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <StatusBar barStyle="light-content" />
        <Text style={{color: '#fff', fontWeight: '700', textAlign: 'center'}}>No stories available</Text>
        <Pressable onPress={() => navigation.goBack()} style={{marginTop: 20}} hitSlop={12}>
          <ChevronLeft color="#fff" size={28} />
        </Pressable>
      </View>
    );
  }

  const mediaUri = resolveMediaUrl(current.mediaUrl);
  const poster = postThumbnailUri(current) || undefined;
  const avatarUri = group.author.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(group.author.displayName)}&size=64`;
  const viewingOwnStories = Boolean(dbUser?._id && String(group.author._id) === String(dbUser._id));

  // Parse story overlays and bg color from storyMeta
  const storyMeta = (current as unknown as {storyMeta?: StoryMeta}).storyMeta;
  const bgColor = storyMeta?.bgColor;
  const overlays: StoryOverlay[] = storyMeta?.overlays ?? [];
  const mentionOverlays = overlays.filter(o => o.type === 'mention');
  const isColorBg = Boolean(bgColor) && (!mediaUri || mediaUri === 'color-bg');

  const openOwnAnalytics = () => {
    if (!current?._id) return;
    setAnalyticsOpen(true);
    Promise.all([getStoryViewers(current._id), getStoryAnalytics(current._id)])
      .then(([viewers, analytics]) => {
        setStoryViewers(viewers.viewers);
        setStoryAnalytics(analytics);
      })
      .catch(() => null);
  };

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <StatusBar barStyle="light-content" hidden={false} backgroundColor="#000" />

      <ThemedConfirmModal
        visible={deleteStoryId != null}
        title="Delete?"
        message={"Are you sure you want to delete? This can't be undone."}
        cancelLabel="Cancel"
        onCancel={() => setDeleteStoryId(null)}
        confirmLabel="Delete"
        destructiveConfirm
        onConfirm={() => {
          const id = deleteStoryId;
          setDeleteStoryId(null);
          if (!id) return;
          deletePost(id)
            .then(() => {
              DeviceEventEmitter.emit('bromo:storiesChanged');
              navigation.goBack();
            })
            .catch(e =>
              Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'),
            );
        }}
      />

      <Modal visible={ownMenuOpen} transparent animationType="fade" onRequestClose={() => setOwnMenuOpen(false)}>
        <Pressable
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'}}
          onPress={() => setOwnMenuOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: palette.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: Math.max(insets.bottom, 16),
            }}>
            <Pressable
              style={{paddingVertical: 16, paddingHorizontal: 20}}
              onPress={() => {
                setOwnMenuOpen(false);
                parentNavigate(navigation, 'CreateFlow', {editPostId: current._id});
              }}>
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '700'}}>Edit story</Text>
              <Text style={{color: palette.foregroundMuted, fontSize: 12, marginTop: 4}}>
                Caption, audience, comments, close friends…
              </Text>
            </Pressable>
            <Pressable
              style={{paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: palette.border}}
              onPress={() => {
                setOwnMenuOpen(false);
                setDeleteStoryId(current._id);
              }}>
              <Text style={{color: palette.destructive, fontSize: 16, fontWeight: '800'}}>Delete story</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={mentionsOpen} transparent animationType="fade" onRequestClose={() => setMentionsOpen(false)}>
        <Pressable
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'}}
          onPress={() => setMentionsOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{backgroundColor: palette.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: Math.max(insets.bottom, 20)}}>
            <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900', marginBottom: 12}}>Mentions</Text>
            {mentionOverlays.length === 0 ? (
              <Text style={{color: palette.foregroundMuted}}>No mentions on this story.</Text>
            ) : (
              mentionOverlays.map(mention => (
                <Text key={mention.id} style={{color: palette.foreground, fontSize: 15, fontWeight: '700', paddingVertical: 8}}>
                  {mention.content.startsWith('@') ? mention.content : `@${mention.content}`}
                </Text>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={analyticsOpen} transparent animationType="slide" onRequestClose={() => setAnalyticsOpen(false)}>
        <Pressable
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'}}
          onPress={() => setAnalyticsOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{maxHeight: H * 0.72, backgroundColor: palette.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: Math.max(insets.bottom, 20)}}>
            <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900'}}>Story analytics</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14}}>
              {[
                ['Views', storyAnalytics?.views ?? 0],
                ['Impressions', storyAnalytics?.impressions ?? 0],
                ['Replies', storyAnalytics?.replyCount ?? 0],
                ['Mention taps', storyAnalytics?.mentionTapCount ?? 0],
                ['Link taps', storyAnalytics?.linkTapCount ?? 0],
                ['Shares', storyAnalytics?.sharesCount ?? 0],
              ].map(([label, value]) => (
                <View key={String(label)} style={{width: '30%', minWidth: 92, padding: 10, borderRadius: 12, backgroundColor: palette.surfaceHigh}}>
                  <Text style={{color: palette.foreground, fontWeight: '900'}}>{String(value)}</Text>
                  <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 2}}>{String(label)}</Text>
                </View>
              ))}
            </View>
            {storyAnalytics?.reactions && Object.keys(storyAnalytics.reactions).length > 0 ? (
              <View style={{marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                {Object.entries(storyAnalytics.reactions).map(([k, n]) => (
                  <View
                    key={k}
                    style={{paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: palette.surfaceHigh}}>
                    <Text style={{color: palette.foreground, fontSize: 13}}>
                      {reactionEmoji(k)} {n}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={{color: palette.foreground, fontSize: 14, fontWeight: '900', marginTop: 18, marginBottom: 8}}>Viewers</Text>
            {storyViewers.length === 0 ? (
              <Text style={{color: palette.foregroundMuted}}>No viewers yet.</Text>
            ) : (
              storyViewers.map(row => (
                <View
                  key={`${row.user._id}-${row.viewedAt}`}
                  style={{flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8}}>
                  <Image
                    source={{uri: row.user.profilePicture || `https://ui-avatars.com/api/?name=${row.user.displayName}`}}
                    style={{width: 34, height: 34, borderRadius: 17}}
                  />
                  <Text style={{color: palette.foreground, fontWeight: '700', flex: 1}}>{row.user.displayName}</Text>
                  {row.reaction ? (
                    <Text style={{fontSize: 18}}>{reactionEmoji(row.reaction)}</Text>
                  ) : null}
                </View>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Media / Background ──────────────────────────────────────────── */}
      {isColorBg ? (
        <View style={{width: W, height: H, backgroundColor: bgColor}} />
      ) : (
        <GestureDetector gesture={storyZoomGesture}>
          <Reanimated.View style={storyZoomStyle}>
            {current.mediaType === 'video' ? (
              storyVideoPlayUri == null ? (
                poster ? (
                  <Image
                    source={{uri: resolveMediaUrl(poster) ?? poster}}
                    style={{width: W, height: H}}
                    resizeMode="cover"
                    onLoadEnd={() => setMediaReady(true)}
                  />
                ) : (
                  <View style={{width: W, height: H, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )
              ) : (
                <NetworkVideo
                  key={`${current._id}-${storyVideoPlayUri.startsWith('file') ? 'local' : 'net'}`}
                  context={current.hlsMasterUrl ? 'story-hls' : 'story'}
                  uri={storyVideoPlayUri}
                  fallbackUri={
                    current.hlsMasterUrl ? resolveMediaUrl(current.mediaUrl) ?? undefined : undefined
                  }
                  posterUri={poster}
                  style={{width: W, height: H}}
                  repeat={false}
                  muted={false}
                  paused={paused || showReply}
                  resizeMode="cover"
                  maxBitRate={current.hlsMasterUrl ? maxBitRate : undefined}
                  posterOverlayUntilReady
                  onDecoderReady={() => setMediaReady(true)}
                  onLoad={(d: OnLoadData) => {
                    const sec = Number(d.duration);
                    if (Number.isFinite(sec) && sec > 0) {
                      const ms = Math.round(sec * 1000);
                      setStoryDurationMs(
                        Math.min(STORY_DURATION_VIDEO_MAX_MS, Math.max(STORY_DURATION_VIDEO_MIN_MS, ms)),
                      );
                    } else {
                      setStoryDurationMs(STORY_DURATION_VIDEO_FALLBACK_MS);
                    }
                  }}
                  onProgress={onVideoProgress}
                  onEnd={onStoryVideoEnd}
                />
              )
            ) : (
              <Image
                source={{uri: mediaUri}}
                style={{width: W, height: H}}
                resizeMode="cover"
                onLoadEnd={() => setMediaReady(true)}
                progressiveRenderingEnabled
                fadeDuration={80}
              />
            )}
          </Reanimated.View>
        </GestureDetector>
      )}

      {/* ── Color-bg overlay tint (when story has media + a bg tint) ─────── */}
      {bgColor && !isColorBg ? (
        <View
          pointerEvents="none"
          style={{position: 'absolute', width: W, height: H, backgroundColor: bgColor, opacity: 0.35}}
        />
      ) : null}

      {/* ── Story overlays (text / emoji / music badge) ───────────────────── */}
      {overlays.map(o => (
        <View
          key={o.id}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: o.x * W,
            top: o.y * H,
            transform: [{scale: o.scale ?? 1}],
          }}>
          {o.type === 'music' ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 6,
            }}>
              <Text style={{fontSize: 16}}>🎵</Text>
              <Text style={{color: '#fff', fontSize: 13, fontWeight: '700'}}>{o.content}</Text>
            </View>
          ) : o.type === 'sticker' || o.type === 'mention' ? (
            <View style={{
              backgroundColor: o.type === 'mention' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)',
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}>
              <Text style={{color: o.type === 'mention' ? '#111' : '#fff', fontSize: o.fontSize ?? 15, fontWeight: '900'}}>
                {o.type === 'mention' && !o.content.startsWith('@') ? `@${o.content}` : o.content}
              </Text>
            </View>
          ) : (
            <Text style={{
              color: o.color ?? '#fff',
              fontSize: o.fontSize ?? 24,
              fontWeight: '800',
              textShadowColor: 'rgba(0,0,0,0.5)',
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 4,
            }}>
              {o.content}
            </Text>
          )}
        </View>
      ))}

      {/* ── Progress bars ──────────────────────────────────────────────────── */}
      <View style={{position: 'absolute', top: insets.top + 12, left: 8, right: 8, flexDirection: 'row', gap: 3}}>
        {stories.map((s, i) => (
          <View
            key={s._id}
            style={{flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden'}}>
            {i < storyIdx ? (
              <View style={{flex: 1, backgroundColor: '#fff'}} />
            ) : i === storyIdx ? (
              current.mediaType === 'video' ? (
                <Animated.View style={{
                  height: 2.5, backgroundColor: '#fff',
                  width: videoProgressAnim.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']}),
                }} />
              ) : (
                <Animated.View style={{
                  height: 2.5, backgroundColor: '#fff',
                  width: progressAnim.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']}),
                }} />
              )
            ) : null}
          </View>
        ))}
      </View>

      {/* ── Author row ──────────────────────────────────────────────────────── */}
      <View style={{
        position: 'absolute', top: insets.top + 24, left: 12, right: 12,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft color="#fff" size={22} />
        </Pressable>
        <Image
          source={{uri: avatarUri}}
          style={{width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff'}}
        />
        <Text style={{color: '#fff', fontWeight: '700', fontSize: 14, flex: 1}}>
          @{group.author.username}
        </Text>
        {mentionOverlays.length > 0 ? (
          <Pressable
            onPress={() => {
              setMentionsOpen(true);
              if (current?._id) void recordStoryTap(current._id, 'mention');
            }}
            hitSlop={12}
            style={{padding: 4}}>
            <AtSign color="#fff" size={21} />
          </Pressable>
        ) : null}
        {viewingOwnStories ? (
          <>
            <Pressable onPress={openOwnAnalytics} hitSlop={12} style={{padding: 4}}>
              <BarChart2 color="#fff" size={21} />
            </Pressable>
            <Pressable onPress={openOwnAnalytics} hitSlop={12} style={{padding: 4}}>
              <Users color="#fff" size={21} />
            </Pressable>
            <Pressable onPress={() => setOwnMenuOpen(true)} hitSlop={12} style={{padding: 4}}>
              <MoreVertical color="#fff" size={22} />
            </Pressable>
          </>
        ) : null}
      </View>

      {/* ── Tap zones ───────────────────────────────────────────────────────── */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 70,
          left: 0,
          right: 0,
          bottom: insets.bottom + 100,
          flexDirection: 'row',
        }}>
        <Pressable
          style={{flex: 1}}
          onPress={goPrev}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
        <Pressable
          style={{flex: 1}}
          onPress={goNext}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
      </View>

      {/* ── Bottom controls ─────────────────────────────────────────────────── */}
      {showReply ? (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: 'rgba(0,0,0,0.7)',
          paddingHorizontal: 14, paddingVertical: 12, paddingBottom: Math.max(insets.bottom, 16),
        }}>
          <TextInput
            ref={inputRef}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={`Reply to @${group.author.username}…`}
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={{
              flex: 1,
              color: '#fff',
              fontSize: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.3)',
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
            autoFocus
            onSubmitEditing={handleReply}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleReply}
            hitSlop={8}
            style={{padding: 10, backgroundColor: palette.primary, borderRadius: 22}}>
            <Send size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setShowReply(false)} hitSlop={8}>
            <Text style={{color: 'rgba(255,255,255,0.7)', fontWeight: '700'}}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingHorizontal: 16, paddingVertical: 14, paddingBottom: Math.max(insets.bottom, 16),
        }}>
          <Pressable
            onPress={() => { setShowReply(true); setPaused(true); }}
            style={{
              flex: 1,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
              borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11,
            }}>
            <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 14}}>
              {group.author._id === dbUser?._id
                ? 'Viewers can reply…'
                : `Reply to @${group.author.username}…`}
            </Text>
          </Pressable>

          {!viewingOwnStories ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4}}>
              {STORY_REACTION_ROW.map(r => (
                <Pressable
                  key={r.key}
                  onPress={() => void handleStoryReaction(r.key)}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 4,
                    paddingVertical: 2,
                    opacity: pickedReaction === r.key ? 1 : 0.9,
                    borderWidth: pickedReaction === r.key ? 1 : 0,
                    borderColor: 'rgba(255,255,255,0.4)',
                    borderRadius: 8,
                  }}>
                  <Text style={{fontSize: 24}}>{r.sym}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Pressable
            onPress={() => parentNavigate(navigation, 'ShareSend', {postId: current._id})}
            hitSlop={12}
            style={{alignItems: 'center', justifyContent: 'center', width: 40, height: 40}}>
            <Share2 size={26} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
