import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {
  Grid3X3,
  Clapperboard,
  Bookmark,
  Play,
  BadgeCheck,
  ChevronLeft,
  AlignJustify,
  Coins,
  Camera,
  Plus,
  Link2,
  Lock,
  Globe,
  X,
  ChevronRight,
  Zap,
  BarChart2,
  Bell,
  Shield,
  Sliders,
  Film,
  Activity,
  Smartphone,
  KeyRound,
  Info,
  UserPlus,
  LogOut,
  Share2,
  PenSquare,
  TrendingUp,
  Store,
  ShoppingBag,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {resetToAuth} from '../navigation/rootNavigation';
import {getUserGridStats, getUserPosts, type Post, type UserGridStats} from '../api/postsApi';
import {getWallet} from '../api/walletApi';
import {followUser, getUserSuggestions, type SuggestedUser} from '../api/followApi';
import {socketService} from '../services/socketService';
import {clearStoriesFeedCache} from '../lib/storiesFeedCache';
import {
  getCachedOwnGridStats,
  getCachedOwnPosts,
  invalidateOwnProfileSession,
  setCachedOwnGridStats,
  setCachedOwnPosts,
} from '../lib/ownProfileSessionCache';

// ─── Types ────────────────────────────────────────────────────────

type SettingsItem = {
  icon: React.ComponentType<{size: number; color: string}>;
  label: string;
  sublabel?: string;
  accent?: string;
  action: () => void;
  showChevron?: boolean;
};

type SettingsGroup = {
  title?: string;
  items: SettingsItem[];
};

function fmtWalletCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Styles ───────────────────────────────────────────────────────

const GRID_TABS = [
  {id: 'posts', icon: Grid3X3, label: 'Posts'},
  {id: 'reels', icon: Clapperboard, label: 'Reels'},
  {id: 'saved', icon: Bookmark, label: 'Saved'},
];

// ─── Settings Modal ───────────────────────────────────────────────

function SettingsModal({
  visible,
  onClose,
  groups,
  username,
  displayName,
  avatar,
  palette,
}: {
  visible: boolean;
  onClose: () => void;
  groups: SettingsGroup[];
  username: string;
  displayName: string;
  avatar: string | null;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: palette.background}}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={[styles.settingsHeader, {borderBottomColor: palette.glassMid}]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.settingsClose}>
            <X size={22} color={palette.foreground} />
          </Pressable>
          <Text style={[styles.settingsTitle, {color: palette.foreground}]}>Settings and activity</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Account block */}
          <View style={[styles.settingsAccountBlock, {borderBottomColor: palette.glass}]}>
            <View style={styles.settingsAvatar}>
              {avatar ? (
                <Image source={{uri: avatar}} style={styles.settingsAvatarImg} />
              ) : (
                <View style={[styles.settingsAvatarImg, {
                  backgroundColor: `${palette.primary}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }]}>
                  <Text style={{color: palette.primary, fontSize: 22, fontWeight: '800'}}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View>
              <Text style={[styles.settingsAccountName, {color: palette.foreground}]}>{displayName}</Text>
              <Text style={[styles.settingsAccountHandle, {color: palette.foregroundSubtle}]}>@{username || 'you'}</Text>
            </View>
          </View>

          {/* Settings groups */}
          {groups.map((group, gi) => (
            <View key={gi}>
              {group.title ? (
                <Text style={[styles.settingsGroupTitle, {color: palette.placeholder}]}>{group.title}</Text>
              ) : null}
              <View style={[styles.settingsGroupCard, {backgroundColor: palette.glassFaint, borderColor: palette.glassMid}]}>
                {group.items.map((item, ii) => {
                  const Icon = item.icon;
                  const accentColor = item.accent ?? palette.foreground;
                  return (
                    <Pressable
                      key={ii}
                      onPress={item.action}
                      style={({pressed}) => [
                        styles.settingsRow,
                        ii < group.items.length - 1 && [styles.settingsRowBorder, {borderBottomColor: palette.glass}],
                        {opacity: pressed ? 0.65 : 1},
                      ]}>
                      <View style={[styles.settingsIconBox, {backgroundColor: `${accentColor}14`}]}>
                        <Icon size={18} color={accentColor} />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={[styles.settingsRowLabel, {color: accentColor}]}>
                          {item.label}
                        </Text>
                        {item.sublabel ? (
                          <Text style={[styles.settingsRowSub, {color: palette.placeholder}]}>{item.sublabel}</Text>
                        ) : null}
                      </View>
                      {item.showChevron !== false && (
                        <ChevronRight size={16} color={palette.borderHeavy} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={{height: 48}} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────

export function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppStackParamList, 'Profile'>>();
  const {palette, contract} = useTheme();
  const {dbUser, logout, refreshDbUser} = useAuth();
  const [gridTab, setGridTab] = useState('posts');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [discoverPeople, setDiscoverPeople] = useState<SuggestedUser[]>([]);
  const [dismissedSuggest, setDismissedSuggest] = useState<string[]>([]);
  const [gridStats, setGridStats] = useState<UserGridStats | null>(null);

  const loadWalletAndSuggestions = useCallback(async () => {
    try {
      const w = await getWallet();
      setWalletBalance(w.balance);
    } catch {
      setWalletBalance(null);
    }
    try {
      const res = await getUserSuggestions(12);
      setDiscoverPeople(res.users ?? []);
    } catch {
      setDiscoverPeople([]);
    }
  }, []);

  const loadGridStats = useCallback(async () => {
    if (!dbUser?._id) return;
    const id = String(dbUser._id);
    const cached = getCachedOwnGridStats(id);
    if (cached) {
      setGridStats(cached);
      return;
    }
    try {
      const s = await getUserGridStats(id);
      setGridStats(s);
      setCachedOwnGridStats(id, s);
    } catch {
      setGridStats(null);
    }
  }, [dbUser?._id]);

  useFocusEffect(
    useCallback(() => {
      void loadWalletAndSuggestions();
      void loadGridStats();
    }, [loadWalletAndSuggestions, loadGridStats]),
  );

  const displayName = dbUser?.displayName || 'User';
  const username = dbUser?.username || '';
  const email = dbUser?.email || '';
  const avatar = dbUser?.profilePicture || null;
  const bio = dbUser?.bio || '';
  const isVerified = dbUser?.emailVerified && dbUser?.provider === 'google';

  const loadPosts = useCallback(async (tab: string) => {
    if (!dbUser?._id) return;
    const id = String(dbUser._id);
    const tabKey = tab === 'posts' ? 'posts' : tab === 'reels' ? 'reels' : 'saved';
    const cached = getCachedOwnPosts(id, tabKey);
    if (cached) {
      setUserPosts(cached);
      return;
    }
    setPostsLoading(true);
    try {
      const typeMap: Record<string, string> = {posts: 'post', reels: 'reel', saved: 'saved'};
      const res = await getUserPosts(id, typeMap[tab] ?? 'post');
      setUserPosts(res.posts);
      setCachedOwnPosts(id, tabKey, res.posts);
    } catch (e) {
      console.error('[Profile] getUserPosts failed', tab, e);
      setUserPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [dbUser?._id]);

  useEffect(() => {
    loadPosts(gridTab);
  }, [gridTab, loadPosts]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.openSettings) {
        setMenuOpen(true);
        navigation.setParams({openSettings: undefined} as never);
      }
    }, [navigation, route.params?.openSettings]),
  );

  useEffect(() => {
    const unsubDel = socketService.on('post:delete', ({postId}) => {
      setUserPosts(prev => prev.filter(p => p._id !== postId));
    });
    const unsubNew = socketService.on('post:new', p => {
      if (!dbUser?._id || String(p.author?._id) !== String(dbUser._id)) return;
      if (p.type === 'story') {
        void clearStoriesFeedCache().catch(() => null);
        return;
      }
      const wantPost = gridTab === 'posts' && p.type === 'post';
      const wantReel = gridTab === 'reels' && p.type === 'reel';
      if (!wantPost && !wantReel) return;
      const enriched: Post = {
        ...p,
        isLiked: p.isLiked ?? false,
        isFollowing: true,
        likesCount: p.likesCount ?? 0,
        commentsCount: p.commentsCount ?? 0,
        viewsCount: p.viewsCount ?? 0,
        impressionsCount: p.impressionsCount ?? 0,
        sharesCount: p.sharesCount ?? 0,
        avgWatchTimeMs: p.avgWatchTimeMs ?? 0,
        trendingScore: p.trendingScore ?? 0,
      };
      setUserPosts(prev => (prev.some(x => x._id === enriched._id) ? prev : [enriched, ...prev]));
    });
    return () => {
      unsubDel();
      unsubNew();
    };
  }, [dbUser?._id, gridTab]);

  const onRefresh = useCallback(async () => {
    if (dbUser?._id) invalidateOwnProfileSession(String(dbUser._id));
    setRefreshing(true);
    await Promise.all([refreshDbUser(), loadPosts(gridTab), loadGridStats()]);
    setRefreshing(false);
  }, [refreshDbUser, loadPosts, gridTab, loadGridStats, dbUser?._id]);

  const appName = contract.branding.appTitle || 'bromo';

  const handleLogout = () => {
    setMenuOpen(false);
    Alert.alert(
      'Log out',
      `Log out of @${username || 'your account'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            resetToAuth();
          },
        },
      ],
    );
  };

  const handleAddAccount = () => {
    setMenuOpen(false);
    Alert.alert(
      'Add another account',
      'You will be logged out of the current account. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Continue',
          onPress: async () => {
            await logout();
            resetToAuth();
          },
        },
      ],
    );
  };

  const nav = (screen: string, params?: Record<string, unknown>) => {
    setMenuOpen(false);
    parentNavigate(navigation, screen, params);
  };

  const settingsGroups: SettingsGroup[] = [
    {
      title: 'Creator tools',
      items: [
        {
          icon: Zap,
          label: 'Creator Dashboard',
          sublabel: 'Stats, earnings, and tools',
          accent: palette.warning,
          action: () => nav('CreatorDashboard'),
        },
        {
          icon: BarChart2,
          label: 'Professional Dashboard',
          sublabel: 'Wallet, promotions, insights',
          accent: palette.accent,
          action: () => nav('ProfessionalHub'),
        },
        {
          icon: BadgeCheck,
          label: 'Get Verification Badge',
          sublabel: 'Apply for the verified checkmark',
          accent: palette.accent,
          action: () => nav('SettingsMain'),
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          icon: Bell,
          label: 'Notification settings',
          action: () => nav('NotificationSettings'),
          accent: palette.foreground,
        },
        {
          icon: Shield,
          label: 'Account privacy',
          sublabel: 'Public or private account',
          action: () => nav('PrivacySettings'),
          accent: palette.foreground,
        },
        {
          icon: Sliders,
          label: 'Content preferences',
          action: () => nav('SettingsMain'),
          accent: palette.foreground,
        },
        {
          icon: Film,
          label: 'Media quality',
          sublabel: 'Upload and playback quality',
          action: () => nav('SettingsMain'),
          accent: palette.foreground,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: Activity,
          label: 'Your activity',
          sublabel: 'Time spent, interactions',
          action: () => nav('SettingsMain'),
          accent: palette.foreground,
        },
        {
          icon: Smartphone,
          label: 'Devices and sessions',
          action: () => nav('SecuritySettings'),
          accent: palette.foreground,
        },
        {
          icon: KeyRound,
          label: 'Permissions',
          sublabel: 'Camera, location, contacts',
          action: () => nav('SecuritySettings'),
          accent: palette.foreground,
        },
      ],
    },
    {
      title: 'More info',
      items: [
        {
          icon: Info,
          label: `About ${appName}`,
          sublabel: 'Version, terms, privacy policy',
          action: () => nav('AboutApp'),
          accent: palette.foreground,
        },
      ],
    },
    {
      items: [
        {
          icon: UserPlus,
          label: 'Add account',
          accent: palette.primary,
          action: handleAddAccount,
          showChevron: false,
        },
        {
          icon: LogOut,
          label: 'Log out',
          accent: palette.accent,
          action: handleLogout,
          showChevron: false,
        },
      ],
    },
  ];

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      <SettingsModal
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        groups={settingsGroups}
        username={username}
        displayName={displayName}
        avatar={avatar}
        palette={palette}
      />

      {/* ── Top header ── */}
      <View style={[styles.header, {borderBottomColor: palette.glassFaint}]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={palette.foreground} />
        </Pressable>

        <Text style={[styles.headerUsername, {color: palette.foreground}]} numberOfLines={1}>
          {username || displayName}
        </Text>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => parentNavigate(navigation, 'PointsWallet')}
            style={[styles.coinBadge, {borderColor: `${palette.primary}40`, backgroundColor: `${palette.primary}12`}]}>
            <Coins size={11} color={palette.warning} />
            <Text style={[styles.coinText, {color: palette.primary}]}>
              {walletBalance != null ? fmtWalletCoins(walletBalance) : '—'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
            <AlignJustify size={22} color={palette.foreground} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} colors={[palette.primary]} />
        }>

        {/* ── Profile section ── */}
        <View style={styles.profileSection}>

          {/* Avatar row */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarRing, {borderColor: palette.primary}]}>
              {avatar ? (
                <Image source={{uri: avatar}} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback, {backgroundColor: `${palette.primary}20`}]}>
                  <Text style={[styles.avatarInitial, {color: palette.primary}]}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                {
                  label: 'Posts',
                  value: Math.max(0, gridStats?.gridTotal ?? dbUser?.postsCount ?? 0),
                  onPress: () => parentNavigate(navigation, 'ManageContent'),
                },
                {
                  label: 'Followers',
                  value: dbUser?.followersCount ?? 0,
                  onPress: () => parentNavigate(navigation, 'FollowersFollowing', {userId: dbUser?._id, tab: 'followers'}),
                },
                {
                  label: 'Following',
                  value: dbUser?.followingCount ?? 0,
                  onPress: () => parentNavigate(navigation, 'FollowersFollowing', {userId: dbUser?._id, tab: 'following'}),
                },
              ].map(stat => (
                <Pressable key={stat.label} onPress={stat.onPress} style={styles.statItem}>
                  <Text style={[styles.statValue, {color: palette.foreground}]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, {color: palette.foregroundSubtle}]}>{stat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Name + bio */}
          <View style={styles.bioSection}>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, {color: palette.foreground}]}>{displayName}</Text>
              {isVerified && (
                <BadgeCheck size={16} color={palette.accent} fill={palette.accent} />
              )}
            </View>

            {email ? (
              <Text style={[styles.emailLine, {color: palette.placeholder}]}>{email}</Text>
            ) : null}

            {bio ? (
              <Text style={[styles.bioText, {color: palette.foreground}]}>{bio}</Text>
            ) : null}

            {dbUser?.website?.trim() ? (
              <Pressable
                style={styles.linkRow}
                onPress={() => {
                  const u = dbUser.website.trim();
                  void Linking.openURL(u.startsWith('http') ? u : `https://${u}`);
                }}>
                <Link2 size={13} color={palette.primary} />
                <Text style={[styles.linkText, {color: palette.primary}]} numberOfLines={1}>
                  {dbUser.website.replace(/^https?:\/\//i, '')}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.linkRow}
                onPress={() => parentNavigate(navigation, 'EditProfile')}>
                <Link2 size={13} color={palette.primary} />
                <Text style={[styles.linkText, {color: palette.primary}]}>Add a link</Text>
              </Pressable>
            )}

            {/* Category + privacy row */}
            <View style={styles.metaRow}>
              <View style={[styles.metaBadge, {borderColor: palette.borderMid}]}>
                <Globe size={11} color={palette.foregroundSubtle} />
                <Text style={[styles.metaBadgeText, {color: palette.foregroundSubtle}]}>Public</Text>
              </View>
              <View style={[styles.metaBadge, {borderColor: palette.borderMid}]}>
                <Text style={[styles.metaBadgeText, {color: palette.foregroundSubtle}]}>Creator</Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, {borderColor: palette.borderHeavy, backgroundColor: palette.glassFaint}]}
              onPress={() => parentNavigate(navigation, 'EditProfile')}>
              <PenSquare size={15} color={palette.foreground} />
              <Text style={[styles.actionBtnText, {color: palette.foreground}]}>Edit profile</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, {borderColor: palette.borderHeavy, backgroundColor: palette.glassFaint}]}
              onPress={() => parentNavigate(navigation, 'ShareProfile')}>
              <Share2 size={15} color={palette.foreground} />
              <Text style={[styles.actionBtnText, {color: palette.foreground}]}>Share profile</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => parentNavigate(navigation, 'ProfessionalHub')}
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 12,
              backgroundColor: palette.glassFaint,
              borderWidth: 1,
              borderColor: palette.glassMid,
            }}>
            <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '800'}}>Professional dashboard</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8}}>
              <TrendingUp size={15} color={palette.success} />
              <Text style={{flex: 1, color: palette.foregroundSubtle, fontSize: 13, lineHeight: 18}}>
                {gridStats != null && (gridStats.totalViews > 0 || gridStats.totalImpressions > 0)
                  ? `${gridStats.totalViews.toLocaleString()} views · ${gridStats.totalImpressions.toLocaleString()} impressions (all posts & reels) · Wallet & campaigns`
                  : 'Buy Bromo coins, run promotions, and view content insights'}
              </Text>
              <ChevronRight size={18} color={palette.foregroundSubtle} />
            </View>
          </Pressable>

          {/* ── Store section ── */}
          {dbUser?.storeId ? (
            <Pressable
              onPress={() => parentNavigate(navigation, 'ManageStore')}
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                backgroundColor: `${palette.primary}10`,
                borderWidth: 1,
                borderColor: `${palette.primary}30`,
              }}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <View style={{width: 32, height: 32, borderRadius: 10, backgroundColor: `${palette.primary}20`, alignItems: 'center', justifyContent: 'center'}}>
                  <Store size={17} color={palette.primary} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '800'}}>Manage Store</Text>
                  <Text style={{color: palette.foregroundSubtle, fontSize: 12, marginTop: 1}}>Products, analytics & store profile</Text>
                </View>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <View style={[{backgroundColor: `${palette.primary}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6}]}>
                    <Text style={{color: palette.primary, fontSize: 10, fontWeight: '800'}}>STORE OWNER</Text>
                  </View>
                  <ChevronRight size={16} color={palette.foregroundSubtle} />
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => parentNavigate(navigation, 'CreateStore')}
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                backgroundColor: palette.glassFaint,
                borderWidth: 1,
                borderColor: palette.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
              <View style={{width: 36, height: 36, borderRadius: 10, backgroundColor: `${palette.accent}15`, alignItems: 'center', justifyContent: 'center'}}>
                <ShoppingBag size={18} color={palette.accent} />
              </View>
              <View style={{flex: 1}}>
                <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '700'}}>Open Your Store</Text>
                <Text style={{color: palette.foregroundSubtle, fontSize: 12, marginTop: 1}}>Sell products and reach local customers</Text>
              </View>
              <ChevronRight size={16} color={palette.foregroundSubtle} />
            </Pressable>
          )}
        </View>

        {discoverPeople.filter(u => !dismissedSuggest.includes(u._id)).length > 0 ? (
          <View style={{marginBottom: 8}}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                marginBottom: 10,
              }}>
              <Text style={{color: palette.foreground, fontSize: 14, fontWeight: '800'}}>Discover people</Text>
              <Pressable
                onPress={() => setDiscoverPeople([])}
                hitSlop={10}
                accessibilityLabel="Dismiss suggestions">
                <X size={18} color={palette.foregroundSubtle} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal: 14, gap: 12, paddingBottom: 4}}>
              {discoverPeople
                .filter(u => !dismissedSuggest.includes(u._id))
                .map(u => (
                  <View
                    key={u._id}
                    style={{
                      width: 148,
                      padding: 12,
                      paddingTop: 28,
                      borderRadius: 14,
                      backgroundColor: palette.glassFaint,
                      borderWidth: 1,
                      borderColor: palette.border,
                    }}>
                    <Pressable
                      style={{position: 'absolute', top: 8, right: 8, zIndex: 2}}
                      onPress={() => setDismissedSuggest(prev => [...prev, u._id])}
                      hitSlop={8}>
                      <X size={14} color={palette.foregroundSubtle} />
                    </Pressable>
                    <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: u._id})}>
                      <Image
                        source={{uri: u.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}`}}
                        style={{width: 56, height: 56, borderRadius: 28, alignSelf: 'center', marginBottom: 8}}
                      />
                      <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13, textAlign: 'center'}} numberOfLines={1}>
                        {u.displayName}
                      </Text>
                      <Text style={{color: palette.foregroundSubtle, fontSize: 11, textAlign: 'center', marginTop: 2}} numberOfLines={1}>
                        @{u.username}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        try {
                          await followUser(u._id);
                          setDiscoverPeople(prev => prev.filter(x => x._id !== u._id));
                        } catch {
                          /* ignore */
                        }
                      }}
                      style={{
                        marginTop: 10,
                        backgroundColor: palette.primary,
                        borderRadius: 10,
                        paddingVertical: 8,
                        alignItems: 'center',
                      }}>
                      <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 12}}>Follow</Text>
                    </Pressable>
                  </View>
                ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Tab bar ── */}
        <View style={[styles.tabBar, {borderTopColor: palette.glassFaint}]}>
          {GRID_TABS.map(tab => {
            const Icon = tab.icon;
            const active = gridTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setGridTab(tab.id)}
                style={[styles.tabItem, active && [styles.tabItemActive, {borderBottomColor: palette.foreground}]]}>
                <Icon size={22} color={active ? palette.foreground : palette.foregroundSubtle} />
              </Pressable>
            );
          })}
        </View>

        {/* ── Content grid ── */}
        {postsLoading ? (
          <ActivityIndicator color={palette.primary} style={{marginVertical: 32}} />
        ) : (
          <View style={styles.grid}>
            {/* Add new content tile */}
            <Pressable
              onPress={() => parentNavigate(navigation, 'CreateFlow')}
              style={styles.addTile}>
              <View style={[styles.addTileInner, {backgroundColor: palette.glassFaint, borderColor: palette.borderFaint}]}>
                <Plus size={28} color={palette.foregroundSubtle} />
                <Text style={[styles.addTileText, {color: palette.foregroundSubtle}]}>New</Text>
              </View>
            </Pressable>

            {userPosts.map(post => (
              <View key={post._id} style={styles.gridTile}>
                <Pressable
                  onPress={() => parentNavigate(navigation, 'PostDetail', {postId: post._id})}
                  style={styles.gridTileMain}>
                  <Image source={{uri: postThumbnailUri(post)}} style={styles.gridImg} />
                  {(post.type === 'reel' || post.mediaType === 'video') && (
                    <View style={styles.reelIcon}>
                      <Play size={12} color={palette.foreground} fill={palette.foreground} />
                    </View>
                  )}
                </Pressable>
                <View style={[styles.gridProRow, {backgroundColor: 'rgba(0,0,0,0.78)', borderTopColor: palette.glass}]}>
                  <Pressable
                    style={styles.gridProBtn}
                    onPress={() =>
                      parentNavigate(navigation, 'PromoteCampaign', {
                        contentId: post._id,
                        contentType: post.type === 'reel' ? 'reel' : 'post',
                      })
                    }>
                    <Text style={[styles.gridProBtnText, {color: palette.primary}]}>Boost</Text>
                  </Pressable>
                  <View style={[styles.gridProDivider, {backgroundColor: palette.glassMid}]} />
                  <Pressable
                    style={styles.gridProBtn}
                    onPress={() => parentNavigate(navigation, 'ContentInsights', {focusPostId: post._id})}>
                    <Text style={[styles.gridProBtnText, {color: palette.primary}]}>Insights</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {!postsLoading && userPosts.length === 0 && (
          <View style={styles.emptyState}>
            <Camera size={40} color={palette.foregroundFaint} />
            <Text style={[styles.emptyText, {color: palette.foregroundSubtle}]}>No posts yet</Text>
            <Text style={[styles.emptySubText, {color: palette.foregroundFaint}]}>Share your first moment</Text>
          </View>
        )}

        <View style={{height: 32}} />
      </ScrollView>

      {/* Floating lock/public indicator */}
      <Pressable
        style={[styles.privacyFab, {backgroundColor: `${palette.primary}18`, borderColor: `${palette.primary}30`}]}
        onPress={() => parentNavigate(navigation, 'PrivacySettings')}>
        <Lock size={12} color={palette.primary} />
        <Text style={[styles.privacyFabText, {color: palette.primary}]}>Public</Text>
      </Pressable>
    </ThemedSafeScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerUsername: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coinText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Profile section
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 14,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    padding: 2,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '800',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Bio
  bioSection: {
    gap: 4,
    marginBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
  },
  emailLine: {
    fontSize: 13,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 1,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addTile: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 1,
  },
  addTileInner: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gridTile: {
    width: '33.33%',
    padding: 1,
  },
  gridTileMain: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  gridImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridProRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gridProBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  gridProBtnText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  gridProDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },
  reelIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 13,
  },

  // Privacy FAB
  privacyFab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  privacyFabText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Settings modal
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingsAccountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  settingsAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  settingsAccountName: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingsAccountHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  settingsGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  settingsGroupCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  settingsRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingsRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
