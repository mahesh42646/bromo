import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
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
  type NativeSyntheticEvent,
  type NativeScrollEvent,
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
  Repeat,
  Share2,
  Info,
  CheckCircle2,
  XCircle,
  Flag,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NavigationProp, RouteProp} from '@react-navigation/native';
import type {MainTabParamList} from '../navigation/appStackParamList';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {followUser, unfollowUser} from '../api/followApi';
import {
  createStoryFromReel,
  getPost,
  getReels,
  toggleLike,
  recordView,
  recordShare,
  resolveVideoUrl,
  toggleSavePost,
  sendReelFeedback,
  fetchPostWhy,
  reportPostStrict,
  type Post,
} from '../api/postsApi';
import {fetchAds, type Ad} from '../api/adsApi';
import {AdReelItem} from '../components/AdReelItem';
import {socketService} from '../services/socketService';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {usePlaybackNetworkCap} from '../lib/usePlaybackNetworkCap';
import {prefetchHlsSegments} from '../lib/hlsPrefetch';
import type {ThemePalette} from '../config/platform-theme';
import {usePlaybackMute} from '../context/PlaybackMuteContext';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Hashtag tokens from caption (e.g. #travel). */
function hashtagTokensFromCaption(caption: string): string[] {
  const m = caption.match(/#[\w\u0080-\uFFFF]+/g);
  return m ?? [];
}

/** Caption text with hashtag tokens stripped (one-line display uses this). */
function captionWithoutHashtags(caption: string): string {
  return caption.replace(/#[\w\u0080-\uFFFF]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickAdSlots(contentCount: number, adCount: number, minGap = 2): number[] {
  if (contentCount === 0 || adCount === 0) return [];
  const maxAds = Math.min(adCount, Math.max(1, Math.ceil(contentCount / minGap)));
  const slots: number[] = [];
  let attempts = 0;
  while (slots.length < maxAds && attempts < 200) {
    attempts++;
    const pos = Math.floor(Math.random() * contentCount);
    if (slots.every(s => Math.abs(s - pos) >= minGap)) {
      slots.push(pos);
    }
  }
  return slots.sort((a, b) => a - b);
}

type ReelFeedTab = 'forYou' | 'friends';

type ReelFeedItem =
  | {_itemType: 'reel'; data: Post; _id: string}
  | {_itemType: 'ad'; data: Ad; _id: string};

function ReelMoreSheet({
  visible,
  onClose,
  palette,
  bottomInset,
  autoScroll,
  onAutoScroll,
  reel,
  navigation,
  onRemoveFromFeed,
}: {
  visible: boolean;
  onClose: () => void;
  palette: ThemePalette;
  bottomInset: number;
  autoScroll: boolean;
  onAutoScroll: (v: boolean) => void;
  reel: Post | null;
  navigation: Nav;
  onRemoveFromFeed: (postId: string) => void;
}) {
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
              onPress={() => {
                if (!reel) return;
                toggleSavePost(reel._id)
                  .then(({saved}) => {
                    onClose();
                    Alert.alert(saved ? 'Saved' : 'Removed', saved ? 'Added to your saved posts.' : 'Removed from saved.');
                  })
                  .catch(e => Alert.alert('Save', e instanceof Error ? e.message : 'Try again.'));
              }}>
              <Bookmark size={22} color={palette.foreground} />
              <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>Save</Text>
            </Pressable>
            <Pressable
              style={{alignItems: 'center', width: 88, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.background}}
              onPress={() => {
                if (!reel) return;
                onClose();
                parentNavigate(navigation, 'CreateFlow', {
                  mode: 'reel',
                  bootstrapTs: Date.now(),
                  remixSourcePostId: reel._id,
                });
              }}>
              <Repeat size={22} color={palette.foreground} />
              <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>Remix</Text>
            </Pressable>
            <Pressable
              style={{alignItems: 'center', width: 88, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.background}}
              onPress={() => {
                if (!reel) return;
                onClose();
                void recordShare(reel._id);
                parentNavigate(navigation, 'ShareSend', {postId: reel._id});
              }}>
              <Share2 size={22} color={palette.foreground} strokeWidth={2} />
              <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>Share</Text>
            </Pressable>
          </View>
          <ScrollView style={{maxHeight: 420}} showsVerticalScrollIndicator={false}>
            <View style={[groupStyle, {backgroundColor: palette.background, borderColor: palette.border, paddingVertical: 6, paddingHorizontal: 2}]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  justifyContent: 'space-between',
                }}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 14}}>
                  <Repeat size={20} color={palette.foreground} />
                  <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Auto-scroll</Text>
                </View>
                <Switch value={autoScroll} onValueChange={onAutoScroll} />
              </View>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
                onPress={() => {
                  if (!reel) return;
                  createStoryFromReel(reel._id)
                    .then(() => {
                      DeviceEventEmitter.emit('bromo:storiesChanged');
                      onClose();
                      Alert.alert(
                        'Added successfully to your story.',
                        ' It may take a bit to process before it is visible to all your friends.',
                      );
                    })
                    .catch(e =>
                      Alert.alert('Could not add', e instanceof Error ? e.message : 'Try again.'),
                    );
                }}>
                <Sparkles size={20} color={palette.accent} />
                <Text style={{color: palette.accent, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Add reel to your story</Text>
              </Pressable>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
                onPress={() => {
                  if (!reel) return;
                  sendReelFeedback(reel._id, 'interested')
                    .then(() => {
                      onClose();
                      Alert.alert('Thanks', "We'll show you more reels like this.");
                    })
                    .catch(e => Alert.alert('Feedback', e instanceof Error ? e.message : 'Try again.'));
                }}>
                <CheckCircle2 size={20} color={palette.foreground} />
                <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Interested</Text>
              </Pressable>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
                onPress={() => {
                  if (!reel) return;
                  sendReelFeedback(reel._id, 'not_interested')
                    .then(() => {
                      onRemoveFromFeed(reel._id);
                      onClose();
                      Alert.alert('Updated', "We won't push similar reels as hard in your feed.");
                    })
                    .catch(e => Alert.alert('Feedback', e instanceof Error ? e.message : 'Try again.'));
                }}>
                <XCircle size={20} color={palette.foreground} />
                <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Not interested</Text>
              </Pressable>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
                onPress={() => {
                  if (!reel) return;
                  Alert.alert('Report', 'What is wrong with this reel?', [
                    {text: 'Cancel', style: 'cancel'},
                    {
                      text: 'Spam',
                      onPress: () =>
                        reportPostStrict(reel._id, 'spam')
                          .then(() => {
                            onClose();
                            Alert.alert('Reported', 'Thanks — our team will review it.');
                          })
                          .catch(e => Alert.alert('Report', e instanceof Error ? e.message : 'Try again.')),
                    },
                    {
                      text: 'Harassment',
                      onPress: () =>
                        reportPostStrict(reel._id, 'harassment')
                          .then(() => {
                            onClose();
                            Alert.alert('Reported', 'Thanks — our team will review it.');
                          })
                          .catch(e => Alert.alert('Report', e instanceof Error ? e.message : 'Try again.')),
                    },
                    {
                      text: 'Nudity / sexual',
                      onPress: () =>
                        reportPostStrict(reel._id, 'nudity')
                          .then(() => {
                            onClose();
                            Alert.alert('Reported', 'Thanks — our team will review it.');
                          })
                          .catch(e => Alert.alert('Report', e instanceof Error ? e.message : 'Try again.')),
                    },
                    {
                      text: 'Other',
                      onPress: () =>
                        reportPostStrict(reel._id, 'other')
                          .then(() => {
                            onClose();
                            Alert.alert('Reported', 'Thanks — our team will review it.');
                          })
                          .catch(e => Alert.alert('Report', e instanceof Error ? e.message : 'Try again.')),
                    },
                  ]);
                }}>
                <Flag size={20} color={palette.destructive} />
                <Text style={{color: palette.destructive, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Report</Text>
              </Pressable>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
                onPress={() => {
                  onClose();
                  parentNavigate(navigation, 'Profile', {openSettings: true});
                }}>
                <SlidersHorizontal size={20} color={palette.foreground} />
                <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Manage content preferences</Text>
              </Pressable>

              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                }}
                onPress={() => {
                  if (!reel) return;
                  fetchPostWhy(reel._id)
                    .then(why => {
                      Alert.alert("Why you're seeing this", why.lines.join('\n\n'));
                    })
                    .catch(e => Alert.alert('Why this reel', e instanceof Error ? e.message : 'Try again.'));
                }}>
                <Info size={20} color={palette.foreground} />
                <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '500', marginLeft: 8}}>
                  {"Why you're seeing this"}
                </Text>
              </Pressable>
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
  onNaturalEnd,
  isCellular,
  maxBitRate,
  viewerAvatarUri,
  onRemoveFromFeed,
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
  onNaturalEnd?: () => void;
  isCellular: boolean;
  maxBitRate: number | null;
  viewerAvatarUri?: string;
  onRemoveFromFeed: (postId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const {palette, contract} = useTheme();
  const {dbUser} = useAuth();
  const {reelsMuted, toggleReelsMuted} = usePlaybackMute();
  const [holdPaused, setHoldPaused] = useState(false);
  const suppressMuteTap = useRef(false);
  const [following, setFollowing] = useState(item.isFollowing);
  const [coverSpinner, setCoverSpinner] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const viewRecorded = useRef(false);
  const watchStartMs = useRef(0);
  const accumulatedWatchMs = useRef(0);
  const durationRef = useRef(0);
  const lastProgTick = useRef(0);
  const clearedSpinnerOnProgress = useRef(false);
  /** One completion signal per reel (avoids counting every loop when repeat is on). */
  const naturalEndSentRef = useRef(false);
  const {borderRadiusScale} = contract.brandGuidelines;
  const avatarUri = item.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author.displayName)}&background=random`;

  useEffect(() => {
    setCoverSpinner(true);
    setProgress(0);
    durationRef.current = 0;
    clearedSpinnerOnProgress.current = false;
    naturalEndSentRef.current = false;
  }, [item._id, item.mediaUrl]);

  useEffect(() => {
    if (!isActive) setHoldPaused(false);
  }, [isActive]);

  const paused = !isActive || holdPaused;

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

  const handleFollowToggle = async () => {
    try {
      if (following) {
        await unfollowUser(item.author._id);
        setFollowing(false);
      } else {
        await followUser(item.author._id);
        setFollowing(true);
      }
    } catch {}
  };

  const isOwnReel = Boolean(dbUser?._id && String(item.author._id) === String(dbUser._id));
  const discUriRaw = isOwnReel && viewerAvatarUri ? viewerAvatarUri : avatarUri;
  const discUri = resolveMediaUrl(discUriRaw) || discUriRaw;
  const rawCaption = item.caption ?? '';
  const hashtagLine = hashtagTokensFromCaption(rawCaption).join(' ');
  const captionLine = captionWithoutHashtags(rawCaption);
  /** Match `TabNavigator` tab bar: `56 + max(insets.bottom, 10)`. */
  const tabBarTopFromBottom = 56 + Math.max(insets.bottom, 10);

  // Prefer HLS master URL for ABR playback; fall back to progressive MP4 for legacy posts
  const rawVideoUrl = resolveVideoUrl(item, isCellular);
  const playUri = resolveMediaUrl(rawVideoUrl);
  const thumbUri = resolveMediaUrl(item.thumbnailUrl ?? '') || playUri;
  const isHls = rawVideoUrl.endsWith('.m3u8');

  /** Stable so `NetworkVideo` safety timer / native callbacks are not reset every progress tick. */
  const hideCoverSpinner = useCallback(() => {
    setCoverSpinner(false);
  }, []);

  return (
    <View style={{width: reelWidth, height: reelHeight, position: 'relative', backgroundColor: '#000'}}>
      {item.mediaType === 'video' ? (
        <NetworkVideo
          key={item._id}
          context={isHls ? 'reel-hls' : 'reel'}
          uri={playUri}
          fallbackUri={isHls ? resolveMediaUrl(item.mediaUrl) ?? undefined : undefined}
          posterUri={item.thumbnailUrl ? thumbUri : undefined}
          maxBitRate={isHls ? maxBitRate : undefined}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
          repeat={!autoScroll}
          paused={paused}
          muted={reelsMuted}
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
            if (isActive && !naturalEndSentRef.current) {
              naturalEndSentRef.current = true;
              onNaturalEnd?.();
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

      {/* Pause indicator (inactive reel or hold-to-pause) */}
      {(!isActive || holdPaused) && (
        <View
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: [{translateX: -24}, {translateY: -24}],
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
          }}
          pointerEvents="none">
          <Play size={22} color="#fff" fill="#fff" />
        </View>
      )}

      {/* Single tap: mute all reels. Long press: pause; release: resume. */}
      <Pressable
        style={{...StyleSheet.absoluteFillObject, zIndex: 1}}
        delayLongPress={280}
        onLongPress={() => {
          suppressMuteTap.current = true;
          setHoldPaused(true);
        }}
        onPressOut={() => {
          setHoldPaused(false);
        }}
        onPress={() => {
          if (suppressMuteTap.current) {
            suppressMuteTap.current = false;
            return;
          }
          toggleReelsMuted();
        }}
      />

      {/* Right side actions */}
      <View style={{position: 'absolute', right: 14, bottom: tabBarTopFromBottom - 10, alignItems: 'center', gap: 18, zIndex: 10}}>
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
          onPress={() => Alert.alert('Repost', 'Repost to your profile is coming soon.')}
          style={{alignItems: 'center', gap: 4}}>
          <Repeat size={26} color="#fff" strokeWidth={2} />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(item.sharesCount ?? 0)}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            recordShare(item._id);
            parentNavigate(navigation, 'ShareSend', {postId: item._id});
          }}
          style={{alignItems: 'center', gap: 4}}>
          <Send size={28} color="#fff" strokeWidth={2} />
          <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>{formatCount(item.sharesCount ?? 0)}</Text>
        </Pressable>

        <Pressable onPress={() => setMoreOpen(true)} hitSlop={8}>
          <MoreHorizontal size={28} color="#fff" strokeWidth={2} />
        </Pressable>

        {/* Audio tile — static cover (no spin) */}

        <Pressable onPress={() => parentNavigate(navigation, 'ReuseAudio', {audioId: item._id})}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: '#fff',
              overflow: 'hidden',
            }}>
            <Image source={{uri: discUri}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
          </View>
        </Pressable>
      </View>

      {/* Bottom info — compact: @user, optional verified, follow; then 1-line hashtags / caption only when present */}
      <View
        style={{position: 'absolute', bottom: 28 , left: 14, right: 76, gap: 2, zIndex: 10}}
        pointerEvents="box-none">
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
        <Image source={{uri: resolveMediaUrl(avatarUri) || avatarUri}} style={{width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)'}} />
        
          <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: item.author._id})}>
            <Text style={{color: '#fff', fontSize: 14, fontWeight: '800'}}>@{item.author.username}</Text>
          </Pressable>
          {item.author.emailVerified ? (
            <BadgeCheck size={16} color={palette.accent} fill={palette.accent} strokeWidth={2} />
          ) : null}
          <Pressable
            onPress={handleFollowToggle}
            style={{
              borderWidth: 1,
              borderColor: '#fff',
              borderRadius: borderRadiusScale === 'bold' ? 8 : 5,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}>
            <Text style={{color: '#fff', fontSize: 11, fontWeight: '800'}}>{following ? 'Following' : 'Follow'}</Text>
          </Pressable>
        </View>
        {hashtagLine ? (
          <Text
            style={{
              color: '#fff',
              fontSize: 12,
              lineHeight: 16,
              fontWeight: '600',
              textShadowColor: 'rgba(0,0,0,0.45)',
              textShadowRadius: 6,
              textShadowOffset: {width: 0, height: 1},
            }}
            numberOfLines={1}
            ellipsizeMode="tail">
            {hashtagLine}
          </Text>
        ) : null}
        {captionLine ? (
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              lineHeight: 17,
              fontWeight: '500',
              textShadowColor: 'rgba(0,0,0,0.45)',
              textShadowRadius: 6,
              textShadowOffset: {width: 0, height: 1},
            }}
            numberOfLines={1}
            ellipsizeMode="tail">
            {captionLine}
          </Text>
        ) : null}
        {item.music ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2}}>
            <Music2 size={12} color="#fff" strokeWidth={2} />
            <Text style={{color: '#fff', fontSize: 11, fontWeight: '600'}} numberOfLines={1}>
              {item.music}
            </Text>
          </View>
        ) : null}
      </View>

      <ReelMoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        palette={palette}
        bottomInset={insets.bottom}
        autoScroll={autoScroll}
        onAutoScroll={onAutoScrollChange}
        reel={item}
        navigation={navigation}
        onRemoveFromFeed={onRemoveFromFeed}
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
  const route = useRoute<RouteProp<MainTabParamList, 'Reels'>>();
  const initialPostId = route.params?.initialPostId;
  const {palette} = useTheme();
  const {ready: authReady, dbUser} = useAuth();
  const {setReelsMuted} = usePlaybackMute();
  const [screenFocused, setScreenFocused] = useState(true);
  const [sessionGateOpen, setSessionGateOpen] = useState(false);
  const sessionCompletesRef = useRef(0);
  const didScrollToInitialRef = useRef<string | null>(null);

  const viewerAvatarUri = useMemo(
    () => (dbUser?.profilePicture ? resolveMediaUrl(dbUser.profilePicture) || dbUser.profilePicture : undefined),
    [dbUser?.profilePicture],
  );

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      setReelsMuted(false);
      return () => setScreenFocused(false); // pause all on blur
    }, [setReelsMuted]),
  );
  const insets = useSafeAreaInsets();
  const [feedTab, setFeedTab] = useState<ReelFeedTab>('forYou');
  const [activeIndex, setActiveIndex] = useState(0);
  const win = Dimensions.get('window');
  /** Measured from FlatList `onLayout` — avoids `getItemLayout` using full window height while the tab bar consumes space (fixes >100% viewport / black paging gaps). */
  const [reelHeight, setReelHeight] = useState(0);
  const [reelWidth, setReelWidth] = useState(win.width);
  const {isCellular, maxBitRate} = usePlaybackNetworkCap();
  const [reels, setReels] = useState<Post[]>([]);
  const [reelAds, setReelAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const activeIndexRef = useRef(0);
  const displayReelsLenRef = useRef(0);
  const reelHeightRef = useRef(reelHeight);

  const displayReels = useMemo((): ReelFeedItem[] => {
    const basePosts = feedTab === 'friends' ? reels.filter(r => r.isFollowing) : reels;
    const items: ReelFeedItem[] = basePosts.map(p => ({_itemType: 'reel', data: p, _id: p._id}));
    if (reelAds.length === 0 || items.length === 0) return items;
    // Random insertion — never consecutive, works even with 1 reel
    const slots = pickAdSlots(items.length, reelAds.length, 2);
    for (let k = slots.length - 1; k >= 0; k--) {
      const ad = reelAds[k];
      items.splice(slots[k] + 1, 0, {_itemType: 'ad', data: ad, _id: `ad_${ad._id}`});
    }
    return items;
  }, [feedTab, reels, reelAds]);

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

  useEffect(() => {
    didScrollToInitialRef.current = null;
  }, [initialPostId]);

  useEffect(() => {
    if (!initialPostId || !authReady) return;
    getPost(initialPostId)
      .then(({post}) => {
        if (post.type !== 'reel') return;
        setReels(prev => (prev.some(r => r._id === post._id) ? prev : [post, ...prev]));
      })
      .catch(() => null);
  }, [initialPostId, authReady]);

  const onReelNaturalEnd = useCallback(() => {
    sessionCompletesRef.current += 1;
    if (sessionCompletesRef.current >= 5) {
      setSessionGateOpen(true);
    }
  }, []);

  const onAutoAdvanceClip = useCallback(() => {
    const next = activeIndexRef.current + 1;
    if (next >= displayReelsLenRef.current) return;
    try {
      listRef.current?.scrollToIndex({index: next, animated: true});
    } catch {
      listRef.current?.scrollToOffset({offset: next * reelHeightRef.current, animated: true});
    }
  }, []);

  const loadReels = useCallback(async (reset = false, retry = 0) => {
    const p = reset ? 1 : pageRef.current;
    try {
      const [res, adsRes] = await Promise.all([
        getReels(p),
        reset ? fetchAds('reels', 3) : Promise.resolve(null),
      ]);
      if (reset) {
        setReels(res.posts);
        if (adsRes) setReelAds(adsRes);
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
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /aborted|network request failed|timeout/i.test(msg);
      if (transient && retry < 1) {
        await loadReels(reset, retry + 1);
        return;
      }
      if (!transient) {
        console.error('[ReelsScreen] load error:', err);
      }
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
    const unsubNew = socketService.on('post:new', p => {
      if (p.type !== 'reel' || !p._id) return;
      const myId = dbUser?._id;
      const authorId = p.author?._id;
      const isSelf = Boolean(myId && authorId && String(authorId) === String(myId));
      const enriched: Post = {
        ...p,
        isLiked: p.isLiked ?? false,
        isFollowing: isSelf ? true : (p.isFollowing ?? false),
        likesCount: p.likesCount ?? 0,
        commentsCount: p.commentsCount ?? 0,
        viewsCount: p.viewsCount ?? 0,
        impressionsCount: p.impressionsCount ?? 0,
        sharesCount: p.sharesCount ?? 0,
        avgWatchTimeMs: p.avgWatchTimeMs ?? 0,
        trendingScore: p.trendingScore ?? 0,
      };
      setReels(prev => {
        if (prev.some(r => r._id === enriched._id)) return prev;
        return [enriched, ...prev];
      });
    });
    const unsubLike = socketService.on('post:like', ({postId, likesCount, liked}) => {
      setReels(prev =>
        prev.map(r => r._id === postId ? {...r, likesCount, isLiked: liked} : r),
      );
    });
    const unsubDelete = socketService.on('post:delete', ({postId}) => {
      setReels(prev => prev.filter(r => r._id !== postId));
    });
    const unsubComment = socketService.on('post:comment', ({postId, commentsCount}) => {
      setReels(prev =>
        prev.map(r => (r._id === postId ? {...r, commentsCount} : r)),
      );
    });
    return () => {
      unsubNew();
      unsubLike();
      unsubDelete();
      unsubComment();
    };
  }, [dbUser?._id]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'bromo:postCommentsCount',
      ({postId: pid, commentsCount}: {postId: string; commentsCount: number}) => {
        setReels(prev =>
          prev.map(r => (r._id === pid ? {...r, commentsCount} : r)),
        );
      },
    );
    return () => sub.remove();
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

  const removeReelFromFeed = useCallback((postId: string) => {
    setReels(prev => prev.filter(r => r._id !== postId));
  }, []);

  const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: ViewToken[]}) => {
    const reelItems = viewableItems
      .filter(v => v.isViewable && v.index != null && (v.item as {_itemType?: string})?._itemType === 'reel')
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const topMost = reelItems[0];
    if (topMost?.index != null) {
      activeIndexRef.current = topMost.index;
      setActiveIndex(topMost.index);
    }
  }).current;

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const h = reelHeightRef.current || e.nativeEvent.layoutMeasurement.height || 1;
    const idx = Math.max(0, Math.round(e.nativeEvent.contentOffset.y / h));
    activeIndexRef.current = idx;
    setActiveIndex(idx);
  }, []);

  // HLS prefetch: fully download next reel, partial for +2..+4
  useEffect(() => {
    const currentReels = reels;
    const idx = activeIndex;

    // Full prefetch for the next item (most likely to play)
    const next = currentReels[idx + 1];
    if (next?.hlsMasterUrl) {
      prefetchHlsSegments(
        isCellular
          ? next.hlsMasterUrl.replace(/master\.m3u8$/, 'master_cell.m3u8')
          : next.hlsMasterUrl,
        next._id,
        isCellular,
        null, // all segments
      );
    }

    // Partial lookahead for +2 to +4
    for (let i = idx + 2; i <= idx + 4 && i < currentReels.length; i++) {
      const r = currentReels[i];
      if (r?.hlsMasterUrl) {
        prefetchHlsSegments(
          isCellular
            ? r.hlsMasterUrl.replace(/master\.m3u8$/, 'master_cell.m3u8')
            : r.hlsMasterUrl,
          r._id,
          isCellular,
          6,
        );
      }
    }
  }, [activeIndex, reels, isCellular]);

  useEffect(() => {
    if (!initialPostId || loading || reelHeight <= 0) return;
    if (didScrollToInitialRef.current === initialPostId) return;
    const idx = displayReels.findIndex(it => it._itemType === 'reel' && it.data._id === initialPostId);
    if (idx < 0) return;
    didScrollToInitialRef.current = initialPostId;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({index: idx, animated: false});
      } catch {
        listRef.current?.scrollToOffset({offset: idx * reelHeight, animated: false});
      }
    });
  }, [initialPostId, loading, reelHeight, displayReels]);

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
        getItemLayout={
          reelHeight > 0
            ? (_data, index) => ({
                length: reelHeight,
                offset: reelHeight * index,
                index,
              })
            : undefined
        }
        // Instagram-style: render 1 ahead, keep 3 in window, unload rest
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={4}
        removeClippedSubviews={false}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={info => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({index: info.index, animated: true, viewPosition: 0.5});
          }, 350);
        }}
        ListEmptyComponent={
          <View style={{height: reelHeight > 0 ? reelHeight : win.height * 0.85, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24}}>
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
        renderItem={({item, index}) => {
          if (item._itemType === 'ad') {
            return (
              <AdReelItem
                ad={item.data}
                isActive={screenFocused && index === activeIndex}
                reelHeight={reelHeight}
                reelWidth={reelWidth}
                placement="reels"
              />
            );
          }
          return (
            <ReelItem
              item={item.data}
              isActive={screenFocused && index === activeIndex}
              reelHeight={reelHeight}
              reelWidth={reelWidth}
              navigation={navigation}
              onLike={handleLike}
              autoScroll={autoScroll}
              onAutoScrollChange={setAutoScroll}
              onAutoAdvanceClip={onAutoAdvanceClip}
              onNaturalEnd={onReelNaturalEnd}
              isCellular={isCellular}
              maxBitRate={maxBitRate}
              viewerAvatarUri={viewerAvatarUri}
              onRemoveFromFeed={removeReelFromFeed}
            />
          );
        }}
      />

      <Modal visible={sessionGateOpen} transparent animationType="fade" onRequestClose={() => setSessionGateOpen(false)}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: 28}}>
          <View style={{backgroundColor: palette.surface, borderRadius: 16, padding: 22, gap: 14}}>
            <Text style={{color: palette.foreground, fontSize: 17, fontWeight: '800', textAlign: 'center'}}>
              Take a break?
            </Text>
            <Text style={{color: palette.foregroundMuted, fontSize: 14, textAlign: 'center', lineHeight: 20}}>
              You have finished 5 reels. Refresh the feed or keep scrolling.
            </Text>
            <Pressable
              onPress={() => {
                sessionCompletesRef.current = 0;
                setSessionGateOpen(false);
                setLoading(true);
                loadReels(true).finally(() => setLoading(false));
              }}
              style={{
                backgroundColor: palette.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 15}}>Refresh</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                sessionCompletesRef.current = 0;
                setSessionGateOpen(false);
              }}
              style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedSafeScreen>
  );
}
