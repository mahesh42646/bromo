import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {EditMetaLayers} from '../components/media/EditMetaLayers';
import {OriginalSoundAudioLayer} from '../components/media/OriginalSoundAudioLayer';
import {PostVideoWithClientMeta} from '../components/media/PostVideoWithClientMeta';
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
  ShoppingBag,
  Info,
  CheckCircle2,
  XCircle,
  Flag,
  SlidersHorizontal,
  Sparkles,
  BarChart2,
  Megaphone,
  Pencil,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NavigationProp, RouteProp} from '@react-navigation/native';
import type {MainTabParamList} from '../navigation/appStackParamList';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {CoinEarnToast} from '../components/ui/CoinEarnToast';
import {Screen, SegmentedTabs} from '../components/ui';
import {ActionSheet} from '../components/ui/ActionSheet';
import {ThemedConfirmModal} from '../components/ui/ThemedConfirmModal';
import {addViewCoinListener} from '../lib/viewRewardEvents';
import {parentNavigate} from '../navigation/parentNavigate';
import {blockUser, followUser, unfollowUser} from '../api/followApi';
import {followSourceForContext} from '../lib/followSource';
import {
  getPost,
  getReels,
  getReelsInitial,
  getReelsNext,
  toggleLike,
  recordView,
  recordShare,
  recordStoreClick,
  resolveVideoUrl,
  resolveAttachedOriginalSoundUri,
  toggleSavePost,
  sendReelFeedback,
  fetchPostWhy,
  reportPostStrict,
  votePostPoll,
  deletePost,
  type Post,
} from '../api/postsApi';
import {fetchAds, prefetchAdMedia, type Ad} from '../api/adsApi';
import {hashString, pickAdSlots} from '../lib/adSlots';
import {AdReelItem} from '../components/AdReelItem';
import {socketService} from '../services/socketService';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {usePlaybackNetworkCap} from '../lib/usePlaybackNetworkCap';
import {perfMark, perfMeasure, trackPerfEvent} from '../lib/perfTelemetry';
import {peekReelFeedCache, saveReelFeedCache} from '../lib/reelFeedCache';
import {getCachedPost, mergePostsWithSessionCache, prefetchPostThumbnails} from '../lib/postEntityCache';
import {getAuthorMerge, rememberAuthor} from '../lib/authorSessionCache';
import {perfFlags} from '../config/perfFlags';
import type {ThemePalette} from '../theme/tokens';
import {usePlaybackMute} from '../context/PlaybackMuteContext';
import {openExternalUrl} from '../lib/openExternalUrl';

