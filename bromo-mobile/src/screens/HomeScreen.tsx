import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ComponentType} from 'react';
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ViewabilityConfig,
  type ViewToken,
} from 'react-native';
import {NetworkVideo} from '../components/media/NetworkVideo';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
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
} from 'lucide-react-native';
import type {NavigationProp} from '@react-navigation/native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedText} from '../components/ui/ThemedText';
import {StoryRing} from '../components/ui/StoryRing';
import {SearchBar} from '../components/ui/SearchBar';
import {Card} from '../components/ui/Card';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {resolveMediaUrl} from '../lib/resolveMediaUrl';
import {getFeed, getTrendingReels, toggleLike, hidePost, reportPost, recordView, resolveVideoUrl, type Post, type StoryGroup} from '../api/postsApi';
import {logPromotionDelivery} from '../api/promotionsApi';
import {fetchAds, prefetchAdMedia, type Ad} from '../api/adsApi';
import {hashString, pickAdSlots} from '../lib/adSlots';
import {AdCard} from '../components/AdCard';
import {AdStoryViewer} from '../components/AdStoryViewer';
import {clearStoriesFeedCache, loadStoriesFeed, loadStoriesFeedDeduped} from '../lib/storiesFeedCache';
import {getUserSuggestions, followUser, unfollowUser, type SuggestedUser} from '../api/followApi';
import {getUnreadCount} from '../api/notificationsApi';
import {getConversations} from '../api/chatApi';
import {socketService} from '../services/socketService';
import {usePlaybackMute} from '../context/PlaybackMuteContext';
import {usePlaybackNetworkCap} from '../lib/usePlaybackNetworkCap';
import {openExternalUrl} from '../lib/openExternalUrl';

type IconComp = ComponentType<{size?: number; color?: string}>;

