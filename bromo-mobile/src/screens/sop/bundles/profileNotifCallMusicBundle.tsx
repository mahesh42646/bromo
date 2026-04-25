import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, Switch, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BarChart2, Eye, Heart, MessageCircle, Phone, Send, TrendingUp, Video as VideoIcon} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {ThemedSafeScreen} from '../../../components/ui/ThemedSafeScreen';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';
import {getNotifications, markAllRead, markRead, type AppNotification} from '../../../api/notificationsApi';
import {getPost, getPostAnalytics, getUserPosts, type Post, type PostAnalytics} from '../../../api/postsApi';
import {useAuth} from '../../../context/AuthContext';

export {EditProfileScreen} from '../../EditProfileScreen';
export {OtherUserProfileScreen} from '../../OtherUserProfileScreen';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export {ShareProfileScreen} from '../../ShareProfileScreen';

export {FollowersFollowingScreen} from '../../FollowersFollowingScreen';

// PointsWalletScreen is now the real WalletScreen — see screens/WalletScreen.tsx
// Re-exported here only so the existing bundle import still compiles.
export {WalletScreen as PointsWalletScreen} from '../../WalletScreen';

export function TransactionHistoryScreen() {
  const navigation = useNavigation<Nav>();
  // Redirect to the real wallet screen
  React.useEffect(() => {
    navigation.replace('PointsWallet');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
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

function fmtMs(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatCard({icon, label, value, palette}: {icon: React.ReactNode; label: string; value: string; palette: ReturnType<typeof useTheme>['palette']}) {
  return (
    <View style={{flex: 1, backgroundColor: palette.input, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: palette.border}}>
      {icon}
      <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>{value}</Text>
      <Text style={{color: palette.foregroundMuted, fontSize: 11, textAlign: 'center'}}>{label}</Text>
    </View>
  );
}

type ContentInsightsRoute = RouteProp<AppStackParamList, 'ContentInsights'>;

export function ContentInsightsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ContentInsightsRoute>();
  const focusPostId = route.params?.focusPostId;
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, PostAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (!dbUser?._id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [postRes, reelRes] = await Promise.all([
          getUserPosts(dbUser._id, 'post', 1).catch(() => ({posts: [] as Post[]})),
          getUserPosts(dbUser._id, 'reel', 1).catch(() => ({posts: [] as Post[]})),
        ]);
        if (cancelled) return;
        const merged = [...postRes.posts, ...reelRes.posts].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        let list = merged;
        if (focusPostId && !list.some(p => p._id === focusPostId)) {
          try {
            const one = await getPost(focusPostId);
            if (String(one.post.author._id) === String(dbUser._id)) {
              list = [one.post, ...list];
            }
          } catch {
            /* ignore */
          }
        }
        setPosts(list);
        if (focusPostId && list.some(p => p._id === focusPostId)) {
          setSelected(focusPostId);
          setLoadingAnalytics(true);
          try {
            const data = await getPostAnalytics(focusPostId);
            if (!cancelled) setAnalytics(prev => ({...prev, [focusPostId]: data}));
          } catch {
            /* ignore */
          }
          if (!cancelled) setLoadingAnalytics(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbUser?._id, focusPostId]);

  const loadAnalytics = useCallback(async (postId: string) => {
    if (analytics[postId]) { setSelected(postId); return; }
    setLoadingAnalytics(true);
    setSelected(postId);
    try {
      const data = await getPostAnalytics(postId);
      setAnalytics(prev => ({...prev, [postId]: data}));
    } catch {}
    setLoadingAnalytics(false);
  }, [analytics]);

  const selectedAnalytics = selected ? analytics[selected] : null;
  const selectedPost = selected ? posts.find(p => p._id === selected) : null;

  return (
    <ThemedSafeScreen>
      {/* Header */}
      <View style={{flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: palette.border}}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{marginRight: 12}}>
          <Text style={{color: palette.primary, fontSize: 15}}>‹</Text>
        </Pressable>
        <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900', flex: 1}}>Content Insights</Text>
        <BarChart2 size={20} color={palette.primary} />
      </View>

      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <ScrollView>
          {/* Selected post analytics */}
          {selected && selectedPost && (
            <View style={{margin: 14, padding: 14, backgroundColor: palette.input, borderRadius: 14, borderWidth: 1, borderColor: palette.border}}>
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
                <Image
                  source={{uri: selectedPost.thumbnailUrl ?? selectedPost.mediaUrl}}
                  style={{width: 56, height: 56, borderRadius: 8, backgroundColor: palette.border}}
                />
                <View style={{flex: 1}}>
                  <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}} numberOfLines={2}>
                    {selectedPost.caption || 'No caption'}
                  </Text>
                  <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 4}}>
                    {selectedPost.type.toUpperCase()}
                  </Text>
                </View>
              </View>

              {loadingAnalytics ? (
                <ActivityIndicator color={palette.primary} />
              ) : selectedAnalytics ? (
                <>
                  <View style={{flexDirection: 'row', gap: 8, marginBottom: 8}}>
                    <StatCard icon={<Eye size={16} color={palette.primary} />} label="Views" value={fmtCount(selectedAnalytics.viewsCount)} palette={palette} />
                    <StatCard icon={<Heart size={16} color={palette.destructive} />} label="Likes" value={fmtCount(selectedAnalytics.likesCount)} palette={palette} />
                    <StatCard icon={<MessageCircle size={16} color={palette.accent} />} label="Comments" value={fmtCount(selectedAnalytics.commentsCount)} palette={palette} />
                    <StatCard icon={<Send size={16} color={palette.foreground} />} label="Shares" value={fmtCount(selectedAnalytics.sharesCount)} palette={palette} />
                  </View>
                  <View style={{flexDirection: 'row', gap: 8}}>
                    <StatCard icon={<BarChart2 size={16} color={palette.primary} />} label="Reach %" value={`${selectedAnalytics.reachRate}%`} palette={palette} />
                    <StatCard icon={<TrendingUp size={16} color={palette.primary} />} label="Engagement" value={`${selectedAnalytics.engagementRate}%`} palette={palette} />
                    <StatCard icon={<Eye size={16} color={palette.foregroundSubtle} />} label="Avg Watch" value={fmtMs(selectedAnalytics.avgWatchTimeMs)} palette={palette} />
                    <StatCard icon={<TrendingUp size={16} color={palette.accent} />} label="Trending" value={selectedAnalytics.trendingScore.toFixed(2)} palette={palette} />
                  </View>
                </>
              ) : null}
            </View>
          )}

          {/* Post list */}
          <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 16, paddingBottom: 8}}>
            YOUR POSTS — TAP FOR INSIGHTS
          </Text>
          {posts.length === 0 ? (
            <Text style={{textAlign: 'center', color: palette.foregroundMuted, paddingTop: 40}}>No posts yet</Text>
          ) : (
            <View style={{flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 3}}>
              {posts.map(post => (
                <Pressable
                  key={post._id}
                  onPress={() => loadAnalytics(post._id)}
                  style={{
                    width: '31.5%', aspectRatio: 1,
                    borderRadius: 6, overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: selected === post._id ? palette.primary : 'transparent',
                  }}>
                  <Image
                    source={{uri: post.thumbnailUrl ?? post.mediaUrl}}
                    style={{width: '100%', height: '100%'}}
                    resizeMode="cover"
                  />
                  <View style={{
                    position: 'absolute', bottom: 4, left: 4,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                    backgroundColor: palette.overlay,
                  }}>
                    <Eye size={11} color={palette.foreground} />
                    <Text style={{color: palette.foreground, fontSize: 10, fontWeight: '700'}}>{fmtCount(post.viewsCount)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{height: 32}} />
        </ScrollView>
      )}
    </ThemedSafeScreen>
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
    <ThemedSafeScreen>
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
            <Text style={{textAlign: 'center', color: palette.foregroundMuted, paddingTop: 60, fontSize: 15}}>
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
                  <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 3}}>
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
    </ThemedSafeScreen>
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
        <Text style={{color: palette.foregroundMuted}}>Ringing...</Text>
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
        <Text style={{color: palette.foregroundMuted}}>Connecting video...</Text>
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
          <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 6}}>Trigger: On signup</Text>
        </View>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Store promotion</Text>
          <Text style={{color: palette.foreground}}>Flash sale at Coffee Republic — 50% off today only!</Text>
          <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 6}}>Trigger: 3KM proximity</Text>
        </View>
        <View style={{padding: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: `${palette.primary}08`}}>
          <Text style={{color: palette.primary, fontWeight: '800', marginBottom: 4}}>Event alert</Text>
          <Text style={{color: palette.foreground}}>New music release — trending audio in your city. Use it in your next reel!</Text>
          <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 6}}>Trigger: Admin broadcast</Text>
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
