import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Pressable, Switch, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Phone, Video as VideoIcon} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';
import {getNotifications, markAllRead, markRead, type AppNotification} from '../../../api/notificationsApi';

export {EditProfileScreen} from '../../EditProfileScreen';
export {OtherUserProfileScreen} from '../../OtherUserProfileScreen';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export {ShareProfileScreen} from '../../ShareProfileScreen';

export {FollowersFollowingScreen} from '../../FollowersFollowingScreen';

export function PointsWalletScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Points wallet">
      <SopMeta label="Earn → spend → redeem; coins convert to ad credits (simulated)." />
      <SopRow title="Transaction history" onPress={() => navigation.navigate('TransactionHistory')} />
    </SopChrome>
  );
}

export function TransactionHistoryScreen() {
  return (
    <SopChrome title="Transactions">
      <SopRow title="Watch reward +12" sub="Today" />
      <SopRow title="Store redemption −80 coins" sub="Yesterday" />
    </SopChrome>
  );
}

export function SavedPostsScreen() {
  return (
    <SopChrome title="Saved posts">
      <SopMeta label="Bookmarked feed & reels." />
    </SopChrome>
  );
}

export function WatchHistoryScreen() {
  return (
    <SopChrome title="Watch history">
      <SopMeta label="Reels watched for rewards accounting." />
    </SopChrome>
  );
}

export function ManageContentScreen() {
  return (
    <SopChrome title="Manage content">
      <SopRow title="Archive" />
      <SopRow title="Insights per post" />
    </SopChrome>
  );
}

export function ContentInsightsScreen() {
  return (
    <SopChrome title="Content insights">
      <SopMeta label="Reach, profile visits, link taps." />
    </SopChrome>
  );
}

export function CreatorDashboardScreen() {
  return (
    <SopChrome title="Creator dashboard">
      <SopMeta label="Growth, top reels, affiliate products performance." />
    </SopChrome>
  );
}

export function ReferralDashboardScreen() {
  return (
    <SopChrome title="Referrals">
      <SopMeta label="Invite friends — milestones & rewards." />
    </SopChrome>
  );
}

function notifIcon(type: AppNotification['type']): string {
  switch (type) {
    case 'like': return '❤️';
    case 'comment': return '💬';
    case 'follow': return '👤';
    case 'follow_request': return '🔔';
    case 'follow_accept': return '✅';
    case 'mention': return '@';
    case 'message': return '✉️';
    case 'milestone': return '🏆';
    default: return '🔔';
  }
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const res = await getNotifications(p, tab === 'unread');
      if (reset) {
        setItems(res.notifications);
        setPage(2);
      } else {
        setItems(prev => [...prev, ...res.notifications]);
        setPage(p + 1);
      }
      setHasMore(res.hasMore);
    } catch {}
  }, [page, tab]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(true).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, load]);

  const onMarkAllRead = useCallback(async () => {
    await markAllRead();
    setItems(prev => prev.map(n => ({...n, read: true})));
  }, []);

  const onPressItem = useCallback(async (n: AppNotification) => {
    if (!n.read) {
      await markRead(n._id);
      setItems(prev => prev.map(x => x._id === n._id ? {...x, read: true} : x));
    }
    if (n.postId) {
      navigation.navigate('PostDetail', {postId: n.postId});
    } else if (n.actorId) {
      navigation.navigate('OtherUserProfile', {userId: n.actorId._id});
    }
  }, [navigation]);

  return (
    <View style={{flex: 1, backgroundColor: palette.background}}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 20, fontWeight: '900'}}>Notifications</Text>
        <Pressable onPress={onMarkAllRead} hitSlop={8}>
          <Text style={{color: palette.primary, fontSize: 13, fontWeight: '700'}}>Mark all read</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={{flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10}}>
        {(['all', 'unread'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: tab === t ? palette.primary : palette.input,
            }}>
            <Text style={{color: tab === t ? palette.primaryForeground : palette.foreground, fontWeight: '800', fontSize: 13}}>
              {t === 'all' ? 'All' : 'Unread'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n._id}
          contentContainerStyle={{paddingBottom: 32}}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={{textAlign: 'center', color: palette.mutedForeground, paddingTop: 60, fontSize: 15}}>
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null
          }
          renderItem={({item}) => {
            const avatar = item.actorId?.profilePicture ||
              `https://ui-avatars.com/api/?name=${item.actorId?.displayName ?? 'B'}`;
            return (
              <Pressable
                onPress={() => onPressItem(item)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 12,
                  backgroundColor: item.read ? 'transparent' : `${palette.primary}12`,
                  borderBottomWidth: 1, borderBottomColor: palette.border,
                }}>
                <View style={{position: 'relative'}}>
                  <Image
                    source={{uri: avatar}}
                    style={{width: 46, height: 46, borderRadius: 23}}
                  />
                  <View style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: palette.background,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{fontSize: 11}}>{notifIcon(item.type)}</Text>
                  </View>
                </View>
                <View style={{flex: 1}}>
                  <Text style={{color: palette.foreground, fontSize: 14, lineHeight: 20}}>
                    {item.actorId && (
                      <Text style={{fontWeight: '800'}}>{item.actorId.username} </Text>
                    )}
                    <Text style={{fontWeight: item.read ? '400' : '600'}}>{item.message}</Text>
                  </Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 3}}>
                    {timeAgo(item.createdAt)}
                  </Text>
                </View>
                {!item.read && (
                  <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary}} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

