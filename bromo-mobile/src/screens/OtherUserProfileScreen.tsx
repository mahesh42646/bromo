import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck, ChevronLeft, Grid3x3, MessageCircle, MoreHorizontal, Play} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getUserProfile, followUser, unfollowUser, type UserProfile} from '../api/followApi';
import {getUserGridStats, getUserPosts, type Post, type UserGridStats} from '../api/postsApi';
import {useMessaging} from '../messaging/MessagingContext';
import {parentNavigate} from '../navigation/parentNavigate';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {peekAuthorSnapshot} from '../lib/authorSessionCache';
import {
  getOtherUserProfileBundle,
  invalidateOtherUserProfile,
  rememberOtherUserProfileBundle,
} from '../lib/otherUserProfileSessionCache';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'OtherUserProfile'>;

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
  const {palette, contract} = useTheme();
  const {dbUser} = useAuth();
  const {openThreadForUser} = useMessaging();
  const {borderRadiusScale} = contract.brandGuidelines;
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
    setLoading(true);
    setLoadingPosts(true);
    fetchProfilePage(false)
      .catch(() => null)
      .finally(() => {
        setLoading(false);
        setLoadingPosts(false);
      });
  }, [fetchProfilePage]);

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
      if (followStatus === 'following' || followStatus === 'requested') {
        await unfollowUser(userId);
        setFollowStatus('none');
        setProfile(p => p ? {...p, followersCount: Math.max(0, p.followersCount - 1)} : p);
      } else {
        const res = await followUser(userId);
        const next = res.status === 'pending' ? 'requested' : 'following';
        setFollowStatus(next);
        if (next === 'following') {
          setProfile(p => p ? {...p, followersCount: p.followersCount + 1} : p);
        }
      }
    } catch {}
  };

  const followLabel = followStatus === 'following' ? 'Following' : followStatus === 'requested' ? 'Requested' : 'Follow';
  const followBg = followStatus === 'none' ? palette.primary : 'transparent';
  const followTextColor = followStatus === 'none' ? palette.primaryForeground : palette.primary;

  if (loading) {
    return (
      <ThemedSafeScreen>
        <StatusBar barStyle="light-content" />
        <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8}}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
            <ChevronLeft size={26} color={palette.foreground} />
          </Pressable>
        </View>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      </ThemedSafeScreen>
    );
  }

  if (!profile) {
    return (
      <ThemedSafeScreen>
        <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8}}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
            <ChevronLeft size={26} color={palette.foreground} />
          </Pressable>
        </View>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text style={{color: palette.mutedForeground}}>User not found</Text>
        </View>
      </ThemedSafeScreen>
    );
  }

  const avatarUri = profile.profilePicture || `https://ui-avatars.com/api/?name=${profile.displayName}`;

  const numCols = 3;
  const colWidth = `${100 / numCols}%` as const;

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: palette.border,
        gap: 4,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 17, fontWeight: '800'}}>
          {profile.username}
        </Text>
        <Pressable hitSlop={12} style={{padding: 8}}>
          <MoreHorizontal size={22} color={palette.foreground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}>

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
            {profile.emailVerified && <BadgeCheck size={15} color={palette.primary} fill={palette.primary} strokeWidth={2} />}
          </View>
          {profile.bio ? (
            <Text style={{color: palette.foreground, fontSize: 13, lineHeight: 18, marginBottom: 4}}>{profile.bio}</Text>
          ) : null}
          {profile.website ? (
            <Text style={{color: palette.primary, fontSize: 13, marginBottom: 4}}>{profile.website}</Text>
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
                onPress={handleFollow}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: btnR,
                  backgroundColor: followBg,
                  borderWidth: followStatus === 'none' ? 0 : 1,
                  borderColor: palette.primary,
                  alignItems: 'center',
                }}>
                <Text style={{color: followTextColor, fontWeight: '700', fontSize: 13}}>{followLabel}</Text>
              </Pressable>
              <Pressable
                onPress={openChat}
                disabled={startingChat}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: btnR,
                  backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: startingChat ? 0.6 : 1,
                }}>
                <MessageCircle size={14} color={palette.foreground} />
                <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}}>Message</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Tab indicator */}
        <View style={{flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border}}>
          <View style={{flex: 1, alignItems: 'center', paddingVertical: 10, borderTopWidth: 2, borderTopColor: palette.primary}}>
            <Grid3x3 size={20} color={palette.primary} />
          </View>
        </View>

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
                <Image source={{uri: postThumbnailUri(post)}} style={{width: '100%', height: '100%'}} resizeMode="cover" />
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
      </ScrollView>
    </ThemedSafeScreen>
  );
}