function enrichReelChunk(posts: Post[]): Post[] {
  const merged = mergePostsWithSessionCache(posts);
  const withAuthors = merged.map(p => ({
    ...p,
    author: p.author ? getAuthorMerge(p.author) : p.author,
  }));
  for (const p of withAuthors) {
    if (p.author) rememberAuthor(p.author);
  }
  prefetchPostThumbnails(withAuthors);
  return withAuthors;
}

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
  onReelDeleted,
  isOwnReel,
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
  onReelDeleted?: (postId: string) => void;
  isOwnReel: boolean;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<{title: string; message: string} | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const groupStyle = {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden' as const,
  };

  const submitReport = useCallback(
    (reason: Parameters<typeof reportPostStrict>[1]) => {
      if (!reel) return;
      reportPostStrict(reel._id, reason)
        .then(() => {
          setReportOpen(false);
          setInfoModal({
            title: 'Reported',
            message: 'Thanks — our team will review it.',
          });
        })
        .catch(e =>
          setInfoModal({
            title: 'Report',
            message: e instanceof Error ? e.message : 'Try again.',
          }),
        );
    },
    [reel],
  );

  return (
    <>
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
                    setInfoModal({
                      title: saved ? 'Saved' : 'Removed',
                      message: saved
                        ? 'Added to your saved posts.'
                        : 'Removed from saved.',
                    });
                  })
                  .catch(e =>
                    setInfoModal({
                      title: 'Save',
                      message: e instanceof Error ? e.message : 'Try again.',
                    }),
                  );
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
            {isOwnReel && reel ? (
              <View
                style={[
                  groupStyle,
                  {
                    backgroundColor: palette.background,
                    borderColor: palette.border,
                    marginHorizontal: 12,
                    marginBottom: 10,
                    paddingVertical: 6,
                  },
                ]}>
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
                    parentNavigate(navigation, 'ContentInsights', {focusPostId: reel._id});
                  }}>
                  <BarChart2 size={20} color={palette.primary} />
                  <Text style={{color: palette.primary, fontSize: 15, fontWeight: '600', marginLeft: 8}}>View insights</Text>
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
                    parentNavigate(navigation, 'PromoteCampaign', {
                      contentId: reel._id,
                      contentType: 'reel',
                    });
                  }}>
                  <Megaphone size={20} color={palette.accent} />
                  <Text style={{color: palette.accent, fontSize: 15, fontWeight: '600', marginLeft: 8}}>Promote reel</Text>
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
                    parentNavigate(navigation, 'CreateFlow', {editPostId: reel._id});
                  }}>
                  <Pencil size={20} color={palette.foreground} />
                  <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '600', marginLeft: 8}}>Edit reel</Text>
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
                    setDeleteConfirmOpen(true);
                  }}>
                  <Trash2 size={20} color={palette.destructive} />
                  <Text style={{color: palette.destructive, fontSize: 15, fontWeight: '600', marginLeft: 8}}>Delete reel</Text>
                </Pressable>
              </View>
            ) : null}
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
                  onClose();
                  parentNavigate(navigation, 'CreateFlow', {
                    mode: 'story',
                    bootstrapTs: Date.now(),
                    remixSourcePostId: reel._id,
                  });
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
                      setInfoModal({
                        title: 'Thanks',
                        message: "We'll show you more reels like this.",
                      });
                    })
                    .catch(e =>
                      setInfoModal({
                        title: 'Feedback',
                        message: e instanceof Error ? e.message : 'Try again.',
                      }),
                    );
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
                      setInfoModal({
                        title: 'Updated',
                        message: "We won't push similar reels as hard in your feed.",
                      });
                    })
                    .catch(e =>
                      setInfoModal({
                        title: 'Feedback',
                        message: e instanceof Error ? e.message : 'Try again.',
                      }),
                    );
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
                  onClose();
                  setReportOpen(true);
                }}>
                <Flag size={20} color={palette.destructive} />
                <Text style={{color: palette.destructive, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Report</Text>
              </Pressable>

              {!isOwnReel ? (
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
                    onClose();
                    setBlockConfirmOpen(true);
                  }}>
                  <X size={20} color={palette.destructive} />
                  <Text style={{color: palette.destructive, fontSize: 15, fontWeight: '500', marginLeft: 8}}>Block account</Text>
                </Pressable>
              ) : null}

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
                      setInfoModal({
                        title: "Why you're seeing this",
                        message: why.lines.join('\n\n'),
                      });
                    })
                    .catch(e =>
                      setInfoModal({
                        title: 'Why this reel',
                        message: e instanceof Error ? e.message : 'Try again.',
                      }),
                    );
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

    <ThemedConfirmModal
      visible={deleteConfirmOpen}
      title="Delete?"
      message={"Are you sure you want to delete? This can't be undone."}
      cancelLabel="Cancel"
      onCancel={() => setDeleteConfirmOpen(false)}
      confirmLabel="Delete"
      destructiveConfirm
      onConfirm={() => {
        if (!reel) return;
        setDeleteConfirmOpen(false);
        deletePost(reel._id)
          .then(() => {
            onReelDeleted?.(reel._id);
          })
          .catch(e =>
            setInfoModal({
              title: 'Delete failed',
              message: e instanceof Error ? e.message : 'Try again.',
            }),
          );
      }}
    />
    <ThemedConfirmModal
      visible={blockConfirmOpen}
      title="Block account?"
      message={
        reel?.author.username
          ? `Hide all reels from @${reel.author.username}?`
          : 'Hide all reels from this account?'
      }
      cancelLabel="Cancel"
      onCancel={() => setBlockConfirmOpen(false)}
      confirmLabel="Block"
      destructiveConfirm
      onConfirm={() => {
        if (!reel) return;
        setBlockConfirmOpen(false);
        blockUser(reel.author._id)
          .then(() => {
            onRemoveFromFeed(reel._id);
          })
          .catch(e =>
            setInfoModal({
              title: 'Block failed',
              message: e instanceof Error ? e.message : 'Try again.',
            }),
          );
      }}
    />
    <ThemedConfirmModal
      visible={infoModal != null}
      title={infoModal?.title ?? ''}
      message={infoModal?.message ?? ''}
      onConfirm={() => setInfoModal(null)}
    />
    <ActionSheet
      visible={reportOpen}
      title="Report"
      message="What is wrong with this reel?"
      onCancel={() => setReportOpen(false)}
      options={[
        {label: 'Spam', onPress: () => submitReport('spam')},
        {label: 'Harassment', onPress: () => submitReport('harassment')},
        {label: 'Nudity / sexual', onPress: () => submitReport('nudity')},
        {label: 'Copied/Stolen song', onPress: () => submitReport('copied_stolen_song')},
        {label: 'Irrelevant/Spam content', onPress: () => submitReport('irrelevant_spam_content')},
        {label: 'Other', onPress: () => submitReport('other')},
      ]}
    />
    </>
  );
}

