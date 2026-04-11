import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {ComponentType} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import {
  BadgeCheck,
  Bookmark,
  Bell,
  Eye,
  Flame,
  Heart,
  Home,
  Landmark,
  Laptop,
  MessageCircle,
  MoreHorizontal,
  Music2,
  MapPin,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react-native';
import type {NavigationProp} from '@react-navigation/native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedText} from '../components/ui/ThemedText';
import {StoryRing} from '../components/ui/StoryRing';
import {SearchBar} from '../components/ui/SearchBar';
import {Card} from '../components/ui/Card';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {getFeed, getStories, toggleLike, type Post, type StoryGroup} from '../api/postsApi';
import {getUserSuggestions, followUser, unfollowUser, type SuggestedUser} from '../api/followApi';

type IconComp = ComponentType<{size?: number; color?: string}>;

const CATEGORIES: {id: string; label: string; Icon: IconComp}[] = [
  {id: 'home', label: 'For You', Icon: Home},
  {id: 'trending', label: 'Trending', Icon: Flame},
  {id: 'politics', label: 'Politics', Icon: Landmark},
  {id: 'sports', label: 'Sports', Icon: Trophy},
  {id: 'shopping', label: 'Shopping', Icon: ShoppingBag},
  {id: 'tech', label: 'Tech', Icon: Laptop},
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

type PostCardProps = {
  post: Post;
  onLikeToggle: (postId: string) => void;
  navigation: Nav;
};

function PostCard({post, onLikeToggle, navigation}: PostCardProps) {
  const {palette, contract} = useTheme();
  const [bookmarked, setBookmarked] = useState(false);
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const hasStory = false; // TODO: derive from story API

  const headerAvatar = hasStory ? (
    <Pressable onPress={() => parentNavigate(navigation, 'StoryView', {userId: post.author.username})}>
      <StoryRing uri={post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`} size={36} />
    </Pressable>
  ) : (
    <Image
      source={{uri: post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.displayName}`}}
      style={{width: 36, height: 36, borderRadius: 18}}
    />
  );

  return (
    <View style={{borderBottomWidth: 8, borderBottomColor: palette.background, backgroundColor: palette.background}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12}}>
        <Pressable
          style={{flexDirection: 'row', alignItems: 'center', gap: 10}}
          onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: post.author._id})}>
          {headerAvatar}
          <View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <ThemedText variant="label" style={{fontSize: 13}}>{post.author.displayName}</ThemedText>
              {post.author.emailVerified && (
                <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
              )}
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1}}>
              {post.location ? (
                <>
                  <MapPin size={9} color={palette.mutedForeground} />
                  <ThemedText variant="caption">{post.location} • {timeAgo(post.createdAt)}</ThemedText>
                </>
              ) : (
                <ThemedText variant="caption">{timeAgo(post.createdAt)}</ThemedText>
              )}
            </View>
          </View>
        </Pressable>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          {!post.isFollowing && (
            <Pressable
              style={{
                borderWidth: 1,
                borderColor: `${palette.primary}50`,
                borderRadius: radius,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}>
              <ThemedText variant="primary" style={{fontSize: 11, fontWeight: '800'}}>Follow</ThemedText>
            </Pressable>
          )}
          <MoreHorizontal size={18} color={palette.mutedForeground} />
        </View>
      </View>

      {post.caption ? (
        <View style={{paddingHorizontal: 14, paddingBottom: 8}}>
          <ThemedText variant="body" style={{fontSize: 13, lineHeight: 19}}>{post.caption}</ThemedText>
        </View>
      ) : null}

      <Pressable onPress={() => parentNavigate(navigation, 'PostDetail', {postId: post._id})}>
        <Image
          source={{uri: post.mediaUrl}}
          style={{width: '100%', aspectRatio: 1, resizeMode: 'cover'}}
        />
      </Pressable>

      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12}}>
        <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
          <Pressable onPress={() => onLikeToggle(post._id)} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <Heart
              size={24}
              color={post.isLiked ? palette.destructive : palette.foreground}
              fill={post.isLiked ? palette.destructive : 'transparent'}
            />
            <ThemedText variant="label">{formatCount(post.likesCount)}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => parentNavigate(navigation, 'Comments', {postId: post._id})}
            style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <MessageCircle size={24} color={palette.foreground} />
            <ThemedText variant="label">{formatCount(post.commentsCount)}</ThemedText>
          </Pressable>
          <Pressable onPress={() => parentNavigate(navigation, 'ShareSend', {postId: post._id})}>
            <Send size={24} color={palette.foreground} />
          </Pressable>
        </View>
        <Pressable onPress={() => setBookmarked(p => !p)}>
          <Bookmark
            size={24}
            color={bookmarked ? palette.primary : palette.foreground}
            fill={bookmarked ? palette.primary : 'transparent'}
          />
        </Pressable>
      </View>

      <View style={{paddingHorizontal: 14, paddingBottom: 14}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4}}>
          <Eye size={11} color={palette.mutedForeground} />
          <ThemedText variant="caption">{formatCount(post.viewsCount)} Views</ThemedText>
        </View>
        {post.music ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <Music2 size={10} color={palette.mutedForeground} />
            <ThemedText variant="caption">{post.music}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type SuggestionCardProps = {
  user: SuggestedUser;
  onFollowToggle: (userId: string, isFollowing: boolean) => void;
  navigation: Nav;
  palette: ReturnType<typeof useTheme>['palette'];
  borderRadiusScale: string;
};

function SuggestionCard({user, onFollowToggle, navigation, palette, borderRadiusScale}: SuggestionCardProps) {
  const [following, setFollowing] = useState(false);

  const handleFollow = async () => {
    try {
      if (following) {
        await unfollowUser(user._id);
        setFollowing(false);
      } else {
        await followUser(user._id);
        setFollowing(true);
      }
      onFollowToggle(user._id, !following);
    } catch {}
  };

  return (
    <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: user._id})}>
      <Card style={{width: 160, padding: 14, alignItems: 'center'}}>
        <Image
          source={{uri: user.profilePicture || `https://ui-avatars.com/api/?name=${user.displayName}`}}
          style={{width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: palette.primary, marginBottom: 8}}
        />
        <ThemedText variant="label" style={{textAlign: 'center'}} numberOfLines={1}>{user.displayName}</ThemedText>
        <ThemedText variant="caption" style={{textAlign: 'center', marginTop: 2}} numberOfLines={1}>
          @{user.username}
        </ThemedText>
        <ThemedText variant="caption" style={{textAlign: 'center', marginTop: 2}}>
          {formatCount(user.followersCount)} followers
        </ThemedText>
        <Pressable
          onPress={handleFollow}
          style={{
            marginTop: 10,
            backgroundColor: following ? 'transparent' : palette.primary,
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: borderRadiusScale === 'bold' ? 10 : 6,
            paddingVertical: 8,
            width: '100%',
            alignItems: 'center',
          }}>
          <Text style={{color: following ? palette.primary : palette.primaryForeground, fontSize: 12, fontWeight: '800'}}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </Card>
    </Pressable>
  );
}

