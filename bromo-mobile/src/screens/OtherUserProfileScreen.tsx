import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Modal,
  Pressable,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck, Ban, Clapperboard, Flag, Grid3x3, MessageCircle, MoreHorizontal, Play, Share2, UserMinus} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {RefreshableScrollView, Screen, SegmentedTabs} from '../components/ui';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {
  blockUser,
  getUserMutuals,
  getUserProfile,
  followUser,
  removeFollower,
  reportUser,
  unblockUser,
  unfollowUser,
  type SuggestedUser,
  type UserProfile,
} from '../api/followApi';
import {getUserGridStats, getUserPosts, type Post, type UserGridStats} from '../api/postsApi';
import {useMessaging} from '../messaging/MessagingContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {ProfileGridMedia} from '../components/profile/ProfileGridMedia';
import {peekAuthorSnapshot} from '../lib/authorSessionCache';
import {
  getOtherUserProfileBundle,
  invalidateOtherUserProfile,
  rememberOtherUserProfileBundle,
} from '../lib/otherUserProfileSessionCache';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'OtherUserProfile'>;
type GridTab = 'posts' | 'reels';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function profileFromAuthorPeek(userId: string): UserProfile | null {
  const a = peekAuthorSnapshot(userId);
  if (!a) return null;
  return {
    _id: userId,
    username: a.username ?? '',
    displayName: a.displayName ?? 'User',
    profilePicture: a.profilePicture ?? '',
    bio: '',
    website: '',
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    isPrivate: false,
    emailVerified: false,
    followStatus: 'none',
  };
}