const ReelItem = React.memo(function ReelItem({
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
  onReelDeleted,
  onFirstFrame,
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
  onReelDeleted: (postId: string) => void;
  onFirstFrame: (postId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const {palette, guidelines} = useTheme();
  const {dbUser} = useAuth();
  const {reelsMuted, toggleReelsMuted} = usePlaybackMute();
  const [holdPaused, setHoldPaused] = useState(false);
  const [following, setFollowing] = useState(item.isFollowing);
  const [coverSpinner, setCoverSpinner] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pollBusy, setPollBusy] = useState(false);
  const [reelPoll, setReelPoll] = useState(item.poll);
  const viewRecorded = useRef(false);
  const watchStartMs = useRef(0);
  const accumulatedWatchMs = useRef(0);
  const impressionDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = useRef(0);
  const lastProgTick = useRef(0);
  const clearedSpinnerOnProgress = useRef(false);
  /** One completion signal per reel (avoids counting every loop when repeat is on). */
  const naturalEndSentRef = useRef(false);
  const {borderRadiusScale} = guidelines;
  const avatarUri = item.author.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author.displayName)}&background=random`;

  useEffect(() => {
    setCoverSpinner(true);
    setProgress(0);
    setReelPoll(item.poll);
    durationRef.current = 0;
    clearedSpinnerOnProgress.current = false;
    naturalEndSentRef.current = false;
    if (impressionDelayRef.current) {
      clearTimeout(impressionDelayRef.current);
      impressionDelayRef.current = null;
    }
  }, [item._id, item.mediaUrl, item.poll]);

  useEffect(() => {
    if (!isActive) setHoldPaused(false);
  }, [isActive]);

  useEffect(() => {
    setFollowing(item.isFollowing);
  }, [item.isFollowing]);

  const paused = !isActive || holdPaused;

  // Impression after short dwell (skip flick-scroll); watch time batched client-side.
  useEffect(() => {
    if (isActive) {
      if (!viewRecorded.current) {
        if (impressionDelayRef.current) clearTimeout(impressionDelayRef.current);
        impressionDelayRef.current = setTimeout(() => {
          impressionDelayRef.current = null;
          if (!viewRecorded.current) {
            viewRecorded.current = true;
            watchStartMs.current = Date.now();
            recordView(item._id, 0);
          }
        }, 400);
      } else {
        watchStartMs.current = Date.now();
      }
    } else {
      if (impressionDelayRef.current) {
        clearTimeout(impressionDelayRef.current);
        impressionDelayRef.current = null;
      }
      if (watchStartMs.current > 0) {
        accumulatedWatchMs.current += Date.now() - watchStartMs.current;
        watchStartMs.current = 0;
      }
      if (accumulatedWatchMs.current > 500) {
        recordView(item._id, accumulatedWatchMs.current);
        accumulatedWatchMs.current = 0;
        viewRecorded.current = false;
      }
    }
    return () => {
      if (impressionDelayRef.current) {
        clearTimeout(impressionDelayRef.current);
        impressionDelayRef.current = null;
      }
    };
  }, [isActive, item._id]);

  const handleFollowToggle = async () => {
    try {
      if (following) {
        await unfollowUser(item.author._id);
        setFollowing(false);
      } else {
        await followUser(
          item.author._id,
          followSourceForContext({surface: 'reels', postId: item._id}),
        );
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
  const attachedReelSound = resolveAttachedOriginalSoundUri(item);
  const isHls = rawVideoUrl.endsWith('.m3u8');
  const videoContext = isHls ? 'reel-hls' : 'reel';

  const hideCoverSpinner = useCallback(() => {
    setCoverSpinner(false);
    onFirstFrame(item._id);
  }, [item._id, onFirstFrame]);

  return (
    <View style={{width: reelWidth, height: reelHeight, position: 'relative', backgroundColor: '#000'}}>
      {item.mediaType === 'video' ? (
        <PostVideoWithClientMeta
          key={item._id}
          post={item}
          context={videoContext}
          uri={playUri}
          fallbackUri={isHls ? resolveMediaUrl(item.mediaUrl) ?? undefined : undefined}
          maxBitRate={isHls ? maxBitRate : undefined}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
          repeat={!autoScroll}
          paused={paused}
          muted={reelsMuted}
          ignoreSilentSwitch="ignore"
          preventsDisplaySleepDuringVideoPlayback
          posterOverlayUntilReady={false}
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
        <>
          <Image
            source={{uri: thumbUri}}
            style={{width: '100%', height: '100%', position: 'absolute'}}
            resizeMode="cover"
          />
          <EditMetaLayers clientEditMeta={item.clientEditMeta} />
          {attachedReelSound ? (
            <OriginalSoundAudioLayer
              uri={attachedReelSound}
              muted={reelsMuted}
              paused={paused || !isActive}
              repeat={!autoScroll}
            />
          ) : null}
        </>
      )}

      {/* Spinner: pre-playing reels clear coverSpinner before becoming active, so no flash */}
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

      <Pressable
        onPress={toggleReelsMuted}
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.45)',
          zIndex: 12,
        }}>
        {reelsMuted ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
      </Pressable>

      {/* Swipe owns the full-screen gesture; mute is handled by the top-right button. */}
      <Pressable
        style={{...StyleSheet.absoluteFillObject, zIndex: 1}}
        pointerEvents="none"
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

        {item.showStoreIcon ? (
          <Pressable
            onPress={() => {
              void recordStoreClick(item._id);
              const url =
                item.storeEntryUrl?.trim() ||
                item.author.connectedStore?.productCatalogUrl?.trim() ||
                item.author.connectedStore?.website?.trim();
              if (url) void openExternalUrl(url);
            }}
            style={{alignItems: 'center', gap: 4}}>
            <ShoppingBag size={28} color="#fff" strokeWidth={2} />
            <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}}>Store</Text>
          </Pressable>
        ) : null}

        {/* Audio tile — static cover (no spin) */}

        <Pressable
          onPress={() =>
            parentNavigate(navigation, 'CreateFlow', {
              mode: 'reel',
              bootstrapTs: Date.now(),
              remixSourcePostId: item._id,
            })
          }>
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
          {item.author.isVerified || item.author.verificationStatus === 'verified' ? (
            <BadgeCheck size={16} color={palette.accent} fill={palette.accent} strokeWidth={2} />
          ) : null}
          {!isOwnReel ? (
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
          ) : null}
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
        {reelPoll?.options?.length ? (
          <View style={{marginTop: 8, gap: 6}}>
            {reelPoll.question ? (
              <Text style={{color: '#fff', fontSize: 12, fontWeight: '800'}} numberOfLines={1}>
                {reelPoll.question}
              </Text>
            ) : null}
            {reelPoll.options.map((opt, idx) => {
              const total = reelPoll?.votes?.reduce((s, v) => s + Number(v || 0), 0) ?? 0;
              const count = Number(reelPoll?.votes?.[idx] ?? 0);
              return (
                <Pressable
                  key={`${item._id}_poll_${idx}`}
                  disabled={pollBusy}
                  onPress={async () => {
                    try {
                      setPollBusy(true);
                      const out = await votePostPoll(item._id, idx);
                      setReelPoll(out.poll);
                    } catch {
                      /* ignore */
                    } finally {
                      setPollBusy(false);
                    }
                  }}
                  style={{
                    borderRadius: 8,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(255,255,255,0.32)',
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}>
                  <Text style={{color: '#fff', fontSize: 12, fontWeight: '700'}} numberOfLines={1}>
                    {opt}
                  </Text>
                  <Text style={{color: 'rgba(255,255,255,0.82)', fontSize: 10}}>
                    {count} votes
                    {total > 0 ? ` • ${Math.round((count / total) * 100)}%` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {item.music ? (
          <Pressable
            onPress={() => {
              if (item.originalAudioId) {
                parentNavigate(navigation, 'AudioDetail', {audioId: item.originalAudioId});
              }
            }}
            disabled={!item.originalAudioId}
            style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, opacity: item.originalAudioId ? 1 : 0.85}}
            hitSlop={6}>
            <Music2 size={12} color="#fff" strokeWidth={2} />
            <Text style={{color: '#fff', fontSize: 11, fontWeight: '600'}} numberOfLines={1}>
              {item.music}
            </Text>
          </Pressable>
        ) : null}
        {item.remixCredit?.username ? (
          <Text style={{color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700'}} numberOfLines={1}>
            Remix with @{item.remixCredit.username}
          </Text>
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
        onReelDeleted={onReelDeleted}
        isOwnReel={isOwnReel}
      />
    </View>
  );
});

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [coinToast, setCoinToast] = useState<{visible: boolean; amount: number}>({visible: false, amount: 0});
  const listRef = useRef<FlatList>(null);
  const pageRef = useRef(1);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const reelsInitialLoadDoneRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const activeIndexRef = useRef(0);
  const displayReelsLenRef = useRef(0);
  const firstResponseSentRef = useRef(false);
  const reelHeightRef = useRef(reelHeight);

  const displayReels = useMemo((): ReelFeedItem[] => {
    const basePosts = feedTab === 'friends' ? reels.filter(r => r.isFollowing) : reels;
    const items: ReelFeedItem[] = basePosts.map(p => ({_itemType: 'reel', data: p, _id: p._id}));
    if (reelAds.length === 0 || items.length === 0) return items;
    const seed = hashString(
      `${feedTab}\0${basePosts.map(p => p._id).join(',')}\0${reelAds.map(a => a._id).join(',')}`,
    );
    const slots = pickAdSlots(items.length, reelAds.length, seed, 2);
    for (let k = slots.length - 1; k >= 0; k--) {
      const ad = reelAds[k]!;
      items.splice(slots[k]! + 1, 0, {_itemType: 'ad', data: ad, _id: `ad_${ad._id}`});
    }
    return items;
  }, [feedTab, reels, reelAds]);

  useEffect(() => {
    if (reelAds.length > 0) prefetchAdMedia(reelAds);
  }, [reelAds]);

  useEffect(() => {
    return addViewCoinListener(n => {
      setCoinToast({visible: true, amount: n});
    });
  }, []);

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
    const cached = getCachedPost(initialPostId);
    if (cached?.type === 'reel') {
      const [h] = enrichReelChunk([cached]);
      setReels(prev => (prev.some(r => r._id === h._id) ? prev : [h, ...prev]));
      return;
    }
    getPost(initialPostId)
      .then(({post}) => {
        if (post.type !== 'reel') return;
        const [h] = enrichReelChunk([post]);
        setReels(prev => (prev.some(r => r._id === h._id) ? prev : [h, ...prev]));
      })
      .catch(() => null);
  }, [initialPostId, authReady]);

  const onReelNaturalEnd = useCallback(() => {
    sessionCompletesRef.current += 1;
    if (sessionCompletesRef.current >= 5) {
      setSessionGateOpen(true);
    }
  }, []);

  const onReelFirstFrame = useCallback((postId: string) => {
    const ms = perfMeasure(`reels_first_frame_${postId}`, 'app_open_reels');
    void trackPerfEvent('reels_first_frame', {postId, durationMs: ms ?? undefined});
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
    if (reset) {
      reelsInitialLoadDoneRef.current = false;
    }
    try {
      const [res, adsRes] = await Promise.all([
        reset
          ? (perfFlags.cursorApiV2 ? getReelsInitial() : getReels(1).then(r => ({posts: r.posts, hasMore: r.hasMore, nextCursor: null})))
          : cursorRef.current
            ? getReelsNext(cursorRef.current)
            : perfFlags.cursorApiV2
              ? {posts: [] as Post[], hasMore: false, nextCursor: null}
              : getReels(pageRef.current).then(r => ({posts: r.posts, hasMore: r.hasMore, nextCursor: null})),
        reset ? fetchAds('reels', 3) : Promise.resolve(null),
      ]);
      if (reset) {
        const hydrated = enrichReelChunk(res.posts);
        setReels(hydrated);
        void saveReelFeedCache(hydrated);
        if (!firstResponseSentRef.current) {
          firstResponseSentRef.current = true;
          const ms = perfMeasure('reels_first_feed_response_ms', 'app_open_reels');
          void trackPerfEvent('reels_first_feed_response', {durationMs: ms, items: hydrated.length});
        }
        if (adsRes) {
          setTimeout(() => setReelAds(adsRes), 250);
        }
        pageRef.current = 2;
        cursorRef.current = res.nextCursor;
      } else {
        const more = enrichReelChunk(res.posts);
        setReels(prev => {
          // Unload reels more than 10 positions behind current to save memory
          const combined = [...prev, ...more];
          return combined;
        });
        pageRef.current += 1;
        cursorRef.current = res.nextCursor;
      }
      hasMoreRef.current = res.hasMore;
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
    } finally {
      reelsInitialLoadDoneRef.current = true;
    }
  }, []);

  // Paint cached reels instantly before auth round-trip.
  useEffect(() => {
    peekReelFeedCache()
      .then(b => {
        if (b && b.posts.length > 0) {
          setReels(prev => (prev.length > 0 ? prev : b.posts));
          setLoading(false);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    perfMark('app_open_reels');
    if (!authReady) return;
    if (reels.length === 0) setLoading(true);
    loadReels(true).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

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
      const [hydrated] = enrichReelChunk([enriched]);
      setReels(prev => {
        if (prev.some(r => r._id === hydrated._id)) return prev;
        return [hydrated, ...prev];
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
    const unsubShare = socketService.on('post:share', ({postId, sharesCount}) => {
      setReels(prev => prev.map(r => (r._id === postId ? {...r, sharesCount} : r)));
    });
    return () => {
      unsubNew();
      unsubLike();
      unsubDelete();
      unsubComment();
      unsubShare();
    };
  }, [dbUser?._id]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'bromo:followChanged',
      ({userId, following}: {userId: string; following: boolean}) => {
        setReels(prev =>
          prev.map(r =>
            String(r.author._id) === String(userId) ? {...r, isFollowing: following} : r,
          ),
        );
      },
    );
    const blockSub = DeviceEventEmitter.addListener(
      'bromo:userBlocked',
      ({userId}: {userId: string}) => {
        setReels(prev => prev.filter(r => String(r.author._id) !== String(userId)));
      },
    );
    return () => {
      sub.remove();
      blockSub.remove();
    };
  }, []);

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
    if (!reelsInitialLoadDoneRef.current) return;
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

  if (loading && reels.length === 0) {
    return (
      <Screen bare edges={['top', 'left', 'right']} safeAreaStyle={{backgroundColor: '#000'}}>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen bare edges={['top', 'left', 'right']} safeAreaStyle={{backgroundColor: '#000'}}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
        }}
        pointerEvents="box-none">
        <SegmentedTabs
          items={[
            {label: 'Reels', value: 'forYou'},
            {label: 'Friends', value: 'friends'},
          ]}
          value={feedTab}
          onChange={setFeedTab}
          variant="underline"
          tone="onDark"
          rowMaxHeight={42}
        />
      </View>

      <FlatList
        ref={listRef}
        style={{flex: 1}}
        data={displayReels}
        keyExtractor={item => item._id}
        pagingEnabled
        snapToInterval={reelHeight > 0 ? reelHeight : undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        scrollEventThrottle={16}
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
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={2}
        removeClippedSubviews={true}
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
              onReelDeleted={removeReelFromFeed}
              onFirstFrame={onReelFirstFrame}
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
      <CoinEarnToast
        visible={coinToast.visible}
        amount={coinToast.amount}
        label="Bromo coins"
        onHide={() => setCoinToast(c => ({...c, visible: false}))}
      />
    </Screen>
  );
}