export function HomeScreen() {
  const {palette, contract, isDark} = useTheme();
  const {dbUser} = useAuth();
  const navigation = useNavigation() as Nav;
  const tabBarHeight = useBottomTabBarHeight();
  const [activeCategory, setActiveCategory] = useState('home');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipRadius = borderRadiusScale === 'bold' ? 999 : 12;

  const [posts, setPosts] = useState<Post[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const initialLoadDone = useRef(false);

  const loadData = useCallback(async (reset = false) => {
    try {
      const p = reset ? 1 : page;
      const [feedRes, storiesRes, suggestionsRes] = await Promise.all([
        getFeed(p),
        reset ? getStories() : Promise.resolve(null),
        reset ? getUserSuggestions(6) : Promise.resolve(null),
      ]);

      if (reset) {
        setPosts(feedRes.posts);
        if (storiesRes) setStoryGroups(storiesRes.stories);
        if (suggestionsRes) setSuggestions(suggestionsRes.users);
        setPage(2);
      } else {
        setPosts(prev => [...prev, ...feedRes.posts]);
        setPage(p + 1);
      }
      setHasMore(feedRes.hasMore);
    } catch (err) {
      console.error('[HomeScreen] loadData error:', err);
    }
  }, [page]);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    setLoading(true);
    loadData(true).finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadData(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, loadData]);

  const handleLikeToggle = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(p =>
        p._id === postId
          ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1}
          : p,
      ),
    );
    toggleLike(postId).catch(() => {
      // Revert on error
      setPosts(prev =>
        prev.map(p =>
          p._id === postId
            ? {...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1}
            : p,
        ),
      );
    });
  }, []);

  const collapseSearch = useCallback(() => {
    setSearchExpanded(false);
    setHomeSearchQuery('');
  }, []);

  const myAvatar = dbUser?.profilePicture || undefined;

  // Interleave posts and suggestions (insert suggestions after 1st post)
  type FeedItem =
    | {kind: 'post'; post: Post; key: string}
    | {kind: 'suggestions'; key: string}
    | {kind: 'stories'; key: string};

  const feedItems: FeedItem[] = [];
  feedItems.push({kind: 'stories', key: 'stories'});
  posts.forEach((p, i) => {
    feedItems.push({kind: 'post', post: p, key: p._id});
    if (i === 0 && suggestions.length > 0) {
      feedItems.push({kind: 'suggestions', key: 'suggestions'});
    }
  });

  return (
    <ThemedSafeScreen edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 10,
          minHeight: 52,
          backgroundColor: palette.background,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          gap: 10,
        }}>
        <ThemedText
          variant="heading"
          numberOfLines={1}
          style={{
            fontSize: 22,
            fontStyle: 'italic',
            letterSpacing: -1,
            color: palette.primary,
            maxWidth: searchExpanded ? 100 : undefined,
          }}>
          {contract.branding.appTitle || 'BROMO'}
        </ThemedText>

        {searchExpanded ? (
          <>
            <SearchBar
              style={{flex: 1, minWidth: 0}}
              placeholder="Search BROMO..."
              value={homeSearchQuery}
              onChangeText={setHomeSearchQuery}
              autoFocus
              onSubmitEditing={() => {
                const q = homeSearchQuery.trim() || 'bromo';
                parentNavigate(navigation, 'SearchResults', {query: q});
                collapseSearch();
              }}
            />
            <Pressable onPress={collapseSearch} hitSlop={12} style={{padding: 4}}>
              <X size={22} color={palette.foreground} />
            </Pressable>
          </>
        ) : (
          <>
            <View style={{flex: 1}} />
            <Pressable
              onPress={() => setSearchExpanded(true)}
              hitSlop={12}
              style={{
                width: 40, height: 40, borderRadius: 20,
                borderWidth: 1, borderColor: palette.border,
                backgroundColor: palette.input,
                alignItems: 'center', justifyContent: 'center',
              }}>
              <Search size={20} color={palette.foreground} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => parentNavigate(navigation, 'Notifications')}>
              <Bell size={22} color={palette.foreground} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => parentNavigate(navigation, 'MessagesFlow')}>
              <MessageCircle size={22} color={palette.foreground} />
            </Pressable>
            <Pressable
              onPress={() => parentNavigate(navigation, 'Profile')}
              hitSlop={8}
              style={{
                width: 36, height: 36, borderRadius: 18,
                borderWidth: 1, borderColor: palette.border,
                overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
                backgroundColor: palette.muted,
              }}>
              {myAvatar ? (
                <Image source={{uri: myAvatar}} style={{width: 36, height: 36, borderRadius: 18}} />
              ) : (
                <User size={20} color={palette.foreground} />
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 10, gap: 8}}
        style={{borderBottomWidth: 1, borderBottomColor: palette.border, maxHeight: 54, minHeight: 54}}>
        {CATEGORIES.map(cat => {
          const CatIcon = cat.Icon;
          const chipOn = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: chipRadius, borderWidth: 1,
                borderColor: chipOn ? palette.primary : palette.border,
                backgroundColor: chipOn ? palette.primary : palette.background,
              }}>
              <CatIcon size={15} color={chipOn ? palette.primaryForeground : palette.foreground} />
              <Text style={{fontSize: 12, fontWeight: '700', color: chipOn ? palette.primaryForeground : palette.foreground}}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: tabBarHeight + 16}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={{alignItems: 'center', paddingTop: 80}}>
              <Users size={48} color={palette.foregroundFaint} />
              <ThemedText variant="body" style={{marginTop: 16, textAlign: 'center', paddingHorizontal: 32}}>
                Follow people to see their posts here
              </ThemedText>
              <Pressable
                onPress={() => parentNavigate(navigation, 'Search')}
                style={{
                  marginTop: 20, backgroundColor: palette.primary,
                  borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28,
                }}>
                <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 14}}>
                  Discover People
                </Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={palette.primary} style={{marginVertical: 20}} />
            ) : null
          }
          renderItem={({item}) => {
            if (item.kind === 'stories') {
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingHorizontal: 14, paddingVertical: 14, gap: 16}}
                  style={{borderBottomWidth: 1, borderBottomColor: palette.border}}>
                  {/* Own story */}
                  <Pressable
                    style={{alignItems: 'center', gap: 5}}
                    onPress={() => parentNavigate(navigation, 'CreateFlow')}>
                    <View style={{position: 'relative'}}>
                      <Image
                        source={{uri: myAvatar || `https://ui-avatars.com/api/?name=${dbUser?.displayName ?? 'You'}`}}
                        style={{width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: palette.border}}
                      />
                      <View
                        style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 22, height: 22, borderRadius: 11,
                          backgroundColor: palette.primary, alignItems: 'center',
                          justifyContent: 'center', borderWidth: 2, borderColor: palette.background,
                        }}>
                        <Plus size={13} color={palette.primaryForeground} strokeWidth={3} />
                      </View>
                    </View>
                    <ThemedText variant="caption" style={{maxWidth: 64}} numberOfLines={1}>Your Story</ThemedText>
                  </Pressable>

                  {/* Following stories */}
                  {storyGroups.map(group => (
                    <Pressable
                      key={group.author._id}
                      style={{alignItems: 'center', gap: 5}}
                      onPress={() => parentNavigate(navigation, 'StoryView', {userId: group.author._id})}>
                      <StoryRing
                        uri={group.author.profilePicture || `https://ui-avatars.com/api/?name=${group.author.displayName}`}
                        size={60}
                      />
                      <ThemedText variant="caption" style={{maxWidth: 64}} numberOfLines={1}>
                        {group.author.username}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              );
            }

            if (item.kind === 'suggestions') {
              return (
                <View style={{paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <Users size={16} color={palette.primary} />
                      <ThemedText variant="heading" style={{fontSize: 14}}>People You May Know</ThemedText>
                    </View>
                    <Pressable onPress={() => parentNavigate(navigation, 'Search')}>
                      <ThemedText variant="primary" style={{fontSize: 11, fontWeight: '700'}}>See All</ThemedText>
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{paddingHorizontal: 14, gap: 12}}>
                    {suggestions.map(s => (
                      <SuggestionCard
                        key={s._id}
                        user={s}
                        onFollowToggle={() => {}}
                        navigation={navigation}
                        palette={palette}
                        borderRadiusScale={borderRadiusScale}
                      />
                    ))}
                  </ScrollView>
                </View>
              );
            }

            if (item.kind === 'post') {
              return (
                <PostCard
                  post={item.post}
                  onLikeToggle={handleLikeToggle}
                  navigation={navigation}
                />
              );
            }

            return null;
          }}
        />
      )}
    </ThemedSafeScreen>
  );
}