export function OtherUserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId} = route.params;
  const {palette, guidelines} = useTheme();
  const {dbUser} = useAuth();
  const {openThreadForUser} = useMessaging();
  const {borderRadiusScale} = guidelines;
  const btnR = borderRadiusScale === 'bold' ? 999 : 8;
  const isSelf = dbUser?._id === userId;
  const [startingChat, setStartingChat] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(() => profileFromAuthorPeek(userId));
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'requested'>('none');
  const [gridStats, setGridStats] = useState<UserGridStats | null>(null);
  const [gridTab, setGridTab] = useState<GridTab>('posts');
  const [mutuals, setMutuals] = useState<{count: number; sample: SuggestedUser[]}>({count: 0, sample: []});
  const [moreOpen, setMoreOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'bromo:followChanged',
      ({userId: changedUserId, following, requested}: {userId: string; following: boolean; requested?: boolean}) => {
        if (String(changedUserId) !== String(userId)) return;
        const next: 'none' | 'following' | 'requested' = requested ? 'requested' : following ? 'following' : 'none';
        setFollowStatus(next);
        setProfile(p => p ? {
          ...p,
          followStatus: next,
          relation: {...(p.relation ?? {iFollow: false, followsMe: false, isMe: false}), iFollow: next === 'following'},
        } : p);
      },
    );
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (isSelf) {
      setMutuals({count: 0, sample: []});
      return;
    }
    let live = true;
    getUserMutuals(userId, 3)
      .then(res => {
        if (live) setMutuals(res);
      })
      .catch(() => {
        if (live) setMutuals({count: 0, sample: []});
      });
    return () => {
      live = false;
    };
  }, [isSelf, userId]);

  const openChat = useCallback(async () => {
    if (!profile) return;
    setStartingChat(true);
    try {
      const convId = await openThreadForUser(
        userId,
        profile.displayName,
        profile.profilePicture ?? '',
        profile.username,
      );
      parentNavigate(navigation, 'MessagesFlow', {
        screen: 'ChatThread',
        params: {peerId: convId},
      });
    } catch {
      parentNavigate(navigation, 'MessagesFlow');
    } finally {
      setStartingChat(false);
    }
  }, [userId, navigation, openThreadForUser, profile]);

  const fetchProfilePage = useCallback(
    async (forceNetwork: boolean) => {
      if (!forceNetwork) {
        const b = getOtherUserProfileBundle(userId);
        if (b) {
          setProfile(b.profile);
          setFollowStatus(b.profile.followStatus ?? 'none');
          setGridStats(b.gridStats);
          setPosts(b.posts);
          return;
        }
      }

      const [res, gridRes, postsRes] = await Promise.allSettled([
        getUserProfile(userId),
        getUserGridStats(userId),
        getUserPosts(userId, 'post', 1),
      ]);

      let prof: UserProfile | null = null;
      if (res.status === 'fulfilled') {
        prof = res.value.user;
        setProfile(res.value.user);
        setFollowStatus(res.value.user.followStatus ?? 'none');
      }

      let grid: UserGridStats | null = null;
      if (gridRes.status === 'fulfilled') {
        grid = gridRes.value;
        setGridStats(grid);
      } else {
        setGridStats(null);
      }

      let plist: Post[] = [];
      if (postsRes.status === 'fulfilled') {
        plist = postsRes.value.posts;
        setPosts(plist);
      }

      if (prof) {
        rememberOtherUserProfileBundle(userId, {profile: prof, gridStats: grid, posts: plist});
      }
    },
    [userId],
  );

  useEffect(() => {
    setProfile(profileFromAuthorPeek(userId));
    setPosts([]);
    setGridStats(null);
    setFollowStatus('none');
    setGridTab('posts');
    setLoading(true);
    setLoadingPosts(true);
    fetchProfilePage(false)
      .catch(() => null)
      .finally(() => {
        setLoading(false);
        setLoadingPosts(false);
      });
  }, [fetchProfilePage, userId]);

  useEffect(() => {
    if (loading) return;
    setLoadingPosts(true);
    getUserPosts(userId, gridTab === 'reels' ? 'reel' : 'post', 1)
      .then(res => setPosts(res.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [gridTab, loading, userId]);

  const onRefresh = useCallback(async () => {
    invalidateOtherUserProfile(userId);
    setRefreshing(true);
    setLoadingPosts(true);
    try {
      await fetchProfilePage(true);
    } finally {
      setRefreshing(false);
      setLoadingPosts(false);
    }
  }, [fetchProfilePage, userId]);

  const handleFollow = async () => {
    try {
      if (followStatus === 'requested') return;
      const res = await followUser(userId, {kind: 'profile', refId: userId});
      const next = res.status === 'pending' ? 'requested' : 'following';
      setFollowStatus(next);
      setProfile(p => p ? {
        ...p,
        followStatus: next,
        followersCount: next === 'following' ? p.followersCount + 1 : p.followersCount,
        relation: {...(p.relation ?? {iFollow: false, followsMe: false, isMe: false}), iFollow: next === 'following'},
      } : p);
    } catch {}
  };

  const handleUnfollow = async () => {
    try {
      await unfollowUser(userId);
      setFollowStatus('none');
      setProfile(p => p ? {
        ...p,
        followStatus: 'none',
        followersCount: Math.max(0, p.followersCount - 1),
        relation: {...(p.relation ?? {iFollow: false, followsMe: false, isMe: false}), iFollow: false},
      } : p);
    } catch {}
  };

  const handleRemoveFollower = async () => {
    try {
      await removeFollower(userId);
      setProfile(p => p ? {
        ...p,
        followsMe: false,
        relation: {...(p.relation ?? {iFollow: followStatus === 'following', followsMe: true, isMe: false}), followsMe: false},
      } : p);
      setMoreOpen(false);
    } catch {}
  };

  const handleBlock = async () => {
    try {
      if (blockedByMe) {
        await unblockUser(userId);
        setBlockedByMe(false);
      } else {
        await blockUser(userId);
        setBlockedByMe(true);
        setFollowStatus('none');
      }
      setMoreOpen(false);
    } catch {}
  };

  const handleReport = async () => {
    try {
      await reportUser(userId, 'profile');
      setMoreOpen(false);
    } catch {}
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    setMoreOpen(false);
    await Share.share({
      message: `https://bromo.app/@${profile.username}`,
      url: `https://bromo.app/@${profile.username}`,
    }).catch(() => null);
  };

  const theyFollowMe = Boolean(profile?.followsMe || profile?.relation?.followsMe);
  const actionIsMessage = followStatus === 'following';
  const followLabel = actionIsMessage ? 'Message' : followStatus === 'requested' ? 'Requested' : theyFollowMe ? 'Follow back' : 'Follow';
  const followBg = actionIsMessage || followStatus === 'requested' ? palette.surface : palette.primary;
  const followTextColor = actionIsMessage || followStatus === 'requested' ? palette.foreground : palette.primaryForeground;

  if (loading) {
    return (
      <Screen title="Profile">
        <StatusBar barStyle="light-content" />
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen title="Profile">
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text style={{color: palette.mutedForeground}}>User not found</Text>
        </View>
      </Screen>
    );
  }

  const avatarUri = profile.profilePicture || `https://ui-avatars.com/api/?name=${profile.displayName}`;

  const numCols = 3;
  const colWidth = `${100 / numCols}%` as const;

  return (
    <Screen
      title={profile.username}
      scroll={false}
      right={
        <Pressable onPress={() => setMoreOpen(true)} hitSlop={12} style={{padding: 8}}>
          <MoreHorizontal size={22} color={palette.foreground} />
        </Pressable>
      }>
      <StatusBar barStyle="light-content" />

      <RefreshableScrollView
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}>

        {/* Profile info */}
        <View style={{padding: 16}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16}}>
            <Image
              source={{uri: avatarUri}}
              style={{width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: palette.primary}}
            />
            <View style={{flex: 1, flexDirection: 'row', justifyContent: 'space-around'}}>
              {[
                {label: 'Posts', value: formatCount(gridStats?.gridTotal ?? profile.postsCount ?? 0)},
                {label: 'Followers', value: formatCount(profile.followersCount ?? 0)},
                {label: 'Following', value: formatCount(profile.followingCount ?? 0)},
              ].map(s => (
                <Pressable
                  key={s.label}
                  onPress={() => {
                    if (s.label === 'Followers' || s.label === 'Following') {
                      navigation.navigate('FollowersFollowing', {
                        userId,
                        tab: s.label.toLowerCase() as 'followers' | 'following',
                      });
                    }
                  }}
                  style={{alignItems: 'center'}}>
                  <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>{s.value}</Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 12}}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Name + bio */}
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4}}>
            <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>{profile.displayName}</Text>
            {(profile.isVerified || profile.verificationStatus === 'verified') && (
              <BadgeCheck size={15} color={palette.primary} fill={palette.primary} strokeWidth={2} />
            )}
          </View>
          {profile.bio ? (
            <Text style={{color: palette.foreground, fontSize: 13, lineHeight: 18, marginBottom: 4}}>{profile.bio}</Text>
          ) : null}
          {profile.website ? (
            <Text style={{color: palette.primary, fontSize: 13, marginBottom: 4}}>{profile.website}</Text>
          ) : null}
          {mutuals.count > 0 ? (
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8}}>
              <View style={{width: Math.min(mutuals.sample.length, 3) * 18 + 12, height: 28}}>
                {mutuals.sample.slice(0, 3).map((u, idx) => (
                  <Image
                    key={u._id}
                    source={{uri: u.profilePicture || `https://ui-avatars.com/api/?name=${u.displayName}`}}
                    style={{
                      position: 'absolute',
                      left: idx * 18,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: palette.background,
                    }}
                  />
                ))}
              </View>
              <Text style={{flex: 1, color: palette.mutedForeground, fontSize: 12}} numberOfLines={2}>
                Followed by {mutuals.sample.map(u => u.displayName || u.username).slice(0, 2).join(', ')}
                {mutuals.count > mutuals.sample.length ? ` and ${mutuals.count - mutuals.sample.length} others` : ''}
              </Text>
            </View>
          ) : null}

          {/* Action buttons */}
          {isSelf ? (
            <Pressable
              onPress={() => parentNavigate(navigation, 'EditProfile')}
              style={{
                marginTop: 12, paddingVertical: 9, borderRadius: btnR,
                backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
                alignItems: 'center',
              }}>
              <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}}>Edit Profile</Text>
            </Pressable>
          ) : (
            <View style={{flexDirection: 'row', gap: 8, marginTop: 12}}>
              <Pressable
                onPress={actionIsMessage ? openChat : handleFollow}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: btnR,
                  backgroundColor: followBg,
                  borderWidth: actionIsMessage || followStatus === 'requested' ? 1 : 0,
                  borderColor: palette.border,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}>
                {actionIsMessage ? <MessageCircle size={14} color={palette.foreground} /> : null}
                <Text style={{color: followTextColor, fontWeight: '700', fontSize: 13}}>{followLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => setMoreOpen(true)}
                style={{
                  width: 44, paddingVertical: 9, borderRadius: btnR,
                  backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: startingChat ? 0.6 : 1,
                }}>
                <MoreHorizontal size={18} color={palette.foreground} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Tab indicator */}
        <SegmentedTabs
          items={[
            {label: 'Posts', value: 'posts' as const, icon: <Grid3x3 size={18} color={gridTab === 'posts' ? palette.primary : palette.mutedForeground} />},
            {label: 'Reels', value: 'reels' as const, icon: <Clapperboard size={18} color={gridTab === 'reels' ? palette.primary : palette.mutedForeground} />},
          ]}
          value={gridTab}
          onChange={setGridTab}
          variant="underline"
          style={{borderTopWidth: 1, borderTopColor: palette.border}}
        />

        {/* Posts grid */}
        {loadingPosts ? (
          <View style={{padding: 40, alignItems: 'center'}}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={{padding: 40, alignItems: 'center'}}>
            <Text style={{color: palette.mutedForeground, textAlign: 'center'}}>No posts yet</Text>
          </View>
        ) : (
          <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
            {posts.map(post => (
              <Pressable
                key={post._id}
                onPress={() => navigation.navigate('PostDetail', {postId: post._id})}
                style={{width: colWidth, aspectRatio: 1, padding: 1}}>
                <ProfileGridMedia post={post} style={{width: '100%', height: '100%'}} />
                {post.mediaType === 'video' ? (
                  <View style={{position: 'absolute', top: 6, right: 6}}>
                    <Play size={14} color="#fff" fill="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <View style={{height: 40}} />
      </RefreshableScrollView>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable
          onPress={() => setMoreOpen(false)}
          style={{flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'}}>
          <Pressable
            onPress={event => event.stopPropagation()}
            style={{
              backgroundColor: palette.background,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderWidth: 1,
              borderColor: palette.border,
              padding: 16,
              gap: 8,
            }}>
            <MoreRow icon={<Share2 size={18} color={palette.foreground} />} label="Share profile" onPress={handleShareProfile} />
            {theyFollowMe ? (
              <MoreRow icon={<UserMinus size={18} color={palette.foreground} />} label="Remove follower" onPress={handleRemoveFollower} />
            ) : null}
            {followStatus === 'following' || followStatus === 'requested' ? (
              <MoreRow icon={<UserMinus size={18} color={palette.foreground} />} label="Unfollow" onPress={() => { setMoreOpen(false); handleUnfollow(); }} />
            ) : null}
            <MoreRow icon={<Flag size={18} color={palette.foreground} />} label="Report" onPress={handleReport} />
            <MoreRow
              icon={<Ban size={18} color={palette.destructive} />}
              label={blockedByMe ? 'Unblock' : 'Block'}
              danger={!blockedByMe}
              onPress={handleBlock}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function MoreRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 10,
        paddingHorizontal: 12,
      }}>
      {icon}
      <Text style={{color: danger ? palette.destructive : palette.foreground, fontWeight: '700', fontSize: 15}}>
        {label}
      </Text>
    </Pressable>
  );
}
