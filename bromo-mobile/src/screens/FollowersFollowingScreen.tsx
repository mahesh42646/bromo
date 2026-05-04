import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {Screen} from '../components/ui/Screen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getFollowers, getFollowing, type SuggestedUser} from '../api/followApi';
import {RelationButton} from '../components/relations/RelationButton';
import {RefreshableFlatList} from '../components/ui/RefreshableFlatList';

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
  const {palette} = useTheme();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listTotal, setListTotal] = useState<number | null>(null);

  const load = useCallback(async (targetPage: number, reset = false) => {
    try {
      const res = tab === 'followers'
        ? await getFollowers(userId, targetPage)
        : await getFollowing(userId, targetPage);
      if (reset) {
        setUsers(res.users);
        setPage(2);
        if (typeof res.total === 'number') setListTotal(res.total);
      } else {
        setUsers(prev => [...prev, ...res.users]);
        setPage(targetPage + 1);
      }
      setHasMore(res.hasMore);
    } catch {}
  }, [userId, tab]);

  useEffect(() => {
    setLoading(true);
    load(1, true).finally(() => setLoading(false));
  }, [load]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(page, false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, load, page]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(1, true);
    setRefreshing(false);
  }, [load]);

  const title =
    (tab === 'followers' ? 'Followers' : 'Following') +
    (listTotal != null ? ` (${listTotal})` : '');

  return (
    <Screen title={title}>
      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <RefreshableFlatList
          data={users}
          keyExtractor={u => u._id}
          contentContainerStyle={{paddingVertical: 8}}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={{textAlign: 'center', color: palette.mutedForeground, marginTop: 40}}>
              No {tab} yet
            </Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null}
          renderItem={({item}) => {
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
                <RelationButton
                  row={item}
                  mode={tab}
                  followSource={{kind: 'profile', refId: userId}}
                  onChange={(changedUserId, next) => {
                    setUsers(prev => prev.map(u => u._id === changedUserId ? {
                      ...u,
                      followStatus: next,
                      relation: {...(u.relation ?? {iFollow: false, followsMe: false, isMe: false}), iFollow: next === 'following'},
                    } : u));
                  }}
                />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

