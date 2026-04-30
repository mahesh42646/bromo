import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck, ChevronLeft} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getFollowers, getFollowing, followUser, unfollowUser, type SuggestedUser} from '../api/followApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'FollowersFollowing'>;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type UserRow = SuggestedUser & {followStatus?: 'none' | 'following' | 'requested'};

export function FollowersFollowingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, tab} = route.params;
  const {palette, contract} = useTheme();
  const {borderRadiusScale} = contract.brandGuidelines;
  const btnR = borderRadiusScale === 'bold' ? 999 : 8;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const res = tab === 'followers'
        ? await getFollowers(userId, p)
        : await getFollowing(userId, p);
      if (reset) {
        setUsers(res.users);
        setPage(2);
      } else {
        setUsers(prev => [...prev, ...res.users]);
        setPage(p + 1);
      }
      setHasMore(res.hasMore);
    } catch {}
  }, [userId, tab, page]);

  useEffect(() => {
    setLoading(true);
    load(true).finally(() => setLoading(false));
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, load]);

  const handleFollow = async (user: UserRow, idx: number) => {
    const current = user.followStatus ?? 'none';
    try {
      if (current === 'following' || current === 'requested') {
        await unfollowUser(user._id);
        setUsers(prev => prev.map((u, i) => i === idx ? {...u, followStatus: 'none'} : u));
      } else {
        const res = await followUser(user._id);
        const next = res.status === 'pending' ? 'requested' : 'following';
        setUsers(prev => prev.map((u, i) => i === idx ? {...u, followStatus: next} : u));
      }
    } catch {}
  };

  return (
    <ThemedSafeScreen>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: palette.border, gap: 4,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 17, fontWeight: '800'}}>
          {tab === 'followers' ? 'Followers' : 'Following'}
        </Text>
      </View>

      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u._id}
          contentContainerStyle={{paddingVertical: 8}}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={{textAlign: 'center', color: palette.mutedForeground, marginTop: 40}}>
              No {tab} yet
            </Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null}
          renderItem={({item, index}) => {
            const fs = item.followStatus ?? 'none';
            const avatarUri = item.profilePicture || `https://ui-avatars.com/api/?name=${item.displayName}`;
            return (
              <Pressable
                onPress={() => navigation.navigate('OtherUserProfile', {userId: item._id})}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 10, gap: 12,
                }}>
                <Image source={{uri: avatarUri}} style={{width: 50, height: 50, borderRadius: 25}} />
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                    <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14}}>
                      {item.displayName}
                    </Text>
                    {(item.isVerified || item.verificationStatus === 'verified') && (
                      <BadgeCheck size={13} color={palette.primary} fill={palette.primary} strokeWidth={2} />
                    )}
                  </View>
                  <Text style={{color: palette.mutedForeground, fontSize: 12}}>@{item.username}</Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 11}}>
                    {formatCount(item.followersCount)} followers
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleFollow(item, index)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 7, borderRadius: btnR,
                    backgroundColor: fs === 'none' ? palette.primary : 'transparent',
                    borderWidth: 1, borderColor: palette.primary,
                  }}>
                  <Text style={{
                    color: fs === 'none' ? palette.primaryForeground : palette.primary,
                    fontWeight: '700', fontSize: 12,
                  }}>
                    {fs === 'following' ? 'Following' : fs === 'requested' ? 'Requested' : 'Follow'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </ThemedSafeScreen>
  );
}
