import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import type {NavigationProp} from '@react-navigation/native';
import {BadgeCheck, TrendingUp, Hash, MapPin, ShoppingBag, Users} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedText} from '../components/ui/ThemedText';
import {SearchBar} from '../components/ui/SearchBar';
import {Card} from '../components/ui/Card';
import {Badge} from '../components/ui/Badge';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {searchUsers, getUserSuggestions, followUser, unfollowUser, type SuggestedUser} from '../api/followApi';
import {getExplore, type Post} from '../api/postsApi';

type Nav = NavigationProp<Record<string, object | undefined>> & {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

const TRENDING_TOPICS = [
  {id: '1', tag: '#Maharashtra', posts: '2.4M posts', category: 'Politics'},
  {id: '2', tag: '#StartupIndia', posts: '1.1M posts', category: 'Business'},
  {id: '3', tag: '#IPL2025', posts: '5.8M posts', category: 'Sports'},
  {id: '4', tag: '#TechNews', posts: '890K posts', category: 'Tech'},
  {id: '5', tag: '#Bollywood', posts: '3.2M posts', category: 'Entertainment'},
  {id: '6', tag: '#LocalFood', posts: '450K posts', category: 'Lifestyle'},
];

const FILTER_TABS = [
  {id: 'explore', label: 'Explore', icon: TrendingUp},
  {id: 'people', label: 'People', icon: Users},
  {id: 'tags', label: 'Tags', icon: Hash},
  {id: 'places', label: 'Places', icon: MapPin},
  {id: 'shops', label: 'Shops', icon: ShoppingBag},
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function PersonRow({
  user,
  navigation,
  palette,
  borderRadiusScale,
  currentUserId,
}: {
  user: SuggestedUser & {followStatus?: string};
  navigation: Nav;
  palette: ReturnType<typeof useTheme>['palette'];
  borderRadiusScale: string;
  currentUserId?: string;
}) {
  const [followStatus, setFollowStatus] = useState(user.followStatus ?? 'none');
  const isSelf = currentUserId === user._id;

  const handleFollow = async () => {
    if (isSelf) return;
    try {
      if (followStatus === 'following') {
        await unfollowUser(user._id);
        setFollowStatus('none');
      } else {
        const res = await followUser(user._id);
        setFollowStatus(res.status === 'pending' ? 'requested' : 'following');
      }
    } catch {}
  };

  const avatarUri = user.profilePicture || `https://ui-avatars.com/api/?name=${user.displayName}`;

  return (
    <Pressable onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: user._id})}>
      <Card style={{padding: 14}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <Image
            source={{uri: avatarUri}}
            style={{width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: palette.primary}}
          />
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
              <ThemedText variant="label">{user.displayName}</ThemedText>
              {user.emailVerified && (
                <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
              )}
            </View>
            <ThemedText variant="caption">@{user.username}</ThemedText>
            <ThemedText variant="caption">{formatCount(user.followersCount ?? 0)} followers</ThemedText>
          </View>
          {!isSelf && (
            <Pressable
              onPress={handleFollow}
              style={{
                backgroundColor: followStatus === 'none' ? palette.primary : 'transparent',
                borderWidth: 1,
                borderColor: palette.primary,
                borderRadius: borderRadiusScale === 'bold' ? 10 : 6,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}>
              <Text style={{
                color: followStatus === 'none' ? palette.primaryForeground : palette.primary,
                fontSize: 12,
                fontWeight: '800',
              }}>
                {followStatus === 'following' ? 'Following' : followStatus === 'requested' ? 'Requested' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export function SearchScreen() {
  const navigation = useNavigation() as Nav;
  const {palette, contract, isDark} = useTheme();
  const {dbUser} = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipRadius = borderRadiusScale === 'bold' ? 999 : 10;

  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [searchResults, setSearchResults] = useState<(SuggestedUser & {followStatus?: string})[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingExplore, setLoadingExplore] = useState(false);

  useEffect(() => {
    if (activeTab === 'people' && suggestions.length === 0) {
      setLoadingPeople(true);
      getUserSuggestions(20)
        .then(res => setSuggestions(res.users))
        .catch(() => {})
        .finally(() => setLoadingPeople(false));
    }
    if (activeTab === 'explore' && explorePosts.length === 0) {
      setLoadingExplore(true);
      getExplore(1)
        .then(res => setExplorePosts(res.posts))
        .catch(() => {})
        .finally(() => setLoadingExplore(false));
    }
  }, [activeTab]);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await searchUsers(q.trim());
      setSearchResults(res.users);
    } catch {
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const showSearchResults = query.trim().length > 0;

  return (
    <ThemedSafeScreen edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: palette.background,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          gap: 12,
        }}>
        <ThemedText variant="heading" style={{fontSize: 20, fontStyle: 'italic', color: palette.primary}}>
          Explore
        </ThemedText>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search people, tags, places..."
          onSubmitEditing={() => {
            if (query.trim()) {
              parentNavigate(navigation, 'SearchResults', {query: query.trim()});
            }
          }}
        />
        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap: 8}}>
          {FILTER_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 14, paddingVertical: 7,
                  borderRadius: chipRadius,
                  backgroundColor: isActive ? palette.primary : isDark ? palette.surface : palette.card,
                  borderWidth: 1,
                  borderColor: isActive ? palette.primary : palette.border,
                }}>
                <Icon size={12} color={isActive ? palette.primaryForeground : palette.mutedForeground} />
                <Text style={{fontSize: 12, fontWeight: '700', color: isActive ? palette.primaryForeground : palette.foreground}}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: tabBarHeight + 16}}>

        {/* Live search results overlay */}
        {showSearchResults && (
          <View style={{paddingHorizontal: 14, paddingTop: 12}}>
            <ThemedText variant="heading" style={{fontSize: 14, marginBottom: 10}}>
              {loadingSearch ? 'Searching...' : `Results for "${query}"`}
            </ThemedText>
            {loadingSearch ? (
              <ActivityIndicator color={palette.primary} />
            ) : searchResults.length === 0 ? (
              <ThemedText variant="muted" style={{textAlign: 'center', paddingVertical: 20}}>
                No users found for "{query}"
              </ThemedText>
            ) : (
              <View style={{gap: 10}}>
                {searchResults.map(user => (
                  <PersonRow
                    key={user._id}
                    user={user}
                    navigation={navigation}
                    palette={palette}
                    borderRadiusScale={borderRadiusScale}
                    currentUserId={dbUser?._id}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Explore tab */}
        {!showSearchResults && activeTab === 'explore' && (
          <>
            <View style={{padding: 14}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12}}>
                <TrendingUp size={14} color={palette.primary} />
                <ThemedText variant="heading" style={{fontSize: 14}}>Trending Now</ThemedText>
              </View>
              {TRENDING_TOPICS.map((topic, index) => (
                <Pressable
                  key={topic.id}
                  onPress={() => parentNavigate(navigation, 'HashtagDetail', {tag: topic.tag.replace(/^#/, '')})}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: index < TRENDING_TOPICS.length - 1 ? 1 : 0,
                    borderBottomColor: palette.border,
                  }}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <ThemedText variant="muted" style={{fontSize: 14, fontWeight: '900', width: 20}}>{index + 1}</ThemedText>
                    <View>
                      <ThemedText variant="label" style={{fontSize: 14}}>{topic.tag}</ThemedText>
                      <ThemedText variant="caption">{topic.posts}</ThemedText>
                    </View>
                  </View>
                  <Badge label={topic.category} variant="muted" />
                </Pressable>
              ))}
            </View>

            {/* Explore Grid */}
            <View style={{padding: 14}}>
              <ThemedText variant="heading" style={{fontSize: 14, marginBottom: 12}}>Explore Posts</ThemedText>
              {loadingExplore ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <View style={{flexDirection: 'row', gap: 3}}>
                  {[0, 1, 2].map(col => (
                    <View key={col} style={{flex: 1, gap: 3}}>
                      {explorePosts.filter((_, i) => i % 3 === col).map((post, i) => (
                        <Pressable
                          key={post._id}
                          onPress={() => parentNavigate(navigation, 'PostDetail', {postId: post._id})}>
                          <Image
                            source={{uri: post.mediaUrl}}
                            style={{width: '100%', aspectRatio: i % 2 === 0 ? 0.8 : 1, borderRadius: 4}}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* People tab */}
        {!showSearchResults && activeTab === 'people' && (
          <View style={{padding: 14, gap: 12}}>
            <ThemedText variant="heading" style={{fontSize: 14, marginBottom: 4}}>Suggested People</ThemedText>
            {loadingPeople ? (
              <ActivityIndicator color={palette.primary} />
            ) : suggestions.length === 0 ? (
              <ThemedText variant="muted" style={{textAlign: 'center', paddingVertical: 30}}>
                No suggestions available
              </ThemedText>
            ) : (
              suggestions.map(user => (
                <PersonRow
                  key={user._id}
                  user={user}
                  navigation={navigation}
                  palette={palette}
                  borderRadiusScale={borderRadiusScale}
                />
              ))
            )}
          </View>
        )}

        {!showSearchResults && (activeTab === 'tags' || activeTab === 'places' || activeTab === 'shops') && (
          <View style={{padding: 40, alignItems: 'center', gap: 16}}>
            {activeTab === 'tags' ? (
              <Hash size={40} color={palette.mutedForeground} strokeWidth={1.5} />
            ) : activeTab === 'places' ? (
              <MapPin size={40} color={palette.mutedForeground} strokeWidth={1.5} />
            ) : (
              <ShoppingBag size={40} color={palette.mutedForeground} strokeWidth={1.5} />
            )}
            <ThemedText variant="muted" style={{marginTop: 12, textAlign: 'center'}}>
              Type above to search {activeTab}.
            </ThemedText>
          </View>
        )}

        <View style={{height: 20}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}