const CATEGORIES: {id: string; label: string; Icon: IconComp}[] = [
  {id: 'home', label: 'For You', Icon: Home},
  {id: 'trending', label: 'Trending', Icon: Flame},
  {id: 'politics', label: 'Politics', Icon: Landmark},
  {id: 'sports', label: 'Sports', Icon: Trophy},
  {id: 'shopping', label: 'Shopping', Icon: ShoppingBag},
  {id: 'tech', label: 'Tech', Icon: Laptop},
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function HeaderBadge({count}: {count: number}) {
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
      <Text style={{color: '#ffffff', fontSize: 10, fontWeight: '800'}}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

import {Modal} from 'react-native';

type PostCardProps = {
  post: Post;
  onLikeToggle: (postId: string) => void;
  onHide: (postId: string) => void;
  navigation: Nav;
  isVideoVisible?: boolean;
  isFeedItemVisible?: boolean;
};

function PostCard({
  post,
  onLikeToggle,
  onHide,
  navigation,
  isVideoVisible = false,
  isFeedItemVisible = false,
}: PostCardProps) {
  const {palette, contract} = useTheme();
  const {dbUser} = useAuth();
  const {homeFeedMuted, toggleHomeFeedMuted} = usePlaybackMute();
  const {isCellular, maxBitRate} = usePlaybackNetworkCap();
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(post.isFollowing);
  const [videoEnded, setVideoEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const viewRecordedRef = useRef(false);
  const promoImpressionLoggedRef = useRef(false);
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const handleFollow = async () => {
    try {
      if (following) {
        await unfollowUser(post.author._id);
        setFollowing(false);
      } else {
        await followUser(post.author._id);
        setFollowing(true);
      }
    } catch {}
    setMenuOpen(false);
  };

  const handleHide = async () => {
    setMenuOpen(false);
    hidePost(post._id);
    onHide(post._id);
  };

  const handleReport = async () => {
    setMenuOpen(false);
    reportPost(post._id, 'inappropriate');
  };

  const avatarUri = post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`;

  useEffect(() => {
    if (!isFeedItemVisible) {
      viewRecordedRef.current = false;
      return;
    }
    if (viewRecordedRef.current) return;
    viewRecordedRef.current = true;
    recordView(post._id, 0).catch(() => null);
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
    if (isVideoVisible && post.mediaType === 'video') {
      setVideoEnded(false);
    }
  }, [isVideoVisible, post.mediaType, post._id]);

  const rawVideoUrl = post.mediaType === 'video' ? resolveVideoUrl(post, isCellular) : '';
  const playUri = rawVideoUrl ? resolveMediaUrl(rawVideoUrl) || rawVideoUrl : '';
  const isHls = rawVideoUrl.endsWith('.m3u8');
  const thumbForVideo = postThumbnailUri(post) || playUri;

  const openReelsAtThisPost = () => {
    parentNavigate(navigation, 'Reels', {initialPostId: post._id});
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
              parentNavigate(navigation, 'ContentInsights', {focusPostId: post._id});
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
        parentNavigate(navigation, 'OtherUserProfile', {userId: post.author._id});
      },
    },
    {
      icon: <Send size={20} color={palette.foreground} />,
      label: 'Share Post',
      onPress: () => {
        setMenuOpen(false);
        parentNavigate(navigation, 'ShareSend', {postId: post._id});
      },
    },
    {
      icon: <Bookmark size={20} color={palette.foreground} />,
      label: 'Save',
      onPress: () => {
        setMenuOpen(false);
        setBookmarked(true);
      },
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
        ]
      : []),
  ];

  return (
    <View style={{borderBottomWidth: 8, borderBottomColor: palette.background, backgroundColor: palette.background}}>
      {/* 3-dot action sheet */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'}} onPress={() => setMenuOpen(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: palette.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
              paddingBottom: 28, paddingTop: 6,
            }}>
            <View style={{alignItems: 'center', paddingBottom: 8}}>
              <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>
            {menuRows.map(item => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({pressed}) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingVertical: 14, paddingHorizontal: 18,
                  backgroundColor: pressed ? `${palette.foreground}0f` : 'transparent',
                })}>
                {item.icon}
                <ThemedText variant="body" style={{fontSize: 15, fontWeight: '500', color: item.danger ? palette.destructive : palette.foreground}}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12}}>
        <Pressable
          style={{flexDirection: 'row', alignItems: 'center', gap: 10}}
          onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: post.author._id})}>
          <Image source={{uri: avatarUri}} style={{width: 36, height: 36, borderRadius: 18}} />
          <View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap'}}>
              <ThemedText variant="label" style={{fontSize: 13}}>{post.author.displayName}</ThemedText>
              {post.author.emailVerified && (
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
                  <Text style={{fontSize: 9, fontWeight: '900', color: palette.foregroundMuted}}>Promoted</Text>
                </View>
              ) : null}
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1}}>
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
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
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
              <ThemedText variant="primary" style={{fontSize: 11, fontWeight: '800'}}>Follow</ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
            <MoreHorizontal size={18} color={palette.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {post.caption ? (
        <View style={{paddingHorizontal: 14, paddingBottom: 8}}>
          <ThemedText variant="body" style={{fontSize: 13, lineHeight: 19}}>{post.caption}</ThemedText>
        </View>
      ) : null}

      {post.type === 'reel' ? (
        <Pressable onPress={openReelsAtThisPost}>
          {post.mediaType === 'video' ? (
            <View style={{position: 'relative'}}>
              <NetworkVideo
                key={`${post._id}-${replayKey}`}
                context={isHls ? 'feed-hls' : 'feed'}
                uri={playUri}
                fallbackUri={isHls ? resolveMediaUrl(post.mediaUrl) ?? undefined : undefined}
                posterUri={thumbForVideo || undefined}
                maxBitRate={isHls ? maxBitRate : undefined}
                style={{width: '100%', aspectRatio: 1}}
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
                    <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 13}}>Watch again</Text>
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
                    <Text style={{color: '#fff', fontWeight: '800', fontSize: 13}}>View more</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <Image
              source={{uri: resolveMediaUrl(post.mediaUrl)}}
              style={{width: '100%', aspectRatio: 1, resizeMode: 'cover'}}
            />
          )}
        </Pressable>
      ) : (
        <View>
          {post.mediaType === 'video' ? (
            <View style={{position: 'relative'}}>
              <NetworkVideo
                key={`${post._id}-${replayKey}`}
                context={isHls ? 'feed-hls' : 'feed'}
                uri={playUri}
                fallbackUri={isHls ? resolveMediaUrl(post.mediaUrl) ?? undefined : undefined}
                posterUri={thumbForVideo || undefined}
                maxBitRate={isHls ? maxBitRate : undefined}
                style={{width: '100%', aspectRatio: 1}}
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
                    <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 13}}>Watch again</Text>
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
                    <Text style={{color: '#fff', fontWeight: '800', fontSize: 13}}>View more</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <Image
              source={{uri: resolveMediaUrl(post.mediaUrl)}}
              style={{width: '100%', aspectRatio: 1, resizeMode: 'cover'}}
            />
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
                  <Text style={{color: palette.primaryForeground, fontWeight: '900', fontSize: 14}}>
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
                  <Text style={{color: palette.primaryForeground, fontWeight: '900', fontSize: 14}}>Follow</Text>
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
                  <Text style={{color: palette.primaryForeground, fontWeight: '900', fontSize: 14}}>
                    {post.isLiked ? 'Liked' : 'Like'}
                  </Text>
                </Pressable>
              );
            }

            return null;
          })()
        : null}

      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12}}>
        <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
          <Pressable onPress={() => onLikeToggle(post._id)} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <Heart
              size={24}
              color={post.isLiked ? palette.destructive : palette.foreground}
              fill={post.isLiked ? palette.destructive : 'transparent'}
            />
            <ThemedText variant="label">{formatCount(post.likesCount)}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => parentNavigate(navigation, 'Comments', {postId: post._id})}
            style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <MessageCircle size={24} color={palette.foreground} />
            <ThemedText variant="label">{formatCount(post.commentsCount)}</ThemedText>
          </Pressable>
          <Pressable onPress={() => parentNavigate(navigation, 'ShareSend', {postId: post._id})}>
            <Send size={24} color={palette.foreground} />
          </Pressable>
        </View>
        <Pressable onPress={() => setBookmarked(p => !p)}>
          <Bookmark
            size={24}
            color={bookmarked ? palette.primary : palette.foreground}
            fill={bookmarked ? palette.primary : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={{paddingHorizontal: 14, paddingBottom: 14}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4}}>
          <Eye size={11} color={palette.mutedForeground} />
          <ThemedText variant="caption">{formatCount(post.viewsCount)} Views</ThemedText>
        </View>
        {post.music ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <Music2 size={10} color={palette.mutedForeground} />
            <ThemedText variant="caption">{post.music}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type SuggestionCardProps = {
  user: SuggestedUser;
  onFollowToggle: (userId: string, isFollowing: boolean) => void;
  navigation: Nav;
  palette: ReturnType<typeof useTheme>['palette'];
  borderRadiusScale: string;
};

function SuggestionCard({user, onFollowToggle, navigation, palette, borderRadiusScale}: SuggestionCardProps) {
  const [following, setFollowing] = useState(false);

  const handleFollow = async () => {
    try {
      if (following) {
        await unfollowUser(user._id);
        setFollowing(false);
      } else {
        await followUser(user._id);
        setFollowing(true);
      }
      onFollowToggle(user._id, !following);
    } catch {}
  };

  return (
    <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: user._id})}>
      <Card style={{width: 160, padding: 14, alignItems: 'center'}}>
        <Image
          source={{uri: user.profilePicture || `https://ui-avatars.com/api/?name=${user.displayName}`}}
          style={{width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: palette.primary, marginBottom: 8}}
        />
        <ThemedText variant="label" style={{textAlign: 'center'}} numberOfLines={1}>{user.displayName}</ThemedText>
        <ThemedText variant="caption" style={{textAlign: 'center', marginTop: 2}} numberOfLines={1}>
          @{user.username}
        </ThemedText>
        <ThemedText variant="caption" style={{textAlign: 'center', marginTop: 2}}>
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
          <Text style={{color: following ? palette.primary : palette.primaryForeground, fontSize: 12, fontWeight: '800'}}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </Card>
    </Pressable>
  );
}

export function HomeScreen() {
  const {palette, contract, isDark} = useTheme();
  const {dbUser, ready: authReady} = useAuth();
  const {setHomeFeedMuted} = usePlaybackMute();
  const navigation = useNavigation() as Nav;
  const tabBarHeight = useBottomTabBarHeight();
  const [activeCategory, setActiveCategory] = useState('home');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipRadius = borderRadiusScale === 'bold' ? 999 : 12;
  const brandIconUri = useMemo(
    () => resolveMediaUrl(contract.branding.faviconUrl || contract.branding.logoUrl),
    [contract.branding.faviconUrl, contract.branding.logoUrl],
  );

  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [feedAds, setFeedAds] = useState<Ad[]>([]);
  const [storyAds, setStoryAds] = useState<Ad[]>([]);
  const [activeStoryAd, setActiveStoryAd] = useState<Ad | null>(null);

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
              ? preview.thumbnailUrl || preview.mediaUrl
              : preview.mediaUrl
            : group.author.profilePicture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(group.author.displayName)}`;
        const ringUriResolved = resolveMediaUrl(ringUri) || ringUri;
        const allSeen = group.stories.length > 0 && group.stories.every(s => s.seenByMe === true);
        return {group, ringUriResolved, allSeen};
      }),
    [storyGroups],
  );
  const myStoriesAllSeen =
    myStoryGroup && myStoryGroup.stories.length > 0
      ? myStoryGroup.stories.every(s => s.seenByMe === true)
      : false;
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [trendingReels, setTrendingReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const topicPageRef = useRef(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const initialLoadDone = useRef(false);
  const forYouPhaseRef = useRef<'friends' | 'general'>('friends');
  const cfRef = useRef<string | null>(null);
  const cgRef = useRef<string | null>(null);
  const activeCategoryRef = useRef(activeCategory);
  /** ID of the currently-visible video post (only this one autoplays). */
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  /** First mostly-visible feed post (for view counts on images + video). */
  const [visibleFeedPostId, setVisibleFeedPostId] = useState<string | null>(null);
  const [visibleAdId, setVisibleAdId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setHomeFeedMuted(true);
    }, [setHomeFeedMuted]),
  );

  const feedViewabilityConfig = useRef<ViewabilityConfig>({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 200,
  }).current;

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  const onFeedViewableItemsChanged = useRef(({viewableItems}: {viewableItems: ViewToken[]}) => {
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
    const row = visible[0]!.item as {kind: string; post?: Post; ad?: Ad};
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
    try {
      const cat = activeCategory;
      const isHome = cat === 'home';

      if (reset && isHome) {
        forYouPhaseRef.current = 'friends';
        cfRef.current = null;
        cgRef.current = null;
      }

      const [storiesRes, suggestionsRes, adsRes, storyAdsRes, trendingRes] = await Promise.all([
        reset ? loadStoriesFeedDeduped() : Promise.resolve(null),
        reset ? getUserSuggestions(6) : Promise.resolve(null),
        reset ? fetchAds('feed', 5) : Promise.resolve(null),
        reset ? fetchAds('stories', 2) : Promise.resolve(null),
        reset && isHome ? getTrendingReels(6).catch(() => ({posts: [] as Post[]})) : Promise.resolve(null),
      ]);

      if (reset) {
        if (storiesRes) setStoryGroups(storiesRes);
        if (suggestionsRes) setSuggestions(suggestionsRes.users);
        if (adsRes) setFeedAds(adsRes);
        if (storyAdsRes) setStoryAds(storyAdsRes);
        if (isHome) {
          if (
            trendingRes != null &&
            typeof trendingRes === 'object' &&
            Array.isArray((trendingRes as {posts?: Post[]}).posts)
          ) {
            setTrendingReels((trendingRes as {posts: Post[]}).posts);
          } else {
            setTrendingReels([]);
          }
        } else {
          setTrendingReels([]);
        }
      }

      if (isHome) {
        let res = await getFeed({
          tab: 'for-you',
          fyPhase: forYouPhaseRef.current,
          cf: forYouPhaseRef.current === 'friends' ? cfRef.current : undefined,
          cg: forYouPhaseRef.current === 'general' ? cgRef.current : undefined,
        });

        // Never chain-fetch "general" discover into the same home list when friends runs out — that
        // surfaced every stranger's post. Explore/topic tabs use separate feed requests.

        if (res.forYouPhase === 'friends') {
          forYouPhaseRef.current = 'friends';
          if (res.nextCursorFriends) cfRef.current = res.nextCursorFriends;
        } else {
          forYouPhaseRef.current = 'general';
          cgRef.current = res.nextCursorGeneral ?? null;
        }

        const mergedPosts = dedupePostsById(res.posts);
        if (reset) {
          setPosts(mergedPosts);
        } else {
          setPosts(prev => dedupePostsById([...prev, ...mergedPosts]));
        }

        const more =
          res.forYouPhase === 'friends'
            ? Boolean(res.hasMoreFriends)
            : Boolean(res.hasMoreGeneral);
        setHasMore(more);
      } else {
        const tab = cat === 'trending' ? 'trending' : cat;
        if (reset) topicPageRef.current = 1;
        const p = topicPageRef.current;
        const res = await getFeed({tab, page: p});
        if (reset) {
          setPosts(res.posts);
          topicPageRef.current = 2;
        } else {
          setPosts(prev => [...prev, ...res.posts]);
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
    }
  }, [activeCategory]);

  // Wait for Firebase auth to restore session before hitting the API.
  useEffect(() => {
    if (!authReady) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    setLoading(true);
    loadData(true).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    setLoading(true);
    loadData(true).finally(() => setLoading(false));
  }, [activeCategory, authReady, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadData(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loadData]);

  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(p =>
        p._id === postId
          ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1}
          : p,
      ),
    );
    toggleLike(postId).catch(() => {
      // Revert on error
      setPosts(prev =>
        prev.map(p =>
          p._id === postId
            ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1}
            : p,
        ),
      );
    });
  }, []);

  const handleHidePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p._id !== postId));
  }, []);

  const refreshHeaderCounts = useCallback(async () => {
    if (!authReady || !dbUser?._id) {
      setNotificationUnread(0);
      setMessagesUnread(0);
      return;
    }
    const [notificationCount, conversationsRes] = await Promise.all([
      getUnreadCount().catch(() => 0),
      getConversations().catch(() => ({conversations: []})),
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
    const unsubNu = socketService.on('notification:unread', ({count}) => {
      setNotificationUnread(count);
    });
    const unsubCu = socketService.on('chat:unread', ({total}) => {
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

  // Real-time feed: listen for new posts, likes, story arrivals, and header counter updates
  useEffect(() => {
    const unsubLike = socketService.on('post:like', ({postId, likesCount, liked}) => {
      setPosts(prev =>
        prev.map(p => p._id === postId ? {...p, likesCount, isLiked: liked} : p),
      );
    });
    const unsubDelete = socketService.on('post:delete', ({postId}) => {
      setPosts(prev => prev.filter(p => p._id !== postId));
    });
    const unsubComment = socketService.on('post:comment', ({postId, commentsCount}) => {
      setPosts(prev =>
        prev.map(p => p._id === postId ? {...p, commentsCount} : p),
      );
    });
    const unsubStory = socketService.on('story:new', () => {
      void clearStoriesFeedCache()
        .then(() => loadStoriesFeed({force: true}))
        .then(s => setStoryGroups(s))
        .catch(() => null);
    });
    const unsubNew = socketService.on('post:new', p => {
      if (p.type === 'story') return;
      const cat = activeCategoryRef.current;
      if (cat === 'trending') return;
      if (['politics', 'sports', 'shopping', 'tech'].includes(cat) && p.feedCategory !== cat) return;
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
      setPosts(prev => (prev.some(x => x._id === enriched._id) ? prev : [enriched, ...prev]));
    });
    const unsubSeen = DeviceEventEmitter.addListener('bromo:storiesChanged', () => {
      void clearStoriesFeedCache()
        .then(() => loadStoriesFeedDeduped({force: true}))
        .then(s => setStoryGroups(s))
        .catch(() => null);
    });
    return () => {
      unsubLike();
      unsubDelete();
      unsubComment();
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
  const profileInitials = useMemo(() => {
    const source = (dbUser?.displayName || dbUser?.username || dbUser?.email || '').trim();
    if (!source) return '';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }, [dbUser?.displayName, dbUser?.username, dbUser?.email]);

  type HomeFeedItem =
    | {kind: 'post'; post: Post; key: string}
    | {kind: 'suggestions'; key: string}
    | {kind: 'stories'; key: string}
    | {kind: 'trendingReels'; key: string}
    | {kind: 'ad'; ad: Ad; key: string};

  const feedItems = useMemo((): HomeFeedItem[] => {
    const items: HomeFeedItem[] = [];
    items.push({kind: 'stories', key: 'stories'});
    if (activeCategory === 'home' && trendingReels.length > 0) {
      items.push({kind: 'trendingReels', key: 'trending-reels'});
    }
    posts.forEach((p, idx) => {
      items.push({kind: 'post', post: p, key: `post-${p._id}`});
      if (idx === 0 && suggestions.length > 0) {
        items.push({kind: 'suggestions', key: 'suggestions'});
      }
    });
    if (feedAds.length > 0) {
      const postIndices = items.map((item, idx) => (item.kind === 'post' ? idx : -1)).filter(idx => idx !== -1);
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
  }, [activeCategory, trendingReels, posts, suggestions, feedAds]);

  useEffect(() => {
    if (feedAds.length > 0) prefetchAdMedia(feedAds);
  }, [feedAds]);

  useEffect(() => {
    if (storyAds.length > 0) prefetchAdMedia(storyAds);
  }, [storyAds]);

  return (
    <ThemedSafeScreen edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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
                source={{uri: brandIconUri}}
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
              {contract.branding.appTitle || 'BROMO'}
            </ThemedText>
            <SearchBar
              style={{flex: 1, minWidth: 0}}
              placeholder="Search BROMO..."
              value={homeSearchQuery}
              onChangeText={setHomeSearchQuery}
              autoFocus
              onSubmitEditing={() => {
                const q = homeSearchQuery.trim() || 'bromo';
                parentNavigate(navigation, 'SearchResults', {query: q});
                collapseSearch();
              }}
            />
            <Pressable onPress={collapseSearch} hitSlop={14} style={{padding: 6, marginLeft: 10}}>
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
                gap: 12,
              }}>
              {/* {brandIconUri ? (
                <Image
                  source={{uri: brandIconUri}}
                  style={{
                    width: 44,
                    height: 44,
                    // borderRadius: 10,
                    // backgroundColor: palette.surface,
                    // borderWidth: 1,
                    // borderColor: palette.border,
                  }}
                  resizeMode="contain"
                />
              ) : null} */}
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
                {contract.branding.appTitle || 'BROMO'}
              </ThemedText>
            </View>
            <View style={{flex: 1, minWidth: 16}} />
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
              <View style={{position: 'relative'}}>
                <Pressable hitSlop={12} onPress={() => parentNavigate(navigation, 'Notifications')}>
                  <Bell size={22} color={palette.foreground} />
                </Pressable>
                <HeaderBadge count={notificationUnread} />
              </View>
              <View style={{position: 'relative'}}>
                <Pressable hitSlop={12} onPress={() => parentNavigate(navigation, 'MessagesFlow')}>
                  <MessageCircle size={22} color={palette.foreground} />
                </Pressable>
                <HeaderBadge count={messagesUnread} />
              </View>
              <Pressable
                onPress={() => parentNavigate(navigation, 'Profile')}
                hitSlop={10}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: 1,
                  borderColor: palette.border,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: palette.muted,
                }}>
                {myAvatar ? (
                  <Image source={{uri: myAvatarResolved || myAvatar}} style={{width: 38, height: 38, borderRadius: 19}} />
                ) : (
                  <Text
                    style={{
                      color: palette.foreground,
                      fontSize: 13,
                      fontWeight: '700',
                    }}>
                    {profileInitials}
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 10, gap: 8}}
        style={{borderBottomWidth: 1, borderBottomColor: palette.border, maxHeight: 54, minHeight: 54}}>
        {CATEGORIES.map(cat => {
          const CatIcon = cat.Icon;
          const chipOn = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: chipRadius, borderWidth: 1,
                borderColor: chipOn ? palette.primary : palette.border,
                backgroundColor: chipOn ? palette.primary : palette.background,
              }}>
              <CatIcon size={15} color={chipOn ? palette.primaryForeground : palette.foreground} />
              <Text style={{fontSize: 12, fontWeight: '700', color: chipOn ? palette.primaryForeground : palette.foreground}}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: tabBarHeight + 16}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          viewabilityConfig={feedViewabilityConfig}
          onViewableItemsChanged={onFeedViewableItemsChanged}
          ListEmptyComponent={
            <View style={{alignItems: 'center', paddingTop: 80}}>
              <Users size={48} color={palette.foregroundFaint} />
              <ThemedText variant="body" style={{marginTop: 16, textAlign: 'center', paddingHorizontal: 32}}>
                Follow people to see their posts here
              </ThemedText>
              <Pressable
                onPress={() => parentNavigate(navigation, 'Search')}
                style={{
                  marginTop: 20, backgroundColor: palette.primary,
                  borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28,
                }}>
                <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 14}}>
                  Discover People
                </Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={palette.primary} style={{marginVertical: 20}} />
            ) : null
          }
          renderItem={({item}) => {
            if (item.kind === 'stories') {
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingHorizontal: 14, paddingVertical: 14, gap: 16}}
                  style={{borderBottomWidth: 1, borderBottomColor: palette.border}}>
                  {/* Own story */}
                  <Pressable
                    style={{alignItems: 'center', gap: 5}}
                    onPress={() => parentNavigate(navigation, 'CreateFlow', {mode: 'story'})}>
                    <View style={{position: 'relative'}}>
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
                    <ThemedText variant="caption" style={{maxWidth: 64}} numberOfLines={1}>Your Story</ThemedText>
                  </Pressable>

                  {/* Sponsored story — appears right after user's own story */}
                  {storyAds.length > 0 && (
                    <Pressable
                      style={{alignItems: 'center', gap: 5}}
                      onPress={() => setActiveStoryAd(storyAds[0])}>
                      <View style={{position: 'relative'}}>
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
                            <Text style={{color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.5}}>AD</Text>
                          </View>
                        </View>
                      </View>
                      <ThemedText variant="caption" style={{maxWidth: 64}} numberOfLines={1}>Sponsored</ThemedText>
                    </Pressable>
                  )}

                  {/* Following stories */}
                  {storyTrayEntries.map(({group, ringUriResolved, allSeen}) => (
                    <Pressable
                      key={
                        group.isPromoted && group.promotionId
                          ? `story-promo-${group.promotionId}`
                          : `story-${group.author._id}`
                      }
                      style={{alignItems: 'center', gap: 5}}
                      onPress={() => parentNavigate(navigation, 'StoryView', {userId: group.author._id})}>
                      <View style={{position: 'relative'}}>
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
                              <Text style={{color: palette.primaryForeground, fontSize: 8, fontWeight: '900'}}>
                                Ad
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText variant="caption" style={{maxWidth: 64}} numberOfLines={1}>
                        {group.author.username}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              );
            }

            if (item.kind === 'trendingReels') {
              return (
                <View style={{borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 14}}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 14,
                      paddingTop: 10,
                      paddingBottom: 10,
                    }}>
                    <ThemedText variant="heading" style={{fontSize: 15, fontWeight: '800'}}>
                      Trending Reels
                    </ThemedText>
                    <Pressable onPress={() => parentNavigate(navigation, 'Reels')} hitSlop={8}>
                      <Text style={{color: palette.primary, fontWeight: '800', fontSize: 12}}>SEE MORE</Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{paddingHorizontal: 14, gap: 10}}>
                    {trendingReels.map(reel => {
                      const thumb = postThumbnailUri(reel);
                      return (
                        <Pressable
                          key={reel._id}
                          onPress={() => {
                            recordView(reel._id, 0).catch(() => null);
                            parentNavigate(navigation, 'Reels', {initialPostId: reel._id});
                          }}
                          style={{width: 118}}>
                          <View style={{position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: palette.surface}}>
                            <Image
                              source={{uri: thumb}}
                              style={{width: '100%', aspectRatio: 9 / 16, backgroundColor: palette.muted}}
                              resizeMode="cover"
                            />
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
                              <Text style={{color: '#fff', fontSize: 11, fontWeight: '800'}}>
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
                <View style={{paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <Users size={16} color={palette.primary} />
                      <ThemedText variant="heading" style={{fontSize: 14}}>People You May Know</ThemedText>
                    </View>
                    <Pressable onPress={() => parentNavigate(navigation, 'Search')}>
                      <ThemedText variant="primary" style={{fontSize: 11, fontWeight: '700'}}>See All</ThemedText>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{paddingHorizontal: 14, gap: 12}}>
                    {suggestions.map(s => (
                      <SuggestionCard
                        key={s._id}
                        user={s}
                        onFollowToggle={() => {}}
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
      )}

      {/* Story ad full-screen viewer */}
      {activeStoryAd && (
        <AdStoryViewer
          ad={activeStoryAd}
          visible={activeStoryAd !== null}
          onClose={() => setActiveStoryAd(null)}
        />
      )}
    </ThemedSafeScreen>
  );
}
