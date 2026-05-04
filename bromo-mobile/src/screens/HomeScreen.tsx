import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ViewabilityConfig,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {followSourceForContext} from '../lib/followSource';
import { EditMetaLayers } from '../components/media/EditMetaLayers';
import { PostVideoWithClientMeta } from '../components/media/PostVideoWithClientMeta';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  BadgeCheck,
  Bookmark,
  Bell,
  Eye,
  EyeOff,
  Flag,
  Flame,
  Heart,
  Home,
  Landmark,
  Laptop,
  MessageCircle,
  MoreHorizontal,
  Music2,
  MapPin,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  ShoppingBag,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
  BarChart2,
  Megaphone,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import type { NavigationProp } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ThemedText } from '../components/ui/ThemedText';
import { StoryRing } from '../components/ui/StoryRing';
import { SearchBar } from '../components/ui/SearchBar';
import { Card } from '../components/ui/Card';
import { RefreshableFlatList, Screen, SegmentedTabs } from '../components/ui';
import { parentNavigate } from '../navigation/parentNavigate';
import { postPreviewPlayUri, postThumbnailUri } from '../lib/postMediaDisplay';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';
import {
  getFeed,
  getFeedInitial,
  getFeedNext,
  getReelsInitial,
  getTrendingReels,
  toggleLike,
  toggleSavePost,
  hidePost,
  reportPost,
  recordView,
  recordShare,
  recordStoreClick,
  resolveVideoUrl,
  deletePost,
  votePostPoll,
  type Post,
  type StoryGroup,
} from '../api/postsApi';
import { getActiveLiveStreams, type ActiveLiveStream } from '../api/liveApi';
import { mergePostsWithSessionCache, prefetchPostThumbnails } from '../lib/postEntityCache';
import { getAuthorMerge, rememberAuthor } from '../lib/authorSessionCache';
import { logPromotionDelivery } from '../api/promotionsApi';
import { fetchAds, prefetchAdMedia, type Ad } from '../api/adsApi';
import { hashString, pickAdSlots } from '../lib/adSlots';
import { AdCard } from '../components/AdCard';
import { AdStoryViewer } from '../components/AdStoryViewer';
import { clearStoriesFeedCache, loadStoriesFeed, loadStoriesFeedDeduped, peekStoriesFromCache } from '../lib/storiesFeedCache';
import { peekHomeFeedCache, saveHomeFeedCache } from '../lib/homeFeedCache';
import { saveReelFeedCache } from '../lib/reelFeedCache';
import { blockUser, getUserSuggestions, followUser, unfollowUser, type SuggestedUser } from '../api/followApi';
import { getUnreadCount } from '../api/notificationsApi';
import { getConversations } from '../api/chatApi';
import { socketService } from '../services/socketService';
import { usePlaybackMute } from '../context/PlaybackMuteContext';
import { usePlaybackNetworkCap } from '../lib/usePlaybackNetworkCap';
import { openExternalUrl } from '../lib/openExternalUrl';
import { perfMark, perfMeasure, trackPerfEvent } from '../lib/perfTelemetry';
import { perfFlags } from '../config/perfFlags';
import {
  favoriteStore,
  listStores,
  type Store as BromoStore,
  unfavoriteStore,
} from '../api/storeApi';
import { StoreDiscoverHomeCard } from '../components/store/StoreDiscoverHomeCard';

type IconComp = ComponentType<{ size?: number; color?: string }>;

const MIN_TRENDING_REELS = 3;
const MAX_TRENDING_REELS = 5;
const MAX_TOP_VISITED_STORES = 5;

const CATEGORIES: { id: string; label: string; Icon: IconComp }[] = [
  { id: 'home', label: 'For You', Icon: Home },
  { id: 'trending', label: 'Trending', Icon: Flame },
  { id: 'politics', label: 'Politics', Icon: Landmark },
  { id: 'sports', label: 'Sports', Icon: Trophy },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingBag },
  { id: 'tech', label: 'Tech', Icon: Laptop },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function dedupePostsById(posts: Post[]): Post[] {
  const m = new Map<string, Post>();
  for (const p of posts) {
    if (!m.has(p._id)) m.set(p._id, p);
  }
  return [...m.values()];
}

function postDisplayAspectRatio(post: Post): number {
  const raw = post.carouselItems?.[0]?.aspectRatio;
  const fallback = post.type === 'reel' ? 9 / 16 : 1;
  const n = Number(raw || fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(0.42, Math.min(2.2, n));
}

function feedCategoryLabel(category?: string): string {
  const value = (category || 'general').replace(/-/g, ' ').trim();
  if (!value) return 'General';
  return value.replace(/\b\w/g, c => c.toUpperCase());
}

function enrichFeedChunk(posts: Post[]): Post[] {
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function clampTrendingReels(reels: Post[]): Post[] {
  const unique = dedupePostsById(reels.filter(reel => reel.type === 'reel'));
  if (unique.length <= MAX_TRENDING_REELS) return unique;
  return unique.slice(0, MAX_TRENDING_REELS);
}

function HeaderBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -6,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ef4444',
        borderWidth: 1,
        borderColor: '#ffffff',
      }}>
      <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => { navigate: (name: string, params?: object) => void } | undefined;
};

import { Modal } from 'react-native';

type PostCardProps = {
  post: Post;
  onLikeToggle: (postId: string) => void;
  onHide: (postId: string) => void;
  onPostDeleted: (postId: string) => void;
  onCategoryPress: (category: string) => void;
  navigation: Nav;
  isVideoVisible?: boolean;
  isFeedItemVisible?: boolean;
};

