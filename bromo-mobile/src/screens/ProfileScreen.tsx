import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {postThumbnailUri} from '../lib/postMediaDisplay';
import {resetToAuth} from '../navigation/rootNavigation';
import {getUserPosts, type Post} from '../api/postsApi';
import {socketService} from '../services/socketService';
import {clearStoriesFeedCache} from '../lib/storiesFeedCache';

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

  const displayName = dbUser?.displayName || 'User';
  const username = dbUser?.username || '';
  const email = dbUser?.email || '';
  const avatar = dbUser?.profilePicture || null;
  const bio = dbUser?.bio || '';
  const isVerified = dbUser?.emailVerified && dbUser?.provider === 'google';

  const loadPosts = useCallback(async (tab: string) => {
    if (!dbUser?._id) return;
    setPostsLoading(true);
    try {
      const typeMap: Record<string, string> = {posts: 'post', reels: 'reel', saved: 'saved'};
      const res = await getUserPosts(dbUser._id, typeMap[tab] ?? 'post');
      setUserPosts(res.posts);
    } catch {
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
      void refreshDbUser();
    });
    const unsubNew = socketService.on('post:new', p => {
      if (!dbUser?._id || String(p.author?._id) !== String(dbUser._id)) return;
      void refreshDbUser();
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
  }, [dbUser?._id, gridTab, refreshDbUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshDbUser(), loadPosts(gridTab)]);
    setRefreshing(false);
  }, [refreshDbUser, loadPosts, gridTab]);

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
          sublabel: 'Insights and analytics',
          accent: palette.accent,
          action: () => nav('ContentInsights'),
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
          <View style={[styles.coinBadge, {borderColor: `${palette.primary}40`, backgroundColor: `${palette.primary}12`}]}>
            <Coins size={11} color={palette.warning} />
            <Text style={[styles.coinText, {color: palette.primary}]}>0</Text>
          </View>
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
                {label: 'Posts', value: Math.max(0, dbUser?.postsCount ?? 0), onPress: () => parentNavigate(navigation, 'ManageContent')},
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

            {/* Link placeholder */}
            <Pressable
              style={styles.linkRow}
              onPress={() => parentNavigate(navigation, 'EditProfile')}>
              <Link2 size={13} color={palette.primary} />
              <Text style={[styles.linkText, {color: palette.primary}]}>
                Add a link
              </Text>
            </Pressable>

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
        </View>

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
              <Pressable
                key={post._id}
                onPress={() => parentNavigate(navigation, 'PostDetail', {postId: post._id})}
                style={styles.gridTile}>
                <Image source={{uri: postThumbnailUri(post)}} style={styles.gridImg} />
                {(post.type === 'reel' || post.mediaType === 'video') && (
                  <View style={styles.reelIcon}>
                    <Play size={12} color={palette.foreground} fill={palette.foreground} />
                  </View>
                )}
              </Pressable>
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
    aspectRatio: 1,
    padding: 1,
  },
  gridImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
