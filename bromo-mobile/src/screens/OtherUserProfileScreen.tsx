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
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getUserProfile, followUser, unfollowUser, type UserProfile} from '../api/followApi';
import {getUserPosts, type Post} from '../api/postsApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'OtherUserProfile'>;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function OtherUserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId} = route.params;
  const {palette, contract} = useTheme();
  const {borderRadiusScale} = contract.brandGuidelines;
  const btnR = borderRadiusScale === 'bold' ? 999 : 8;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'requested'>('none');

  const load = useCallback(async () => {
    try {
      const res = await getUserProfile(userId);
      setProfile(res.user);
      setFollowStatus(res.user.followStatus ?? 'none');
    } catch {}
  }, [userId]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await getUserPosts(userId, 'post', 1);
      setPosts(res.posts);
    } catch {}
    setLoadingPosts(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([load(), loadPosts()]).finally(() => setLoading(false));
  }, [load, loadPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadPosts()]);
    setRefreshing(false);
  }, [load, loadPosts]);

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
                {label: 'Posts', value: formatCount(profile.postsCount ?? 0)},
                {label: 'Followers', value: formatCount(profile.followersCount)},
                {label: 'Following', value: formatCount(profile.followingCount)},
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
              onPress={() => navigation.getParent()?.navigate('MessagesFlow')}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: btnR,
                backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <MessageCircle size={14} color={palette.foreground} />
              <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}}>Message</Text>
            </Pressable>
          </View>
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
                <Image source={{uri: post.mediaUrl}} style={{width: '100%', height: '100%'}} resizeMode="cover" />
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
