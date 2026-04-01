import React, {useState} from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
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
import {resetToAuth} from '../navigation/rootNavigation';

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

const SAMPLE_POSTS = [
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400',
  'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400',
  'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=400',
  'https://images.unsplash.com/photo-1514525253361-bee8718a7439?w=400',
  'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=400',
  'https://images.unsplash.com/photo-1555133539-4a34610018f1?w=400',
  'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400',
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
      <View style={{flex: 1, backgroundColor: '#000'}}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.settingsHeader}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.settingsClose}>
            <X size={22} color="#fff" />
          </Pressable>
          <Text style={styles.settingsTitle}>Settings and activity</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Account block */}
          <View style={styles.settingsAccountBlock}>
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
              <Text style={styles.settingsAccountName}>{displayName}</Text>
              <Text style={styles.settingsAccountHandle}>@{username || 'you'}</Text>
            </View>
          </View>

          {/* Settings groups */}
          {groups.map((group, gi) => (
            <View key={gi}>
              {group.title ? (
                <Text style={styles.settingsGroupTitle}>{group.title}</Text>
              ) : null}
              <View style={styles.settingsGroupCard}>
                {group.items.map((item, ii) => {
                  const Icon = item.icon;
                  const accentColor = item.accent ?? '#fff';
                  return (
                    <Pressable
                      key={ii}
                      onPress={item.action}
                      style={({pressed}) => [
                        styles.settingsRow,
                        ii < group.items.length - 1 && styles.settingsRowBorder,
                        {opacity: pressed ? 0.65 : 1},
                      ]}>
                      <View style={[styles.settingsIconBox, {backgroundColor: `${accentColor}14`}]}>
                        <Icon size={18} color={accentColor} />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={[styles.settingsRowLabel, {color: accentColor === '#fff' ? '#fff' : accentColor}]}>
                          {item.label}
                        </Text>
                        {item.sublabel ? (
                          <Text style={styles.settingsRowSub}>{item.sublabel}</Text>
                        ) : null}
                      </View>
                      {item.showChevron !== false && (
                        <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
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
  const {palette, contract} = useTheme();
  const {dbUser, logout} = useAuth();
  const [gridTab, setGridTab] = useState('posts');
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = dbUser?.displayName || 'User';
  const username = dbUser?.username || '';
  const email = dbUser?.email || '';
  const avatar = dbUser?.profilePicture || null;
  const bio = dbUser?.bio || '';
  const isVerified = dbUser?.emailVerified && dbUser?.provider === 'google';

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

  const nav = (screen: string, params?: object) => {
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
          accent: '#f59e0b',
          action: () => nav('CreatorDashboard'),
        },
        {
          icon: BarChart2,
          label: 'Professional Dashboard',
          sublabel: 'Insights and analytics',
          accent: '#3b82f6',
          action: () => nav('ContentInsights'),
        },
        {
          icon: BadgeCheck,
          label: 'Get Verification Badge',
          sublabel: 'Apply for the verified checkmark',
          accent: '#3b82f6',
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
          accent: '#fff',
        },
        {
          icon: Shield,
          label: 'Account privacy',
          sublabel: 'Public or private account',
          action: () => nav('PrivacySettings'),
          accent: '#fff',
        },
        {
          icon: Sliders,
          label: 'Content preferences',
          action: () => nav('SettingsMain'),
          accent: '#fff',
        },
        {
          icon: Film,
          label: 'Media quality',
          sublabel: 'Upload and playback quality',
          action: () => nav('SettingsMain'),
          accent: '#fff',
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
          accent: '#fff',
        },
        {
          icon: Smartphone,
          label: 'Devices and sessions',
          action: () => nav('SecuritySettings'),
          accent: '#fff',
        },
        {
          icon: KeyRound,
          label: 'Permissions',
          sublabel: 'Camera, location, contacts',
          action: () => nav('SecuritySettings'),
          accent: '#fff',
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
          accent: '#fff',
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
          accent: '#e94560',
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <Text style={styles.headerUsername} numberOfLines={1}>
          {username || displayName}
        </Text>

        <View style={styles.headerRight}>
          <View style={[styles.coinBadge, {borderColor: `${palette.primary}40`, backgroundColor: `${palette.primary}12`}]}>
            <Coins size={11} color="#FFD700" />
            <Text style={[styles.coinText, {color: palette.primary}]}>0</Text>
          </View>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
            <AlignJustify size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

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
                {label: 'Posts', value: 0, onPress: () => parentNavigate(navigation, 'ManageContent')},
                {
                  label: 'Followers',
                  value: 0,
                  onPress: () => parentNavigate(navigation, 'FollowersFollowing', {userId: username, tab: 'followers'}),
                },
                {
                  label: 'Following',
                  value: 0,
                  onPress: () => parentNavigate(navigation, 'FollowersFollowing', {userId: username, tab: 'following'}),
                },
              ].map(stat => (
                <Pressable key={stat.label} onPress={stat.onPress} style={styles.statItem}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Name + bio */}
          <View style={styles.bioSection}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              {isVerified && (
                <BadgeCheck size={16} color="#3b82f6" fill="#3b82f6" />
              )}
            </View>

            {email ? (
              <Text style={styles.emailLine}>{email}</Text>
            ) : null}

            {bio ? (
              <Text style={styles.bioText}>{bio}</Text>
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
              <View style={styles.metaBadge}>
                <Globe size={11} color="rgba(255,255,255,0.4)" />
                <Text style={styles.metaBadgeText}>Public</Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>Creator</Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => parentNavigate(navigation, 'EditProfile')}>
              <PenSquare size={15} color="#fff" />
              <Text style={styles.actionBtnText}>Edit profile</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => parentNavigate(navigation, 'ShareProfile')}>
              <Share2 size={15} color="#fff" />
              <Text style={styles.actionBtnText}>Share profile</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          {GRID_TABS.map(tab => {
            const Icon = tab.icon;
            const active = gridTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setGridTab(tab.id)}
                style={[styles.tabItem, active && styles.tabItemActive]}>
                <Icon size={22} color={active ? '#fff' : 'rgba(255,255,255,0.35)'} />
              </Pressable>
            );
          })}
        </View>

        {/* ── Content grid ── */}
        <View style={styles.grid}>
          {/* Add new content tile */}
          <Pressable
            onPress={() => parentNavigate(navigation, 'CreateFlow')}
            style={styles.addTile}>
            <View style={styles.addTileInner}>
              <Plus size={28} color="rgba(255,255,255,0.5)" />
              <Text style={styles.addTileText}>New</Text>
            </View>
          </Pressable>

          {/* Sample post tiles */}
          {SAMPLE_POSTS.map((uri, i) => (
            <Pressable
              key={i}
              onPress={() => {
                if (gridTab === 'saved') {
                  parentNavigate(navigation, 'SavedPosts');
                  return;
                }
                parentNavigate(navigation, 'PostDetail', {postId: String(i + 1)});
              }}
              style={styles.gridTile}>
              <Image source={{uri}} style={styles.gridImg} />
              {gridTab === 'reels' && (
                <View style={styles.reelIcon}>
                  <Play size={12} color="#fff" fill="#fff" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {SAMPLE_POSTS.length === 0 && (
          <View style={styles.emptyState}>
            <Camera size={40} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubText}>Share your first moment</Text>
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
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerUsername: {
    color: '#fff',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emailLine: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
  bioText: {
    color: 'rgba(255,255,255,0.75)',
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
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
  },
  metaBadgeText: {
    color: 'rgba(255,255,255,0.45)',
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
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileText: {
    color: 'rgba(255,255,255,0.4)',
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
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubText: {
    color: 'rgba(255,255,255,0.25)',
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  settingsClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    color: '#fff',
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
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsAccountHandle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 2,
  },
  settingsGroupTitle: {
    color: 'rgba(255,255,255,0.35)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
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
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 2,
  },
});
