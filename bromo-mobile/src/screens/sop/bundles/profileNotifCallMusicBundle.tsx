import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, Switch, Text, TextInput, View} from 'react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BarChart2, Eye, Heart, MessageCircle, Send, TrendingUp} from 'lucide-react-native';
import {useTheme} from '../../../context/ThemeContext';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {ThemedSafeScreen} from '../../../components/ui/ThemedSafeScreen';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';
import {getNotifications, markAllRead, markRead, type AppNotification} from '../../../api/notificationsApi';
import {getPost, getPostAnalytics, getSavedPosts, getUserPosts, type Post, type PostAnalytics} from '../../../api/postsApi';
import {ProfileGridMedia} from '../../../components/profile/ProfileGridMedia';
import {useAuth} from '../../../context/AuthContext';
import {connectMyStore, submitCreatorForm} from '../../../api/authApi';
import {getMyFollowAttribution} from '../../../api/followApi';
import {parentNavigate} from '../../../navigation/parentNavigate';
import {WebRtcCallShell} from '../../../webrtc/WebRtcCallShell';

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
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      getSavedPosts(1)
        .then(res => {
          if (alive) setPosts(res.posts ?? []);
        })
        .catch(() => {
          if (alive) setPosts([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <SopChrome title="Saved posts">
      <SopMeta label="Bookmarked feed & reels." />
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : posts.length === 0 ? (
        <Text style={{color: palette.mutedForeground}}>No saved posts yet.</Text>
      ) : (
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 3}}>
          {posts.map(post => (
            <Pressable
              key={post._id}
              onPress={() => {
                if (post.type === 'reel' || post.mediaType === 'video') {
                  parentNavigate(navigation, 'Reels', {initialPostId: post._id});
                } else {
                  navigation.navigate('PostDetail', {postId: post._id});
                }
              }}
              style={{width: '32.8%', aspectRatio: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: palette.input}}>
              <ProfileGridMedia post={post} style={{width: '100%', height: '100%'}} />
            </Pressable>
          ))}
        </View>
      )}
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
                <View style={{width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.border}}>
                  <ProfileGridMedia post={selectedPost} style={{width: 56, height: 56, borderRadius: 8}} />
                </View>
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
                  <ProfileGridMedia post={post} style={{width: '100%', height: '100%'}} />
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
  const {palette} = useTheme();
  const {dbUser, refreshDbUser} = useAuth();
  const navigation = useNavigation<Nav>();
  const [reels, setReels] = useState<Post[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, PostAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState(dbUser?.displayName ?? '');
  const [category, setCategory] = useState('');
  const [bio, setBio] = useState(dbUser?.bio ?? '');
  const [website, setWebsite] = useState(dbUser?.website ?? '');
  const [documents, setDocuments] = useState('');
  const [storeWebsite, setStoreWebsite] = useState(dbUser?.connectedStore?.website ?? dbUser?.website ?? '');
  const [followAttrByKind, setFollowAttrByKind] = useState<{kind: string; count: number}[]>([]);

  const statusEarly = dbUser?.creatorStatus ?? 'none';
  const verifiedCreatorEarly = Boolean(dbUser?.isCreator && statusEarly === 'verified');

  useEffect(() => {
    if (!verifiedCreatorEarly || !dbUser?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const {items} = await getMyFollowAttribution();
        if (cancelled) return;
        const byKind = new Map<string, number>();
        for (const it of items) {
          const k = it.kind ?? 'unknown';
          byKind.set(k, (byKind.get(k) ?? 0) + it.count);
        }
        setFollowAttrByKind(
          [...byKind.entries()]
            .map(([kind, count]) => ({kind, count}))
            .sort((a, b) => b.count - a.count),
        );
      } catch {
        if (!cancelled) setFollowAttrByKind([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verifiedCreatorEarly, dbUser?._id]);

  useEffect(() => {
    if (!dbUser?._id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getUserPosts(dbUser._id, 'reel', 1);
        if (cancelled) return;
        setReels(res.posts);
        const top = res.posts.slice(0, 8);
        const pairs = await Promise.all(
          top.map(async post => {
            try {
              const data = await getPostAnalytics(post._id);
              return [post._id, data] as const;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        const next: Record<string, PostAnalytics> = {};
        for (const pair of pairs) {
          if (pair) next[pair[0]] = pair[1];
        }
        setAnalytics(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbUser?._id]);

  const totals = reels.reduce(
    (acc, reel) => {
      const a = analytics[reel._id];
      acc.views += a?.viewsCount ?? reel.viewsCount ?? 0;
      acc.clicks += a?.totalClicks ?? 0;
      acc.engagement += (a?.likesCount ?? reel.likesCount ?? 0) + (a?.commentsCount ?? reel.commentsCount ?? 0);
      acc.storeClicks += a?.storeIconClicks ?? reel.storeIconClicksCount ?? 0;
      acc.earnings += a?.estimatedEarnings ?? reel.rewardPointsAccrued ?? 0;
      return acc;
    },
    {views: 0, clicks: 0, engagement: 0, storeClicks: 0, earnings: 0},
  );

  const submitCreator = useCallback(async () => {
    if (!fullName.trim() || !category.trim() || !bio.trim()) {
      Alert.alert('Required', 'Full name, category, and bio are required.');
      return;
    }
    setSubmitting(true);
    try {
      await submitCreatorForm({
        fullName: fullName.trim(),
        category: category.trim(),
        bio: bio.trim(),
        website: website.trim(),
        documents: documents.split(',').map(v => v.trim()).filter(Boolean),
      });
      await refreshDbUser();
      Alert.alert('Submitted', 'Creator Form submitted. Creator badge appears after admin approval.');
    } catch (err) {
      Alert.alert('Creator Form', err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  }, [fullName, category, bio, website, documents, refreshDbUser]);

  const connectStore = useCallback(async () => {
    if (!storeWebsite.trim()) {
      Alert.alert('Required', 'Enter your Shopify or store website.');
      return;
    }
    setSubmitting(true);
    try {
      await connectMyStore({website: storeWebsite.trim(), planId: 'connect_store'});
      await refreshDbUser();
      Alert.alert('Connected', 'Store icon will appear on your feed posts and reels.');
    } catch (err) {
      Alert.alert('Connect Store', err instanceof Error ? err.message : 'Failed to connect store');
    } finally {
      setSubmitting(false);
    }
  }, [storeWebsite, refreshDbUser]);

  const status = dbUser?.creatorStatus ?? 'none';
  const verifiedCreator = Boolean(dbUser?.isCreator && status === 'verified');

  return (
    <ThemedSafeScreen>
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 42}}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{marginRight: 12}}>
            <Text style={{color: palette.primary, fontSize: 18}}>‹</Text>
          </Pressable>
          <View style={{flex: 1}}>
            <Text style={{color: palette.foreground, fontSize: 24, fontWeight: '900'}}>Creator Dashboard</Text>
            <Text style={{color: palette.foregroundMuted, marginTop: 2}}>
              {verifiedCreator ? 'Creator badge active' : status === 'pending' ? 'Creator Form pending admin approval' : 'Submit Creator Form to unlock creator tools'}
            </Text>
          </View>
        </View>

        <View style={{borderWidth: 1, borderColor: palette.border, backgroundColor: palette.input, borderRadius: 18, padding: 14, marginBottom: 16}}>
          <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900'}}>Account status</Text>
          <Text style={{color: verifiedCreator ? palette.success : palette.warning, marginTop: 6, fontWeight: '800'}}>
            {verifiedCreator ? 'Creator verified' : status === 'pending' ? 'Request pending' : status === 'rejected' ? 'Creator request rejected' : 'Standard user'}
          </Text>
          <Text style={{color: palette.foregroundMuted, marginTop: 6, lineHeight: 18}}>
            Regular users cannot tag products. Product tagging, store icon analytics, estimated earnings, and collaborations unlock only after admin verifies your Creator Form.
          </Text>
        </View>

        {!verifiedCreator ? (
          <View style={{borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, marginBottom: 16}}>
            <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900', marginBottom: 12}}>Creator Form</Text>
            <CreatorInput label="Full name" value={fullName} onChangeText={setFullName} palette={palette} />
            <CreatorInput label="Creator category" value={category} onChangeText={setCategory} palette={palette} placeholder="Fashion, tech, food, fitness..." />
            <CreatorInput label="Bio" value={bio} onChangeText={setBio} palette={palette} multiline />
            <CreatorInput label="Website" value={website} onChangeText={setWebsite} palette={palette} placeholder="https://..." />
            <CreatorInput label="Document links" value={documents} onChangeText={setDocuments} palette={palette} placeholder="Comma-separated KYC or portfolio URLs" />
            <Pressable disabled={submitting} onPress={submitCreator} style={{backgroundColor: palette.primary, borderRadius: 14, padding: 13, alignItems: 'center'}}>
              <Text style={{color: palette.primaryForeground, fontWeight: '900'}}>{submitting ? 'Submitting…' : 'Submit Creator Form'}</Text>
            </Pressable>
          </View>
        ) : null}

        {verifiedCreator && followAttrByKind.length > 0 ? (
          <View style={{borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, marginBottom: 16}}>
            <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900'}}>Follower sources</Text>
            <Text style={{color: palette.foregroundMuted, marginTop: 4, lineHeight: 18}}>
              Where people followed you from (attributed taps).
            </Text>
            <View style={{marginTop: 10, gap: 6}}>
              {followAttrByKind.map(row => (
                <View key={row.kind} style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                  <Text style={{color: palette.foreground, fontWeight: '700', textTransform: 'capitalize'}}>{row.kind}</Text>
                  <Text style={{color: palette.foregroundMuted, fontWeight: '800'}}>{row.count}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{flexDirection: 'row', gap: 10, marginBottom: 16}}>
          <StatCard icon={<Eye size={18} color={palette.primary} />} label="Views" value={fmtCount(totals.views)} palette={palette} />
          <StatCard icon={<TrendingUp size={18} color={palette.primary} />} label="Clicks" value={fmtCount(totals.clicks)} palette={palette} />
        </View>
        <View style={{flexDirection: 'row', gap: 10, marginBottom: 16}}>
          <StatCard icon={<Heart size={18} color={palette.primary} />} label="Engagement" value={fmtCount(totals.engagement)} palette={palette} />
          <StatCard icon={<BarChart2 size={18} color={palette.primary} />} label="Est. points" value={fmtCount(totals.earnings)} palette={palette} />
        </View>

        <View style={{borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, marginBottom: 16}}>
          <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900'}}>Connect My Store</Text>
          <Text style={{color: palette.foregroundMuted, marginTop: 4, lineHeight: 18}}>
            Purchase this plan to show a store icon on every feed post and reel. Product taps redirect to your own website.
          </Text>
          <CreatorInput label="Store website" value={storeWebsite} onChangeText={setStoreWebsite} palette={palette} placeholder="https://yourstore.com" />
          <Pressable disabled={submitting} onPress={connectStore} style={{backgroundColor: palette.foreground, borderRadius: 14, padding: 13, alignItems: 'center'}}>
            <Text style={{color: palette.background, fontWeight: '900'}}>
              {dbUser?.connectedStore?.enabled ? 'Update Connected Store' : 'Connect My Store'}
            </Text>
          </Pressable>
        </View>

        <View style={{borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 14, marginBottom: 16}}>
          <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900'}}>Collaboration deals</Text>
          <Text style={{color: palette.foregroundMuted, marginTop: 4}}>
            Paid and unpaid brand deals suggested by BROMO appear here with accept or decline actions.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('CollabInbox')}
            style={{
              marginTop: 10,
              alignSelf: 'flex-start',
              backgroundColor: palette.primary,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 12,
            }}>
            <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 13}}>Open collaboration inbox</Text>
          </Pressable>
          <View style={{marginTop: 12, gap: 10}}>
            <DealRow title="Suggested brand deal" body="No active suggestions yet" paid={false} palette={palette} />
            <DealRow title="Deal history" body="Accepted, declined, paid, and unpaid collaborations will be listed here with total income." paid palette={palette} />
          </View>
        </View>

        <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900', marginBottom: 10}}>Reel analytics</Text>
        {loading ? (
          <ActivityIndicator color={palette.primary} />
        ) : reels.length === 0 ? (
          <Text style={{color: palette.foregroundMuted}}>No reels yet.</Text>
        ) : (
          reels.slice(0, 10).map(reel => {
            const a = analytics[reel._id];
            return (
              <Pressable
                key={reel._id}
                onPress={() => navigation.navigate('ContentInsights', {focusPostId: reel._id})}
                style={{flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 16, padding: 10, marginBottom: 10}}>
                <ProfileGridMedia post={reel} style={{width: 72, height: 96, borderRadius: 12}} />
                <View style={{flex: 1}}>
                  <Text numberOfLines={2} style={{color: palette.foreground, fontWeight: '800'}}>{reel.caption || 'Untitled reel'}</Text>
                  <Text style={{color: palette.foregroundMuted, marginTop: 6, fontSize: 12}}>
                    Views {fmtCount(a?.viewsCount ?? reel.viewsCount)} · Engagement {fmtCount((a?.likesCount ?? reel.likesCount) + (a?.commentsCount ?? reel.commentsCount))}
                  </Text>
                  <Text style={{color: palette.foregroundMuted, marginTop: 2, fontSize: 12}}>
                    Store clicks {fmtCount(a?.storeIconClicks ?? reel.storeIconClicksCount ?? 0)} · Est. points {fmtCount(a?.estimatedEarnings ?? reel.rewardPointsAccrued ?? 0)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ThemedSafeScreen>
  );
}

function CreatorInput({
  label,
  value,
  onChangeText,
  palette,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{marginBottom: 12}}>
      <Text style={{color: palette.foregroundMuted, fontSize: 12, fontWeight: '800', marginBottom: 6}}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.placeholder}
        multiline={multiline}
        style={{
          minHeight: multiline ? 84 : 46,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 13,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: palette.foreground,
          backgroundColor: palette.input,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

function DealRow({title, body, paid, palette}: {title: string; body: string; paid: boolean; palette: ReturnType<typeof useTheme>['palette']}) {
  return (
    <View style={{borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: 12, backgroundColor: palette.input}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
        <Text style={{color: palette.foreground, fontWeight: '900'}}>{title}</Text>
        <Text style={{color: paid ? palette.success : palette.warning, fontSize: 12, fontWeight: '900'}}>{paid ? 'Paid' : 'Unpaid'}</Text>
      </View>
      <Text style={{color: palette.foregroundMuted, marginTop: 4, fontSize: 12, lineHeight: 17}}>{body}</Text>
    </View>
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
  const navigation = useNavigation<Nav>();
  const {remoteUserId, peerName, direction, callId} = route.params;
  useEffect(() => {
    if (!remoteUserId?.trim()) navigation.goBack();
  }, [navigation, remoteUserId]);
  if (!remoteUserId?.trim()) return null;
  return (
    <WebRtcCallShell
      media="audio"
      remoteUserId={remoteUserId}
      peerName={peerName}
      direction={direction}
      callId={callId}
    />
  );
}

export function VideoCallScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'VideoCall'>>();
  const navigation = useNavigation<Nav>();
  const {remoteUserId, peerName, direction, callId} = route.params;
  useEffect(() => {
    if (!remoteUserId?.trim()) navigation.goBack();
  }, [navigation, remoteUserId]);
  if (!remoteUserId?.trim()) return null;
  return (
    <WebRtcCallShell
      media="video"
      remoteUserId={remoteUserId}
      peerName={peerName}
      direction={direction}
      callId={callId}
    />
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
