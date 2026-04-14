import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {ChevronLeft, Heart, Send, Share2} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {useMessaging} from '../messaging/MessagingContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getStories, toggleLike, type StoryGroup} from '../api/postsApi';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {parentNavigate} from '../navigation/parentNavigate';
import type {OnLoadData, OnProgressData} from 'react-native-video';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryView'>;

const STORY_DURATION_IMAGE_MS = 5000;
const STORY_DURATION_VIDEO_FALLBACK_MS = 15000;
const STORY_DURATION_VIDEO_MIN_MS = 4000;
const STORY_DURATION_VIDEO_MAX_MS = 30000;
const PREFETCH_LOOKAHEAD = 6;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = '@bromo/story_media_cache_v2';
const {width: W, height: H} = Dimensions.get('window');

type StoryMediaCache = Record<string, number>;

// Story overlay types stored in storyMeta
type StoryOverlay = {
  id: string;
  type: 'text' | 'emoji' | 'music';
  content: string;
  x: number; // 0–1 relative to W
  y: number; // 0–1 relative to H
  color?: string;
  fontSize?: number;
};

type StoryMeta = {
  bgColor?: string;
  overlays?: StoryOverlay[];
};

function storyExpiresAt(createdAt: string): number {
  const createdMs = new Date(createdAt).getTime();
  return (Number.isFinite(createdMs) ? createdMs : Date.now()) + STORY_TTL_MS;
}

async function warmVideo(url: string): Promise<void> {
  // Warm CDN / OS HTTP cache with the first 512 KB chunk.
  try {
    await fetch(url, {headers: {'Range': 'bytes=0-524287'}});
  } catch {}
}

export function StoryViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const {openThreadForUser} = useMessaging();
  const {userId} = route.params;

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [storyDurationMs, setStoryDurationMs] = useState(STORY_DURATION_IMAGE_MS);

  // Animated values — never setState on progress tick to avoid re-renders
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const videoProgressAnim = useRef(new Animated.Value(0)).current;

  const inputRef = useRef<TextInput>(null);
  const mediaCacheRef = useRef<StoryMediaCache>({});

  // ─── critical fix: only position group/story on the INITIAL groups load ──────
  // Without this, the 20-second refresh resets storyIdx every time, causing the
  // video to restart from the beginning and producing the buffering/loop glitch.
  const groupsInitialized = useRef(false);

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

  const load = useCallback(() => {
    // Don't show the full-screen spinner on background refreshes
    if (!groupsInitialized.current) setLoading(true);
    getStories()
      .then(r => setGroups(r.stories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCacheIndex().finally(() => null);
    load();
  }, [load, loadCacheIndex]);

  // Background sync — keeps story list fresh but does NOT reset current position.
  useEffect(() => {
    const t = setInterval(() => { load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  // Position to the correct group/story — ONLY on the very first groups load.
  useEffect(() => {
    if (groups.length === 0 || groupsInitialized.current) return;
    groupsInitialized.current = true;
    const i = groups.findIndex(g => g.author._id === userId || g.author.username === userId);
    setGroupIdx(Math.max(0, i));
    setStoryIdx(0);
  }, [groups, userId]);

  const group = groups[groupIdx];
  const stories = group?.stories ?? [];
  const current = stories[storyIdx];

  const allStories = useMemo(() => groups.flatMap(g => g.stories), [groups]);

  const warmStoryMedia = useCallback(
    async (story: StoryGroup['stories'][number] | undefined) => {
      if (!story) return;
      const mediaUri = resolveMediaUrl(story.mediaUrl);
      if (!mediaUri) return;
      const known = mediaCacheRef.current[story._id] ?? 0;
      if (known > Date.now()) return; // already warmed within this session

      const expiresAt = storyExpiresAt(story.createdAt);
      if (story.mediaType === 'image') {
        await Image.prefetch(mediaUri).catch(() => false);
      } else {
        const thumb = postThumbnailUri(story);
        if (thumb) await Image.prefetch(resolveMediaUrl(thumb)).catch(() => false);
        await warmVideo(mediaUri);
      }
      mediaCacheRef.current[story._id] = expiresAt;
      saveCacheIndex().catch(() => null);
    },
    [saveCacheIndex],
  );

  const goNext = useCallback(() => {
    if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(gi => gi + 1);
      setStoryIdx(0);
    } else {
      navigation.goBack();
    }
    setLiked(false);
  }, [storyIdx, stories.length, groupIdx, groups.length, navigation]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(gi => gi - 1);
      setStoryIdx(0);
    }
    setLiked(false);
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
  }, [current?._id, current?.mediaType, paused, showReply, goNext, mediaReady, storyDurationMs, progressAnim]);

  // Prefetch current + next stories
  useEffect(() => {
    if (!current) return;
    const idx = allStories.findIndex(s => s._id === current._id);
    if (idx < 0) return;
    warmStoryMedia(current).catch(() => null);
    for (let i = 1; i <= PREFETCH_LOOKAHEAD; i++) {
      const next = allStories[idx + i];
      if (!next) break;
      warmStoryMedia(next).catch(() => null);
    }
  }, [allStories, current?._id, warmStoryMedia, current]);

  // Video progress — updates Animated.Value directly (zero re-renders)
  const onVideoProgress = useCallback((d: OnProgressData) => {
    const dur = Number(d.seekableDuration || 0);
    if (dur > 0) {
      videoProgressAnim.setValue(Math.max(0, Math.min(1, d.currentTime / dur)));
    }
  }, [videoProgressAnim]);

  const handleLike = useCallback(async () => {
    if (!current) return;
    setLiked(l => !l);
    try { await toggleLike(current._id); } catch {}
  }, [current]);

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

  // Parse story overlays and bg color from storyMeta
  const storyMeta = (current as unknown as {storyMeta?: StoryMeta}).storyMeta;
  const bgColor = storyMeta?.bgColor;
  const overlays: StoryOverlay[] = storyMeta?.overlays ?? [];
  const isColorBg = Boolean(bgColor) && (!mediaUri || mediaUri === 'color-bg');

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <StatusBar barStyle="light-content" hidden />

      {/* ── Media / Background ──────────────────────────────────────────── */}
      {isColorBg ? (
        <View style={{width: W, height: H, backgroundColor: bgColor}} />
      ) : current.mediaType === 'video' ? (
        <NetworkVideo
          key={current._id}
          context="story"
          uri={mediaUri}
          posterUri={poster}
          style={{width: W, height: H}}
          repeat={false}
          muted={false}
          paused={paused || showReply}
          resizeMode="cover"
          // Use built-in poster management: stays visible until onReadyForDisplay fires.
          // This is the fix for the black-frame flash — we no longer hide the poster
          // prematurely on onLoad (metadata ready).
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
          onEnd={goNext}
        />
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
      <View style={{position: 'absolute', top: 12, left: 8, right: 8, flexDirection: 'row', gap: 3}}>
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
        position: 'absolute', top: 24, left: 12, right: 12,
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
      </View>

      {/* ── Tap zones ───────────────────────────────────────────────────────── */}
      <View
        pointerEvents="box-none"
        style={{position: 'absolute', top: 70, left: 0, right: 0, bottom: 100, flexDirection: 'row'}}>
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
          paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 28,
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
          paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28,
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

          <Pressable
            onPress={handleLike}
            hitSlop={12}
            style={{alignItems: 'center', justifyContent: 'center', width: 40, height: 40}}>
            <Heart
              size={26}
              color={liked ? '#ef4444' : '#fff'}
              fill={liked ? '#ef4444' : 'transparent'}
            />
          </Pressable>

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