const PostCard = React.memo(function PostCard({
  post,
  onLikeToggle,
  onHide,
  onPostDeleted,
  onCategoryPress,
  navigation,
  isVideoVisible = false,
  isFeedItemVisible = false,
}: PostCardProps) {
  const { palette, guidelines } = useTheme();
  const { dbUser } = useAuth();
  const { width: windowW } = useWindowDimensions();
  const { homeFeedMuted, toggleHomeFeedMuted } = usePlaybackMute();
  const { isCellular, maxBitRate } = usePlaybackNetworkCap();
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(post.isFollowing);
  const [videoEnded, setVideoEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [pollBusy, setPollBusy] = useState(false);
  const [pollLocal, setPollLocal] = useState<Post['poll'] | undefined>(undefined);
  const viewRecordedRef = useRef(false);
  const viewImpressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promoImpressionLoggedRef = useRef(false);
  const { borderRadiusScale } = guidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const handleFollow = async () => {
    try {
      if (following) {
        await unfollowUser(post.author._id);
        setFollowing(false);
      } else {
        await followUser(
          post.author._id,
          followSourceForContext({surface: 'home_feed', postId: post._id}),
        );
        setFollowing(true);
      }
    } catch { }
    setMenuOpen(false);
  };

  const handleHide = async () => {
    setMenuOpen(false);
    hidePost(post._id);
    onHide(post._id);
  };

  const handleSave = async () => {
    try {
      const out = await toggleSavePost(post._id);
      setBookmarked(out.saved);
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
  };

  const handleReport = async () => {
    setMenuOpen(false);
    reportPost(post._id, 'inappropriate');
  };

  const handleBlock = async () => {
    setMenuOpen(false);
    Alert.alert('Block account?', `You will stop seeing @${post.author.username}'s content.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          blockUser(post.author._id)
            .then(() => onHide(post._id))
            .catch(e => Alert.alert('Block failed', e instanceof Error ? e.message : 'Try again.'));
        },
      },
    ]);
  };

  const avatarUri = post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`;

  useEffect(() => {
    if (!isFeedItemVisible) {
      if (viewImpressionTimerRef.current) {
        clearTimeout(viewImpressionTimerRef.current);
        viewImpressionTimerRef.current = null;
      }
      viewRecordedRef.current = false;
      return;
    }
    if (viewRecordedRef.current) return;
    if (viewImpressionTimerRef.current) clearTimeout(viewImpressionTimerRef.current);
    viewImpressionTimerRef.current = setTimeout(() => {
      viewImpressionTimerRef.current = null;
      if (!viewRecordedRef.current && isFeedItemVisible) {
        viewRecordedRef.current = true;
        recordView(post._id, 0).catch(() => null);
      }
    }, 450);
    return () => {
      if (viewImpressionTimerRef.current) {
        clearTimeout(viewImpressionTimerRef.current);
        viewImpressionTimerRef.current = null;
      }
    };
  }, [isFeedItemVisible, post._id]);

  useEffect(() => {
    if (!isFeedItemVisible || !post.isPromoted || !post.promotionId) {
      if (!isFeedItemVisible) promoImpressionLoggedRef.current = false;
      return;
    }
    if (promoImpressionLoggedRef.current) return;
    promoImpressionLoggedRef.current = true;
    void logPromotionDelivery(post.promotionId, {
      surface: 'feed',
      contentAuthorId: post.author._id,
      isFollowerOfAuthor: post.isFollowing,
      kind: 'impression',
    });
  }, [isFeedItemVisible, post.isPromoted, post.promotionId, post.author._id, post.isFollowing]);

  useEffect(() => {
    setVideoEnded(false);
  }, [post._id]);

  useEffect(() => {
    setFollowing(post.isFollowing);
  }, [post.isFollowing]);

  useEffect(() => {
    setPollLocal(undefined);
  }, [post._id]);

  const poll = pollLocal ?? post.poll;

  useEffect(() => {
    if (isVideoVisible && post.mediaType === 'video') {
      setVideoEnded(false);
    }
  }, [isVideoVisible, post.mediaType, post._id]);

  const rawVideoUrl = post.mediaType === 'video' ? resolveVideoUrl(post, isCellular) : '';
  const playUri = rawVideoUrl ? resolveMediaUrl(rawVideoUrl) || rawVideoUrl : '';
  const isHls = rawVideoUrl.endsWith('.m3u8');
  const thumbForVideo = postThumbnailUri(post) || playUri;
  const mediaAspect = postDisplayAspectRatio(post);
  const carouselItems = post.carouselItems?.length ? post.carouselItems : [];

  const openReelsAtThisPost = () => {
    parentNavigate(navigation, 'Reels', { initialPostId: post._id });
  };

  const isOwnPost = Boolean(dbUser?._id && String(post.author._id) === String(dbUser._id));
  const promoteContentType = post.type === 'reel' ? 'reel' as const : 'post' as const;

  const menuRows: Array<{
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
    onPress: () => void;
  }> = [
      ...(isOwnPost
        ? [
          {
            icon: <BarChart2 size={20} color={palette.primary} />,
            label: 'View insights',
            onPress: () => {
              setMenuOpen(false);
              parentNavigate(navigation, 'ContentInsights', { focusPostId: post._id });
            },
          },
          {
            icon: <Megaphone size={20} color={palette.accent} />,
            label: 'Boost post',
            onPress: () => {
              setMenuOpen(false);
              parentNavigate(navigation, 'PromoteCampaign', {
                contentId: post._id,
                contentType: promoteContentType,
              });
            },
          },
          {
            icon: <Pencil size={20} color={palette.foreground} />,
            label: 'Edit',
            onPress: () => {
              setMenuOpen(false);
              parentNavigate(navigation, 'CreateFlow', {editPostId: post._id});
            },
          },
          {
            icon: <Trash2 size={20} color={palette.destructive} />,
            label: 'Delete',
            danger: true,
            onPress: () => {
              setMenuOpen(false);
              Alert.alert(
                'Delete?',
                "Are you sure you want to delete? This can't be undone.",
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      deletePost(post._id)
                        .then(() => onPostDeleted(post._id))
                        .catch(e => Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again.'));
                    },
                  },
                ],
              );
            },
          },
        ]
        : []),
      ...(!isOwnPost
        ? [
          {
            icon: following ? <UserCheck size={20} color={palette.foreground} /> : <UserPlus size={20} color={palette.foreground} />,
            label: following ? 'Unfollow' : 'Follow',
            onPress: handleFollow,
          },
        ]
        : []),
      {
        icon: <User size={20} color={palette.foreground} />,
        label: 'View Profile',
        onPress: () => {
          setMenuOpen(false);
          parentNavigate(navigation, 'OtherUserProfile', { userId: post.author._id });
        },
      },
      {
        icon: <Send size={20} color={palette.foreground} />,
        label: 'Share Post',
        onPress: () => {
          setMenuOpen(false);
          void recordShare(post._id);
          parentNavigate(navigation, 'ShareSend', { postId: post._id });
        },
      },
      {
        icon: <Bookmark size={20} color={palette.foreground} />,
        label: 'Save',
        onPress: handleSave,
      },
      {
        icon: <EyeOff size={20} color={palette.foreground} />,
        label: 'Hide Post',
        onPress: handleHide,
      },
      ...(!isOwnPost
        ? [
          {
            icon: <Flag size={20} color={palette.destructive} />,
            label: 'Report',
            danger: true,
            onPress: handleReport,
          },
          {
            icon: <X size={20} color={palette.destructive} />,
            label: 'Block account',
            danger: true,
            onPress: handleBlock,
          },
        ]
        : []),
    ];

  return (
    <View style={{ borderBottomWidth: 8, borderBottomColor: palette.background, backgroundColor: palette.background }}>
      {/* 3-dot action sheet */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: palette.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
              paddingBottom: 28, paddingTop: 6,
            }}>
            <View style={{ alignItems: 'center', paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border }} />
            </View>
            {menuRows.map((item, idx) => (
            <View style={{  flexDirection: 'row', alignItems: 'center', gap: 14,
              paddingVertical: 14, paddingHorizontal: 18,
              }}>
                <Pressable
                key={`${item.label}-${idx}`}
                onPress={item.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {item.icon}
                <ThemedText variant="body" style={{ fontSize: 15, fontWeight: '500', color: item.danger ? palette.destructive : palette.foreground }}>
                  {item.label}
                </ThemedText>
              </Pressable>
            </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          onPress={() => parentNavigate(navigation, 'OtherUserProfile', { userId: post.author._id })}>
          <Image source={{ uri: avatarUri }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <ThemedText variant="label" style={{ fontSize: 13 }}>{post.author.displayName}</ThemedText>
              {(post.author.isVerified || post.author.verificationStatus === 'verified') && (
                <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
              )}
              {post.isPromoted ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: palette.surfaceHigh,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: palette.foregroundMuted }}>Promoted</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
              {post.location ? (
                <>
                  <MapPin size={9} color={palette.mutedForeground} />
                  <ThemedText variant="caption">{post.location} • {timeAgo(post.createdAt)}</ThemedText>
                </>
              ) : (
                <ThemedText variant="caption">{timeAgo(post.createdAt)}</ThemedText>
              )}
            </View>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {!isOwnPost && !following && (
            <Pressable
              onPress={handleFollow}
              style={{
                borderWidth: 1,
                borderColor: `${palette.primary}50`,
                borderRadius: radius,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}>
              <ThemedText variant="primary" style={{ fontSize: 11, fontWeight: '800' }}>Follow</ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
            <MoreHorizontal size={18} color={palette.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {post.caption ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          <ThemedText variant="body" style={{ fontSize: 13, lineHeight: 19 }}>{post.caption}</ThemedText>
        </View>
      ) : null}

      {poll?.options?.length ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8, gap: 8 }}>
          {poll.question ? (
            <ThemedText variant="label" style={{ fontSize: 13, fontWeight: '800' }}>
              {poll.question}
            </ThemedText>
          ) : null}
          {poll.options.map((opt, idx) => {
            const total = poll.votes?.reduce((s, v) => s + Number(v || 0), 0) ?? 0;
            const count = Number(poll.votes?.[idx] ?? 0);
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <Pressable
                key={`${post._id}_poll_${idx}`}
                disabled={pollBusy}
                onPress={async () => {
                  try {
                    setPollBusy(true);
                    const out = await votePostPoll(post._id, idx);
                    setPollLocal(out.poll);
                  } catch {
                    /* ignore */
                  } finally {
                    setPollBusy(false);
                  }
                }}
                style={{
                  borderRadius: 10,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: palette.border,
                  backgroundColor: palette.card,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}>
                <ThemedText variant="body" style={{ fontSize: 13, fontWeight: '700' }}>
                  {opt}
                </ThemedText>
                <ThemedText variant="caption" style={{ marginTop: 4 }}>
                  {count} votes ({pct}%)
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {post.feedCategory && post.feedCategory !== 'general' && post.feedCategory !== 'followers' ? (
        <View style={{paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
          <View style={{paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: palette.surfaceHigh}}>
            <Text style={{color: palette.foreground, fontSize: 11, fontWeight: '900'}}>
              {feedCategoryLabel(post.feedCategory)}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              onCategoryPress(post.feedCategory!);
            }}
            style={{paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: palette.primary}}>
            <Text style={{color: palette.primaryForeground, fontSize: 11, fontWeight: '900'}}>Read More</Text>
          </Pressable>
        </View>
      ) : null}

      {post.showStoreIcon ? (
        <View style={{paddingHorizontal: 14, paddingBottom: 10}}>
          <Pressable
            onPress={() => {
              void recordStoreClick(post._id);
              const url =
                post.storeEntryUrl?.trim() ||
                post.author.connectedStore?.productCatalogUrl?.trim() ||
                post.author.connectedStore?.website?.trim();
              if (url) void openExternalUrl(url);
            }}
            style={{alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.surfaceHigh, borderWidth: 1, borderColor: palette.border}}>
            <ShoppingBag size={14} color={palette.primary} />
            <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '900'}}>View Store</Text>
          </Pressable>
        </View>
      ) : null}

      {post.type === 'reel' ? (
        <Pressable onPress={openReelsAtThisPost}>
          {post.mediaType === 'video' ? (
            <View style={{ position: 'relative' }}>
              <PostVideoWithClientMeta
                key={`${post._id}-${replayKey}`}
                post={post}
                context={isHls ? 'feed-hls' : 'feed'}
                uri={playUri}
                fallbackUri={isHls ? resolveMediaUrl(post.mediaUrl) ?? undefined : undefined}
                posterUri={thumbForVideo || undefined}
                maxBitRate={isHls ? maxBitRate : undefined}
                style={{ width: '100%', aspectRatio: mediaAspect, backgroundColor: '#000' }}
                repeat={false}
                muted={homeFeedMuted}
                paused={!isVideoVisible || videoEnded}
                posterOverlayUntilReady
                onEnd={() => setVideoEnded(true)}
              />
              <Pressable
                onPress={e => {
                  e.stopPropagation();
                  toggleHomeFeedMuted();
                }}
                style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {homeFeedMuted ? <VolumeX size={14} color="#fff" /> : <Volume2 size={14} color="#fff" />}
              </Pressable>
              {videoEnded ? (
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}>
                  <Pressable
                    onPress={e => {
                      e.stopPropagation();
                      setVideoEnded(false);
                      setReplayKey(k => k + 1);
                    }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: palette.primary,
                    }}>
                    <Text style={{ color: palette.primaryForeground, fontWeight: '800', fontSize: 13 }}>Watch again</Text>
                  </Pressable>
                  <Pressable
                    onPress={e => {
                      e.stopPropagation();
                      openReelsAtThisPost();
                    }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#fff',
                    }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>View more</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ width: '100%', aspectRatio: mediaAspect, position: 'relative', backgroundColor: '#000' }}>
              <Image
                source={{ uri: resolveMediaUrl(post.mediaUrl) }}
                style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
              />
              <EditMetaLayers clientEditMeta={post.clientEditMeta} />
            </View>
          )}
        </Pressable>
      ) : (
        <View>
          {post.mediaType === 'video' ? (
            <View style={{ position: 'relative' }}>
              <PostVideoWithClientMeta
                key={`${post._id}-${replayKey}`}
                post={post}
                context={isHls ? 'feed-hls' : 'feed'}
                uri={playUri}
                fallbackUri={isHls ? resolveMediaUrl(post.mediaUrl) ?? undefined : undefined}
                posterUri={thumbForVideo || undefined}
                maxBitRate={isHls ? maxBitRate : undefined}
                style={{ width: '100%', aspectRatio: mediaAspect, backgroundColor: '#000' }}
                repeat={false}
                muted={homeFeedMuted}
                paused={!isVideoVisible || videoEnded}
                posterOverlayUntilReady
                onEnd={() => setVideoEnded(true)}
              />
              <Pressable
                onPress={() => toggleHomeFeedMuted()}
                style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {homeFeedMuted ? <VolumeX size={14} color="#fff" /> : <Volume2 size={14} color="#fff" />}
              </Pressable>
              {videoEnded ? (
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}>
                  <Pressable
                    onPress={() => {
                      setVideoEnded(false);
                      setReplayKey(k => k + 1);
                    }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: palette.primary,
                    }}>
                    <Text style={{ color: palette.primaryForeground, fontWeight: '800', fontSize: 13 }}>Watch again</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => parentNavigate(navigation, 'Reels')}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#fff',
                    }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>View more</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ width: '100%', aspectRatio: mediaAspect, position: 'relative', backgroundColor: '#000' }}>
              {carouselItems.length > 1 ? (
                <>
                  <FlatList
                    data={carouselItems}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, idx) => `${item.mediaUrl}_${idx}`}
                    onMomentumScrollEnd={e => {
                      setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, windowW)));
                    }}
                    renderItem={({item}) => (
                      <Image
                        source={{uri: resolveMediaUrl(item.mediaUrl)}}
                        style={{width: windowW, aspectRatio: mediaAspect, resizeMode: 'contain'}}
                      />
                    )}
                  />
                  <View style={{position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)'}}>
                    <Text style={{color: '#fff', fontSize: 11, fontWeight: '900'}}>
                      {carouselIndex + 1}/{carouselItems.length}
                    </Text>
                  </View>
                </>
              ) : (
                <Image
                  source={{ uri: resolveMediaUrl(post.mediaUrl) }}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                />
              )}
              <EditMetaLayers clientEditMeta={post.clientEditMeta} />
            </View>
          )}
        </View>
      )}

      {post.isPromoted && post.promotionId
        ? (() => {
          const cta = post.promotionCta;
          const hasCustomCta = Boolean(cta?.label?.trim() && cta?.url?.trim());
          const objective = post.promotionObjective;

          const logCta = () => {
            void logPromotionDelivery(post.promotionId!, {
              surface: 'feed',
              contentAuthorId: post.author._id,
              isFollowerOfAuthor: post.isFollowing,
              kind: 'cta_click',
            });
          };

          const promoBtnStyle = {
            marginHorizontal: 14,
            marginTop: 10,
            marginBottom: 4,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: palette.primary,
            alignItems: 'center' as const,
          };

          if (hasCustomCta) {
            return (
              <Pressable
                onPress={() => {
                  logCta();
                  void openExternalUrl(cta!.url);
                }}
                style={promoBtnStyle}>
                <Text style={{ color: palette.primaryForeground, fontWeight: '900', fontSize: 14 }}>
                  {cta!.label}
                </Text>
              </Pressable>
            );
          }

          if (isOwnPost) return null;

          if (objective === 'followers') {
            if (following) return null;
            return (
              <Pressable
                onPress={() => {
                  logCta();
                  void handleFollow();
                }}
                style={promoBtnStyle}>
                <Text style={{ color: palette.primaryForeground, fontWeight: '900', fontSize: 14 }}>Follow</Text>
              </Pressable>
            );
          }

          if (objective === 'engagement') {
            return (
              <Pressable
                onPress={() => {
                  logCta();
                  onLikeToggle(post._id);
                }}
                style={promoBtnStyle}>
                <Text style={{ color: palette.primaryForeground, fontWeight: '900', fontSize: 14 }}>
                  {post.isLiked ? 'Liked' : 'Like'}
                </Text>
              </Pressable>
            );
          }

          return null;
        })()
        : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
          <Pressable onPress={() => onLikeToggle(post._id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Heart
              size={24}
              color={post.isLiked ? palette.destructive : palette.foreground}
              fill={post.isLiked ? palette.destructive : 'transparent'}
            />
            <ThemedText variant="label">{formatCount(post.likesCount)}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => parentNavigate(navigation, 'Comments', { postId: post._id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MessageCircle size={24} color={palette.foreground} />
            <ThemedText variant="label">{formatCount(post.commentsCount)}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              void recordShare(post._id);
              parentNavigate(navigation, 'ShareSend', { postId: post._id });
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Send size={24} color={palette.foreground} />
            <ThemedText variant="label">{formatCount(post.sharesCount)}</ThemedText>
          </Pressable>
        </View>
        <Pressable onPress={handleSave}>
          <Bookmark
            size={24}
            color={bookmarked ? palette.primary : palette.foreground}
            fill={bookmarked ? palette.primary : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <Eye size={11} color={palette.mutedForeground} />
          <ThemedText variant="caption">{formatCount(post.viewsCount)} Views</ThemedText>
        </View>
        {post.music ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Music2 size={10} color={palette.mutedForeground} />
            <ThemedText variant="caption">{post.music}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
});

type SuggestionCardProps = {
  user: SuggestedUser;
  onFollowToggle: (userId: string, isFollowing: boolean) => void;
  navigation: Nav;
  palette: ReturnType<typeof useTheme>['palette'];
  borderRadiusScale: string;
};

function SuggestionCard({ user, onFollowToggle, navigation, palette, borderRadiusScale }: SuggestionCardProps) {
  const [following, setFollowing] = useState(false);

  const handleFollow = async () => {
    try {
      if (following) {
        await unfollowUser(user._id);
        setFollowing(false);
      } else {
        await followUser(user._id, followSourceForContext({surface: 'profile_suggestions'}));
        setFollowing(true);
      }
      onFollowToggle(user._id, !following);
    } catch { }
  };

  return (
    <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', { userId: user._id })}>
      <Card style={{ width: 160, padding: 14, alignItems: 'center' }}>
        <Image
          source={{ uri: user.profilePicture || `https://ui-avatars.com/api/?name=${user.displayName}` }}
          style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: palette.primary, marginBottom: 8 }}
        />
        <ThemedText variant="label" style={{ textAlign: 'center' }} numberOfLines={1}>{user.displayName}</ThemedText>
        <ThemedText variant="caption" style={{ textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
          @{user.username}
        </ThemedText>
        <ThemedText variant="caption" style={{ textAlign: 'center', marginTop: 2 }}>
          {formatCount(user.followersCount)} followers
        </ThemedText>
        <Pressable
          onPress={handleFollow}
          style={{
            marginTop: 10,
            backgroundColor: following ? 'transparent' : palette.primary,
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: borderRadiusScale === 'bold' ? 10 : 6,
            paddingVertical: 8,
            width: '100%',
            alignItems: 'center',
          }}>
          <Text style={{ color: following ? palette.primary : palette.primaryForeground, fontSize: 12, fontWeight: '800' }}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </Card>
    </Pressable>
  );
}

export function HomeScreen() {
  const { palette, guidelines, branding, isDark } = useTheme();
  const { dbUser, ready: authReady } = useAuth();
  const { setHomeFeedMuted } = usePlaybackMute();
  const navigation = useNavigation() as Nav;
  const tabBarHeight = useBottomTabBarHeight();
  const [activeCategory, setActiveCategory] = useState('home');
  const categoryChips = useMemo(() => {
    if (CATEGORIES.some(cat => cat.id === activeCategory)) return CATEGORIES;
    return [
      ...CATEGORIES,
      {id: activeCategory, label: feedCategoryLabel(activeCategory), Icon: Landmark},
    ];
  }, [activeCategory]);

  const categorySegmentItems = useMemo(() => {
    return categoryChips.map(cat => {
      const CatIcon = cat.Icon;
      const active = activeCategory === cat.id;
      return {
        value: cat.id,
        label: cat.label,
        icon: (
          <CatIcon
            size={15}
            color={active ? palette.primaryForeground : palette.foreground}
          />
        ),
      };
    });
  }, [activeCategory, categoryChips, palette.foreground, palette.primaryForeground]);

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const { borderRadiusScale } = guidelines;
  const brandIconUri = useMemo(
    () => resolveMediaUrl(branding.faviconUrl || branding.logoUrl),
    [branding.faviconUrl, branding.logoUrl],
  );

  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [feedAds, setFeedAds] = useState<Ad[]>([]);
  const [storyAds, setStoryAds] = useState<Ad[]>([]);
  const [activeStoryAd, setActiveStoryAd] = useState<Ad | null>(null);
  const [liveStreams, setLiveStreams] = useState<ActiveLiveStream[]>([]);

  const myStoryGroup = useMemo(
    () => (dbUser?._id ? storyGroups.find(g => g.author._id === dbUser._id) : undefined),
    [storyGroups, dbUser?._id],
  );

  const storyTrayEntries = useMemo(
    () =>
      storyGroups.map(group => {
        const firstUnseen = group.stories.find(s => !s.seenByMe);
        const preview = firstUnseen ?? group.stories[0];
        const ringUri =
          preview != null
            ? preview.mediaType === 'video'
              ? postPreviewPlayUri(preview)
              : preview.mediaUrl
            : group.author.profilePicture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(group.author.displayName)}`;
        const ringUriResolved = resolveMediaUrl(ringUri) || ringUri;
        const allSeen = group.stories.length > 0 && group.stories.every(s => s.seenByMe === true);
        return { group, ringUriResolved, allSeen };
      }),
    [storyGroups],
  );
  const myStoriesAllSeen =
    myStoryGroup && myStoryGroup.stories.length > 0
      ? myStoryGroup.stories.every(s => s.seenByMe === true)
      : false;
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [trendingReels, setTrendingReels] = useState<Post[]>([]);
  const [topVisitedStores, setTopVisitedStores] = useState<BromoStore[]>([]);
  const [likedStoreIds, setLikedStoreIds] = useState<Record<string, boolean>>({});
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const topicPageRef = useRef(1);
  const homeCursorRef = useRef<string | null>(null);
  /** Prevents onEndReached from firing /feed?page before the first /feed/initial completes (race = duplicate fetches + wrong state). */
  const homeFeedInitialDoneRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstNetworkResponseSentRef = useRef(false);
  const firstPaintSentRef = useRef(false);
  const activeCategoryRef = useRef(activeCategory);
  /** ID of the currently-visible video post (only this one autoplays). */
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  /** First mostly-visible feed post (for view counts on images + video). */
  const [visibleFeedPostId, setVisibleFeedPostId] = useState<string | null>(null);
  const [visibleAdId, setVisibleAdId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setHomeFeedMuted(true);
      return () => {
        // Pause all feed videos when leaving home screen (e.g. navigating to reels)
        setVisiblePostId(null);
        setVisibleFeedPostId(null);
      };
    }, [setHomeFeedMuted]),
  );

  const feedViewabilityConfig = useRef<ViewabilityConfig>({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 200,
  }).current;

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {
        setUserLat(null);
        setUserLng(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 20000 },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void getActiveLiveStreams().then(rows => {
        if (alive) setLiveStreams(rows);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  useEffect(() => {
    const t = setInterval(() => {
      void getActiveLiveStreams().then(setLiveStreams);
    }, 45000);
    return () => clearInterval(t);
  }, []);

  const onFeedViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = viewableItems.filter(
      vt => vt.isViewable && vt.item && typeof vt.item === 'object' && 'kind' in vt.item,
    );
    if (visible.length === 0) {
      setVisibleFeedPostId(null);
      setVisiblePostId(null);
      setVisibleAdId(null);
      return;
    }
    visible.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const row = visible[0]!.item as { kind: string; post?: Post; ad?: Ad };
    if (row.kind === 'post' && row.post) {
      setVisibleFeedPostId(row.post._id);
      setVisiblePostId(row.post.mediaType === 'video' ? row.post._id : null);
      setVisibleAdId(null);
    } else if (row.kind === 'ad' && row.ad) {
      setVisibleFeedPostId(null);
      setVisiblePostId(null);
      setVisibleAdId(row.ad._id);
    } else {
      setVisibleFeedPostId(null);
      setVisiblePostId(null);
      setVisibleAdId(null);
    }
  }).current;

  const loadData = useCallback(async (reset = false, retry = 0) => {
    const cat = activeCategory;
    const isHome = cat === 'home';

    if (reset && isHome) {
      homeCursorRef.current = null;
      homeFeedInitialDoneRef.current = false;
    }

    // Defer auxiliary fetches slightly so the feed payload owns first paint bandwidth.
    if (reset) {
      setTimeout(() => {
        loadStoriesFeedDeduped()
          .then(s => setStoryGroups(s))
          .catch(() => null);
        getUserSuggestions(6)
          .then(r => setSuggestions(r.users))
          .catch(() => null);
        fetchAds('feed', 5)
          .then(a => setFeedAds(a))
          .catch(() => null);
        fetchAds('stories', 2)
          .then(a => setStoryAds(a))
          .catch(() => null);
        if (isHome) {
          getTrendingReels(MAX_TRENDING_REELS)
            .then(r => setTrendingReels(clampTrendingReels(r?.posts ?? [])))
            .catch(() => setTrendingReels([]));
        } else {
          setTrendingReels([]);
        }
      }, 250);
    }

    try {
      if (isHome) {
        const res = reset
          ? perfFlags.cursorApiV2
            ? await getFeedInitial()
            : await getFeed({ tab: 'for-you' }).then(r => ({
              posts: r.posts,
              tab: 'for-you',
              cursor: r.nextCursorFriends ?? null,
              hasMore: Boolean(r.hasMoreFriends),
            }))
          : homeCursorRef.current
            ? await getFeedNext(homeCursorRef.current)
            : perfFlags.cursorApiV2
              ? { posts: [] as Post[], tab: 'for-you', cursor: null, hasMore: false }
              : await getFeed({ tab: 'for-you' }).then(r => ({
                posts: r.posts,
                tab: 'for-you',
                cursor: r.nextCursorFriends ?? null,
                hasMore: Boolean(r.hasMoreFriends),
              }));

        homeCursorRef.current = res.cursor ?? null;

        const mergedPosts = dedupePostsById(enrichFeedChunk(res.posts));
        if (reset) {
          setPosts(mergedPosts);
          if (!firstNetworkResponseSentRef.current) {
            firstNetworkResponseSentRef.current = true;
            const ms = perfMeasure('home_first_feed_response_ms', 'app_open_home');
            void trackPerfEvent('home_first_feed_response', { durationMs: ms });
          }
          // Only cache the default home tab — other tabs shouldn't leak into cold start.
          void saveHomeFeedCache('home', mergedPosts);
          if (perfFlags.cursorApiV2) {
            Promise.resolve().then(() =>
              getReelsInitial()
                .then(r => {
                  const chunk = dedupePostsById(mergePostsWithSessionCache(r.posts));
                  for (const p of chunk) {
                    if (p.author) rememberAuthor(p.author);
                  }
                  prefetchPostThumbnails(chunk.slice(0, 8));
                  void saveReelFeedCache(chunk);
                })
                .catch(() => null),
            );
          }
        } else {
          setPosts(prev => dedupePostsById([...prev, ...mergedPosts]));
        }

        setHasMore(Boolean(res.hasMore));
      } else {
        const tab = cat === 'trending' ? 'trending' : cat;
        if (reset) topicPageRef.current = 1;
        const p = topicPageRef.current;
        const res = await getFeed({ tab, page: p });
        const chunk = enrichFeedChunk(res.posts);
        if (reset) {
          setPosts(chunk);
          topicPageRef.current = 2;
        } else {
          setPosts(prev => [...prev, ...chunk]);
          topicPageRef.current += 1;
        }
        setHasMore(res.hasMore ?? false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /aborted|network request failed|timeout/i.test(msg);
      if (transient && retry < 1) {
        await loadData(reset, retry + 1);
        return;
      }
      if (!transient) {
        console.error('[HomeScreen] loadData error:', err);
      }
    } finally {
      if (isHome) {
        homeFeedInitialDoneRef.current = true;
      }
    }
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory !== 'home') return;
    if (userLat == null || userLng == null) {
      setTopVisitedStores([]);
      return;
    }

    listStores({
      sortBy: 'popular',
      page: 1,
      limit: MAX_TOP_VISITED_STORES,
      lat: userLat,
      lng: userLng,
      maxDistance: 3000,
    })
      .then(res => {
        const deduped = Array.from(new Map(res.stores.map(store => [store._id, store])).values());
        setTopVisitedStores(deduped.slice(0, MAX_TOP_VISITED_STORES));
      })
      .catch(() => setTopVisitedStores([]));
  }, [activeCategory, userLat, userLng]);

  useEffect(() => {
    setLikedStoreIds(prev => {
      const next = { ...prev };
      for (const store of topVisitedStores) {
        if (next[store._id] == null) next[store._id] = Boolean(store.isFavorited);
      }
      return next;
    });
  }, [topVisitedStores]);

  // Paint cached stories + posts immediately so the tray (profile avatar + rings)
  // and the first few feed items appear before any network call completes.
  useEffect(() => {
    peekStoriesFromCache()
      .then(cached => {
        if (cached && cached.length > 0) {
          setStoryGroups(prev => (prev.length > 0 ? prev : cached));
        }
      })
      .catch(() => null);
    peekHomeFeedCache()
      .then(b => {
        if (b && b.category === 'home' && b.posts.length > 0) {
          setPosts(prev => (prev.length > 0 ? prev : b.posts));
          setLoading(false);
        }
      })
      .catch(() => null);
  }, []);

  // Warm thumbnails for the 2 posts immediately after the initial viewport — enough
  // that the next scroll feels instant, nothing beyond that until the user actually
  // scrolls (avoids wasting server bandwidth on posts they never see).
  useEffect(() => {
    if (posts.length === 0) return;
    posts.slice(1, 3).forEach(p => {
      const uri = resolveMediaUrl(p.thumbnailUrl ?? p.mediaUrl);
      if (uri) Image.prefetch(uri).catch(() => null);
    });
  }, [posts]);

  // Single initial-load path: fire once auth is ready OR whenever the category
  // tab changes. No duplicate fetches, no full-screen gate after cache paint.
  useEffect(() => {
    perfMark('app_open_home');
    if (!authReady) return;
    if (posts.length === 0) setLoading(true);
    loadData(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, authReady]);

  useEffect(() => {
    if (firstPaintSentRef.current || posts.length === 0) return;
    firstPaintSentRef.current = true;
    const ms = perfMeasure('home_first_paint_ms', 'app_open_home');
    void trackPerfEvent('home_first_paint', { durationMs: ms, posts: posts.length });
  }, [posts.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const onLoadMore = useCallback(async () => {
    if (activeCategory === 'home' && !homeFeedInitialDoneRef.current) return;
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadData(false);
    setLoadingMore(false);
  }, [activeCategory, hasMore, loadingMore, loadData]);

  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(p =>
        p._id === postId
          ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
          : p,
      ),
    );
    toggleLike(postId).catch(() => {
      // Revert on error
      setPosts(prev =>
        prev.map(p =>
          p._id === postId
            ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
            : p,
        ),
      );
    });
  }, []);

  const handleHidePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p._id !== postId));
    setTrendingReels(prev => prev.filter(p => p._id !== postId));
  }, []);

  const toggleStoreLike = useCallback(async (store: BromoStore) => {
    const storeId = store._id;
    const currentlyLiked = likedStoreIds[storeId] ?? Boolean(store.isFavorited);
    setLikedStoreIds(prev => ({ ...prev, [storeId]: !currentlyLiked }));
    try {
      if (currentlyLiked) await unfavoriteStore(storeId);
      else await favoriteStore(storeId);
    } catch {
      setLikedStoreIds(prev => ({ ...prev, [storeId]: currentlyLiked }));
    }
  }, [likedStoreIds]);

  const callStore = useCallback((store: BromoStore) => {
    if (!store.phone?.trim()) {
      Alert.alert('Phone unavailable', 'This store has no phone number yet.');
      return;
    }
    openExternalUrl(`tel:${store.phone.trim()}`).catch(() => {
      Alert.alert('Call failed', 'Unable to open dialer.');
    });
  }, []);

  const openStoreDirection = useCallback((store: BromoStore) => {
    const [lng, lat] = store.location.coordinates;
    openExternalUrl(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
      .catch(() => Alert.alert('Directions unavailable', 'Unable to open maps right now.'));
  }, []);

  const refreshHeaderCounts = useCallback(async () => {
    if (!authReady || !dbUser?._id) {
      setNotificationUnread(0);
      setMessagesUnread(0);
      return;
    }
    const [notificationCount, conversationsRes] = await Promise.all([
      getUnreadCount().catch(() => 0),
      getConversations().catch(() => ({ conversations: [] })),
    ]);
    setNotificationUnread(notificationCount);
    setMessagesUnread(
      conversationsRes.conversations.reduce(
        (sum, conv) => sum + Math.max(0, conv.unreadCount || 0),
        0,
      ),
    );
  }, [authReady, dbUser?._id]);

  useEffect(() => {
    if (!authReady) return;
    refreshHeaderCounts().catch(() => null);
  }, [authReady, refreshHeaderCounts]);

  useEffect(() => {
    if (!authReady) return;
    const unsubNu = socketService.on('notification:unread', ({ count }) => {
      setNotificationUnread(count);
    });
    const unsubCu = socketService.on('chat:unread', ({ total }) => {
      setMessagesUnread(total);
    });
    return () => {
      unsubNu();
      unsubCu();
    };
  }, [authReady]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && authReady && !socketService.isConnected()) {
        refreshHeaderCounts().catch(() => null);
      }
    });
    return () => sub.remove();
  }, [authReady, refreshHeaderCounts]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'bromo:followChanged',
      ({userId, following}: {userId: string; following: boolean}) => {
        setPosts(prev =>
          prev.map(p =>
            String(p.author._id) === String(userId) ? {...p, isFollowing: following} : p,
          ),
        );
        setTrendingReels(prev =>
          prev.map(p =>
            String(p.author._id) === String(userId) ? {...p, isFollowing: following} : p,
          ),
        );
      },
    );
    const blockSub = DeviceEventEmitter.addListener(
      'bromo:userBlocked',
      ({userId}: {userId: string}) => {
        setPosts(prev => prev.filter(p => String(p.author._id) !== String(userId)));
        setTrendingReels(prev => prev.filter(p => String(p.author._id) !== String(userId)));
      },
    );
    return () => {
      sub.remove();
      blockSub.remove();
    };
  }, []);

  // Real-time feed: listen for new posts, likes, story arrivals, and header counter updates
  useEffect(() => {
    const unsubLike = socketService.on('post:like', ({ postId, likesCount, liked }) => {
      setPosts(prev =>
        prev.map(p => p._id === postId ? { ...p, likesCount, isLiked: liked } : p),
      );
    });
    const unsubDelete = socketService.on('post:delete', ({ postId }) => {
      setPosts(prev => prev.filter(p => p._id !== postId));
      setTrendingReels(prev => prev.filter(p => p._id !== postId));
      setStoryGroups(prev =>
        prev
          .map(g => ({ ...g, stories: g.stories.filter(s => s._id !== postId) }))
          .filter(g => g.stories.length > 0),
      );
    });
    const unsubStoryDel = socketService.on('story:delete', () => {
      void clearStoriesFeedCache()
        .then(() => loadStoriesFeedDeduped({ force: true }))
        .then(s => setStoryGroups(s))
        .catch(() => null);
    });
    const unsubComment = socketService.on('post:comment', ({ postId, commentsCount }) => {
      setPosts(prev =>
        prev.map(p => p._id === postId ? { ...p, commentsCount } : p),
      );
    });
    const unsubShare = socketService.on('post:share' as 'post:share', ({postId, sharesCount}: {postId: string; sharesCount: number}) => {
      setPosts(prev =>
        prev.map(p => (p._id === postId ? {...p, sharesCount} : p)),
      );
      setTrendingReels(prev =>
        prev.map(p => (p._id === postId ? {...p, sharesCount} : p)),
      );
    });
    const unsubStory = socketService.on('story:new', () => {
      void clearStoriesFeedCache()
        .then(() => loadStoriesFeed({ force: true }))
        .then(s => setStoryGroups(s))
        .catch(() => null);
    });
    const unsubNew = socketService.on('post:new', p => {
      if (p.type === 'story') return;
      const cat = activeCategoryRef.current;
      if (cat === 'trending') return;
      if (cat !== 'home' && p.feedCategory !== cat) return;
      const myId = dbUser?._id;
      const aid = p.author?._id;
      const isSelf = Boolean(myId && aid && String(aid) === String(myId));
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
        feedCategory: p.feedCategory ?? 'general',
      };
      const [hydrated] = enrichFeedChunk([enriched]);
      setPosts(prev => (prev.some(x => x._id === hydrated._id) ? prev : [hydrated, ...prev]));
    });
    const unsubSeen = DeviceEventEmitter.addListener('bromo:storiesChanged', () => {
      void clearStoriesFeedCache()
        .then(() => loadStoriesFeedDeduped({ force: true }))
        .then(s => setStoryGroups(s))
        .catch(() => null);
    });
    return () => {
      unsubLike();
      unsubDelete();
      unsubStoryDel();
      unsubComment();
      unsubShare();
      unsubStory();
      unsubNew();
      unsubSeen.remove();
    };
  }, [refreshHeaderCounts, dbUser?._id]);

  const collapseSearch = useCallback(() => {
    setSearchExpanded(false);
    setHomeSearchQuery('');
  }, []);

  const myAvatar = dbUser?.profilePicture || undefined;
  const myAvatarResolved = useMemo(
    () => (myAvatar ? resolveMediaUrl(myAvatar) || myAvatar : undefined),
    [myAvatar],
  );
  type HomeFeedItem =
    | { kind: 'post'; post: Post; key: string }
    | { kind: 'suggestions'; key: string }
    | { kind: 'stories'; key: string }
    | { kind: 'trendingReels'; key: string }
    | { kind: 'topVisitedStores'; key: string }
    | { kind: 'ad'; ad: Ad; key: string };

  const feedItems = useMemo((): HomeFeedItem[] => {
    const items: HomeFeedItem[] = [];
    items.push({ kind: 'stories', key: 'stories' });
    if (activeCategory === 'home' && trendingReels.length >= MIN_TRENDING_REELS) {
      items.push({ kind: 'trendingReels', key: 'trending-reels' });
    }
    const leadPost = posts[0];
    const secondPost = posts[1];
    const remainingPosts = posts.slice(2);

    if (leadPost) {
      items.push({ kind: 'post', post: leadPost, key: `post-${leadPost._id}` });
    }
    if (activeCategory === 'home' && topVisitedStores.length > 0) {
      items.push({ kind: 'topVisitedStores', key: 'top-visited-stores' });
    }
    if (secondPost) {
      items.push({ kind: 'post', post: secondPost, key: `post-${secondPost._id}` });
    }
    if (activeCategory === 'home' && suggestions.length > 0) {
      items.push({ kind: 'suggestions', key: 'suggestions' });
    }
    remainingPosts.forEach(p => {
      items.push({ kind: 'post', post: p, key: `post-${p._id}` });
    });
    if (feedAds.length > 0) {
      const postIndices = items
        .map((item, idx) => (item.kind === 'post' && idx > 0 ? idx : -1))
        .filter(idx => idx !== -1);
      const seed = hashString(
        `${activeCategory}\0${posts.map(p => p._id).join(',')}\0${feedAds.map(a => a._id).join(',')}`,
      );
      const slots = pickAdSlots(postIndices.length, feedAds.length, seed);
      for (let k = slots.length - 1; k >= 0; k--) {
        const afterFeedIdx = postIndices[slots[k]!]!;
        items.splice(afterFeedIdx + 1, 0, {
          kind: 'ad',
          ad: feedAds[k]!,
          key: `ad_${feedAds[k]!._id}`,
        });
      }
    }
    return items;
  }, [activeCategory, trendingReels, topVisitedStores, posts, suggestions, feedAds]);

  useEffect(() => {
    if (feedAds.length > 0) prefetchAdMedia(feedAds);
  }, [feedAds]);

  useEffect(() => {
    if (storyAds.length > 0) prefetchAdMedia(storyAds);
  }, [storyAds]);

  const feedChromeScrollY = useRef(new Animated.Value(0)).current;
  const feedChromeHeight = feedChromeScrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [110, 0],
    extrapolate: 'clamp',
  });
  const feedChromeOpacity = feedChromeScrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Screen bare edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Animated.View style={{height: feedChromeHeight, opacity: feedChromeOpacity, overflow: 'hidden'}}>
      {/* Header: brand icon + title (left), flexible gap, actions (right, spaced) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 12,
          minHeight: 56,
          backgroundColor: palette.background,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}>
        {searchExpanded ? (
          <>
            {brandIconUri ? (
              <Image
                source={{ uri: brandIconUri }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  marginRight: 10,
                  backgroundColor: palette.surface,
                }}
                resizeMode="contain"
              />
            ) : null}
            <ThemedText
              variant="heading"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 20,
                fontStyle: 'italic',
                letterSpacing: -0.5,
                color: palette.primary,
                maxWidth: 96,
                marginRight: 8,
              }}>
              {branding.appTitle || 'BROMO'}
            </ThemedText>
            <SearchBar
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Search BROMO..."
              value={homeSearchQuery}
              onChangeText={setHomeSearchQuery}
              autoFocus
              onSubmitEditing={() => {
                const q = homeSearchQuery.trim() || 'bromo';
                parentNavigate(navigation, 'SearchResults', { query: q });
                collapseSearch();
              }}
            />
            <Pressable onPress={collapseSearch} hitSlop={14} style={{ padding: 6, marginLeft: 10 }}>
              <X size={22} color={palette.foreground} />
            </Pressable>
          </>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexShrink: 1,
                minWidth: 0,
                marginRight: 12,
                gap: 10,
              }}>
              <Pressable
                hitSlop={10}
                accessibilityLabel="Create"
                onPress={() =>
                  parentNavigate(navigation, 'CreateFlow', {
                    screen: 'CreateHub',
                    params: { mode: 'reel', bootstrapTs: Date.now() },
                  })
                }
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: palette.primary,
                }}>
                <Plus size={20} color={palette.primaryForeground} strokeWidth={2.75} />
              </Pressable>
              <ThemedText
                variant="heading"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 22,
                  fontStyle: 'italic',
                  letterSpacing: -1,
                  color: palette.primary,
                  flexShrink: 1,
                  minWidth: 0,
                }}>
                {branding.appTitle || 'BROMO'}
              </ThemedText>
            </View>
            <View style={{ flex: 1, minWidth: 16 }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                flexShrink: 0,
              }}>
              <Pressable
                onPress={() => setSearchExpanded(true)}
                hitSlop={10}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.input,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Search size={20} color={palette.foreground} />
              </Pressable>
              <View style={{ position: 'relative' }}>
                <Pressable hitSlop={12} onPress={() => parentNavigate(navigation, 'Notifications')}>
                  <Bell size={22} color={palette.foreground} />
                </Pressable>
                <HeaderBadge count={notificationUnread} />
              </View>
              <View style={{ position: 'relative' }}>
                <Pressable hitSlop={12} onPress={() => parentNavigate(navigation, 'MessagesFlow')}>
                  <MessageCircle size={22} color={palette.foreground} />
                </Pressable>
                <HeaderBadge count={messagesUnread} />
              </View>
            </View>
          </>
        )}
      </View>

      <SegmentedTabs
        items={categorySegmentItems}
        value={activeCategory}
        onChange={v => setActiveCategory(v)}
        variant="pill"
        style={{borderBottomWidth: 1, borderBottomColor: palette.border}}
      />
      </Animated.View>

      <View style={{ flex: 1 }}>
        <RefreshableFlatList
          data={feedItems}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={
            liveStreams.length === 0 ? null : (
              <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 8 }}>
                {liveStreams.map(stream => (
                  <Pressable
                    key={stream.streamId}
                    onPress={() =>
                      parentNavigate(navigation, 'LiveWatch', {
                        hlsUrl: stream.hlsUrl,
                        title: stream.title,
                        streamerName: stream.displayName,
                      })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: `${palette.destructive}18`,
                      borderWidth: 1,
                      borderColor: `${palette.destructive}40`,
                    }}>
                    <Radio size={18} color={palette.destructive} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: palette.foreground, fontWeight: '900', fontSize: 13 }} numberOfLines={1}>
                        LIVE · {stream.displayName}
                      </Text>
                      {stream.title ? (
                        <Text style={{ color: palette.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                          {stream.title}
                        </Text>
                      ) : null}
                    </View>
                    <Play size={16} color={palette.foreground} fill={palette.foreground} />
                  </Pressable>
                ))}
              </View>
            )
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.2}
          onScroll={event => feedChromeScrollY.setValue(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          viewabilityConfig={feedViewabilityConfig}
          onViewableItemsChanged={onFeedViewableItemsChanged}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Users size={48} color={palette.foregroundFaint} />
              <ThemedText variant="body" style={{ marginTop: 16, textAlign: 'center', paddingHorizontal: 32 }}>
                Follow people to see their posts here
              </ThemedText>
              <Pressable
                onPress={() => parentNavigate(navigation, 'Search')}
                style={{
                  marginTop: 20, backgroundColor: palette.primary,
                  borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28,
                }}>
                <Text style={{ color: palette.primaryForeground, fontWeight: '800', fontSize: 14 }}>
                  Discover People
                </Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === 'stories') {
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 14, gap: 16 }}
                  style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
                  {/* Own story */}
                  <Pressable
                    style={{ alignItems: 'center', gap: 5 }}
                    onPress={() => parentNavigate(navigation, 'CreateFlow', { mode: 'story' })}>
                    <View style={{ position: 'relative' }}>
                      <StoryRing
                        uri={myAvatarResolved || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser?.displayName ?? 'You')}`}
                        size={58}
                        seen={myStoriesAllSeen}
                      />
                      <View
                        style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 22, height: 22, borderRadius: 11,
                          backgroundColor: palette.primary, alignItems: 'center',
                          justifyContent: 'center', borderWidth: 2, borderColor: palette.background,
                        }}>
                        <Plus size={13} color={palette.primaryForeground} strokeWidth={3} />
                      </View>
                    </View>
                    <ThemedText variant="caption" style={{ maxWidth: 64 }} numberOfLines={1}>Your Story</ThemedText>
                  </Pressable>

                  {/* Sponsored story — appears right after user's own story */}
                  {storyAds.length > 0 && (
                    <Pressable
                      style={{ alignItems: 'center', gap: 5 }}
                      onPress={() => setActiveStoryAd(storyAds[0])}>
                      <View style={{ position: 'relative' }}>
                        <StoryRing
                          uri={storyAds[0].mediaUrls[0]}
                          size={60}
                          seen={false}
                        />
                        {/* Accent "Sponsored" badge */}
                        <View
                          style={{
                            position: 'absolute',
                            bottom: -2,
                            left: 0,
                            right: 0,
                            alignItems: 'center',
                          }}>
                          <View
                            style={{
                              backgroundColor: palette.accent,
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}>
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>AD</Text>
                          </View>
                        </View>
                      </View>
                      <ThemedText variant="caption" style={{ maxWidth: 64 }} numberOfLines={1}>Sponsored</ThemedText>
                    </Pressable>
                  )}

                  {/* Following stories */}
                  {storyTrayEntries.map(({ group, ringUriResolved, allSeen }, storyIndex) => (
                    <Pressable
                      key={
                        group.isPromoted && group.promotionId
                          ? `story-promo-${group.promotionId}-${storyIndex}`
                          : `story-${group.author._id}-${storyIndex}`
                      }
                      style={{ alignItems: 'center', gap: 5 }}
                      onPress={() => parentNavigate(navigation, 'StoryView', { userId: group.author._id })}>
                      <View style={{ position: 'relative' }}>
                        <StoryRing uri={ringUriResolved} size={60} seen={allSeen} />
                        {group.isPromoted ? (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              left: 0,
                              right: 0,
                              alignItems: 'center',
                            }}>
                            <View
                              style={{
                                backgroundColor: palette.primary,
                                paddingHorizontal: 4,
                                paddingVertical: 1,
                                borderRadius: 4,
                              }}>
                              <Text style={{ color: palette.primaryForeground, fontSize: 8, fontWeight: '900' }}>
                                Ad
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText variant="caption" style={{ maxWidth: 64 }} numberOfLines={1}>
                        {group.author.username}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              );
            }

            if (item.kind === 'topVisitedStores') {
              return (
                <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 }}>
                    <ThemedText variant="heading" style={{ fontSize: 15, fontWeight: '800' }}>
                      Top Visited Stores Near You
                    </ThemedText>
                    <Pressable onPress={() => parentNavigate(navigation, 'AllStores')} hitSlop={8}>
                      <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 12 }}>SEE ALL</Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      paddingHorizontal: 14, gap: 12,
                    }}>
                    {topVisitedStores.map((store, storeIndex) => (
                      <View
                        key={`${store._id}-${storeIndex}`}
                       style={{
                          width: '50%',
                          marginTop: 0,
                          borderWidth: 1.5,
                          borderColor: palette.border,
                          padding: 0,
                          borderRadius: 28,
                          backgroundColor: palette.surface,
                        }}
                        ><StoreDiscoverHomeCard
                        store={store}
                        palette={palette}
                        liked={likedStoreIds[store._id] ?? Boolean(store.isFavorited)}
                      
                        onPressCard={() => parentNavigate(navigation, 'StorePublicProfile', { storeId: store._id })}
                        onToggleLike={() => {
                          toggleStoreLike(store).catch(() => undefined);
                        }}
                        onCall={() => callStore(store)}
                        onDirection={() => openStoreDirection(store)}
                        onViewOffers={() => parentNavigate(navigation, 'StorePublicProfile', { storeId: store._id })}
                      />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              );
            }
            if (item.kind === 'trendingReels') {
              return (
                <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 14,
                      paddingTop: 10,
                      paddingBottom: 10,
                    }}>
                    <ThemedText variant="heading" style={{ fontSize: 15, fontWeight: '800' }}>
                      Top Trending Reels
                    </ThemedText>
                    <Pressable onPress={() => parentNavigate(navigation, 'Reels')} hitSlop={8}>
                      <Text style={{ color: palette.primary, fontWeight: '800', fontSize: 12 }}>SEE MORE</Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                    {trendingReels.map((reel, reelIndex) => {
                      const thumb = postThumbnailUri(reel);
                      const rawVideoUrl = reel.mediaType === 'video' ? resolveVideoUrl(reel) : '';
                      const reelVideoUri = rawVideoUrl ? resolveMediaUrl(rawVideoUrl) || rawVideoUrl : '';
                      const showVideoPreview = reel.mediaType === 'video';
                      return (
                        <Pressable
                          key={`${reel._id}-${reelIndex}`}
                          onPress={() => {
                            recordView(reel._id, 0).catch(() => null);
                            parentNavigate(navigation, 'Reels', { initialPostId: reel._id });
                          }}
                          style={{ width: 118 }}>
                          <View style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: palette.surface }}>
                            {showVideoPreview ? (
                              <PostVideoWithClientMeta
                                post={reel}
                                context="feed"
                                uri={reelVideoUri}
                                fallbackUri={resolveMediaUrl(reel.mediaUrl) || undefined}
                                style={{ width: '100%', aspectRatio: 9 / 16, backgroundColor: palette.muted }}
                                muted
                                paused
                                repeat={false}
                                posterUri={thumb || undefined}
                                posterOverlayUntilReady
                              />
                            ) : (
                              <Image
                                source={{ uri: thumb }}
                                style={{ width: '100%', aspectRatio: 9 / 16, backgroundColor: palette.muted }}
                                resizeMode="contain"
                              />
                            )}
                            <View
                              style={{
                                position: 'absolute',
                                left: 8,
                                bottom: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: 'rgba(0,0,0,0.55)',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 8,
                              }}>
                              <Play size={12} color="#fff" />
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                                {formatCount(reel.viewsCount)} VIEWS
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            }

            if (item.kind === 'suggestions') {
              return (
                <View style={{ paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Users size={16} color={palette.primary} />
                      <ThemedText variant="heading" style={{ fontSize: 14 }}>People You May Know</ThemedText>
                    </View>
                    <Pressable onPress={() => parentNavigate(navigation, 'Search')}>
                      <ThemedText variant="primary" style={{ fontSize: 11, fontWeight: '700' }}>See All</ThemedText>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingBottom: 14 }}
                    style={{ paddingTop: 6 }}>
                    {suggestions.map((s, suggestionIndex) => (
                      <SuggestionCard
                        key={`${s._id}-${suggestionIndex}`}
                        user={s}
                        onFollowToggle={() => { }}
                        navigation={navigation}
                        palette={palette}
                        borderRadiusScale={borderRadiusScale}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            }

            if (item.kind === 'post') {
              return (
                <PostCard
                  post={item.post}
                  onLikeToggle={handleLikeToggle}
                  onHide={handleHidePost}
                  onPostDeleted={handleHidePost}
                  onCategoryPress={setActiveCategory}
                  navigation={navigation}
                  isVideoVisible={item.post.mediaType === 'video' && item.post._id === visiblePostId}
                  isFeedItemVisible={item.post._id === visibleFeedPostId}
                />
              );
            }

            if (item.kind === 'ad') {
              return (
                <AdCard
                  ad={item.ad}
                  placement="feed"
                  isVideoVisible={item.ad.adType === 'video' && item.ad._id === visibleAdId}
                />
              );
            }

            return null;
          }}
        />
        {loading && posts.length === 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 80,
              alignItems: 'center',
            }}>
            <ActivityIndicator color={palette.primary} size="small" />
          </View>
        ) : null}
      </View>

      {/* Story ad full-screen viewer */}
      {activeStoryAd && (
        <AdStoryViewer
          ad={activeStoryAd}
          visible={activeStoryAd !== null}
          onClose={() => setActiveStoryAd(null)}
        />
      )}
    </Screen>
  );
}