export function NotificationSettingsScreen() {
  const {palette} = useTheme();
  const [push, setPush] = useState(true);
  return (
    <SopChrome title="Notification settings">
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: palette.foreground}}>Push notifications</Text>
        <Switch value={push} onValueChange={setPush} />
      </View>
    </SopChrome>
  );
}

export function VoiceCallScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'VoiceCall'>>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Voice call" scroll={false}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20}}>
        <Phone size={64} color={palette.primary} />
        <Text style={{fontWeight: '800', color: palette.foreground, fontSize: 18}}>{route.params.peerName}</Text>
        <Text style={{color: palette.mutedForeground}}>Ringing...</Text>
        <PrimaryButton label="End call" onPress={() => Alert.alert('Call ended')} variant="outline" />
      </View>
    </SopChrome>
  );
}

export function VideoCallScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'VideoCall'>>();
  const {palette} = useTheme();
  return (
    <SopChrome title="Video call" scroll={false}>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20}}>
        <VideoIcon size={64} color={palette.primary} />
        <Text style={{fontWeight: '800', color: palette.foreground, fontSize: 18}}>{route.params.peerName}</Text>
        <Text style={{color: palette.mutedForeground}}>Connecting video...</Text>
        <PrimaryButton label="End call" onPress={() => Alert.alert('Call ended')} variant="outline" />
      </View>
    </SopChrome>
  );
}

export function AutoDmScreen() {
  const {palette} = useTheme();
  return (
    <SopChrome title="Auto DM">
      <SopMeta label="Admin-triggered automated messages sent on events like signup, store promotions, or event alerts." />
      <View style={{gap: 12}}>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Welcome message</Text>
          <Text style={{color: palette.foreground}}>Welcome to BROMO! Start exploring stores and earn points by watching reels.</Text>
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>Trigger: On signup</Text>
        </View>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Store promotion</Text>
          <Text style={{color: palette.foreground}}>Flash sale at Coffee Republic — 50% off today only!</Text>
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>Trigger: 3KM proximity</Text>
        </View>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Event alert</Text>
          <Text style={{color: palette.foreground}}>New music release — trending audio in your city. Use it in your next reel!</Text>
          <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 6}}>Trigger: Admin broadcast</Text>
        </View>
      </View>
    </SopChrome>
  );
}

export function CallHistoryScreen() {
  return (
    <SopChrome title="Call history">
      <SopRow title="Missed · priya_vibes" />
      <SopRow title="Outgoing · tech_marathi" />
    </SopChrome>
  );
}

export function MusicLibraryScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Music library">
      <SopMeta label="Mood/category browse; admin-managed catalogue." />
      <SopRow title="Trending" onPress={() => navigation.navigate('AudioDetail', {trackId: 'trend1'})} />
      <SopRow title="Regional" />
    </SopChrome>
  );
}

export function AudioDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'AudioDetail'>>();
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Track">
      <SopMeta label={`${route.params.trackId} — reels using audio; credit original creator.`} />
      <PrimaryButton
        label="Use for reel"
        onPress={() => navigation.navigate('ReuseAudio', {audioId: route.params.trackId})}
      />
    </SopChrome>
  );
}
