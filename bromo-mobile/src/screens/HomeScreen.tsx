import React, {useCallback, useState} from 'react';
import type {ComponentType} from 'react';
import {
  FlatList,
  Image,
  Pressable,
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
  Play,
  MapPin,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedText} from '../components/ui/ThemedText';
import {StoryRing} from '../components/ui/StoryRing';
import {SearchBar} from '../components/ui/SearchBar';
import {Card} from '../components/ui/Card';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';

type IconComp = ComponentType<{size?: number; color?: string}>;

const CATEGORIES: {id: string; label: string; Icon: IconComp}[] = [
  {id: 'home', label: 'For You', Icon: Home},
  {id: 'trending', label: 'Trending', Icon: Flame},
  {id: 'politics', label: 'Politics', Icon: Landmark},
  {id: 'sports', label: 'Sports', Icon: Trophy},
  {id: 'shopping', label: 'Shopping', Icon: ShoppingBag},
  {id: 'tech', label: 'Tech', Icon: Laptop},
];

const STORIES = [
  {id: '0', username: 'Your Story', uri: 'https://i.pravatar.cc/100?u=me', isOwn: true},
  {id: '1', username: 'Rohan_K', uri: 'https://i.pravatar.cc/100?img=12', hasStory: true},
  {id: '2', username: 'Priya.V', uri: 'https://i.pravatar.cc/100?img=1', hasStory: true},
  {id: '3', username: 'Tech_Bro', uri: 'https://i.pravatar.cc/100?img=9', hasStory: true},
  {id: '4', username: 'Anjali_22', uri: 'https://i.pravatar.cc/100?img=5', hasStory: true},
  {id: '5', username: 'Sid_P', uri: 'https://i.pravatar.cc/100?img=11', hasStory: true},
];

const REELS = [
  {id: '1', uri: 'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=400', views: '1.2M'},
  {id: '2', uri: 'https://images.unsplash.com/photo-1514525253361-bee8718a7439?w=400', views: '950K'},
  {id: '3', uri: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400', views: '1.5M'},
  {id: '4', uri: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400', views: '890K'},
];

const POSTS = [
  {
    id: '1',
    username: 'Leader Maharashtra',
    handle: 'leader_mh',
    avatar: 'https://i.pravatar.cc/100?img=12',
    location: 'Mumbai',
    time: '2h ago',
    verified: 'gold',
    image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800',
    caption: 'आजचा दिवस ऐतिहासिक! विकासाची नवी दिशा. #Maharashtra #Progress',
    likes: '24.5k',
    comments: '890',
    views: '145k',
    music: 'Original Audio • Marathi Beats',
    hasStory: true,
  },
  {
    id: '2',
    username: 'Travel Katta',
    handle: 'travel_katta',
    avatar: 'https://i.pravatar.cc/100?img=40',
    location: 'Pune',
    time: '4h ago',
    verified: null,
    image: 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=800',
    caption: 'Exploring the hidden gems of Maharashtra. #Travel #Explore',
    likes: '8.2k',
    comments: '234',
    views: '42k',
    music: 'Trending Sound',
    hasStory: false,
  },
  {
    id: '3',
    username: 'Business Guru',
    handle: 'biz_guru',
    avatar: 'https://i.pravatar.cc/100?img=33',
    location: 'Delhi',
    time: '6h ago',
    verified: 'blue',
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800',
    caption: 'The secret to building a 7-figure business in 2025. #Business #Entrepreneur',
    likes: '31.1k',
    comments: '1.2k',
    views: '200k',
    music: 'Business Podcast Clip',
    hasStory: true,
  },
];

const SUGGESTIONS = [
  {id: '1', username: 'Siddharth_P', avatar: 'https://i.pravatar.cc/100?img=22', mutual: '12 Mutual Friends'},
  {id: '2', username: 'Anjali_V', avatar: 'https://i.pravatar.cc/100?img=32', mutual: 'Popular in Pune'},
  {id: '3', username: 'Rahul_D', avatar: 'https://i.pravatar.cc/100?img=18', mutual: 'Suggested For You'},
];

type PostCallbacks = {
  onOpenPost: () => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenHeaderStory?: () => void;
  onOpenAudio: () => void;
};

function PostCard({post, actions}: {post: (typeof POSTS)[0]; actions: PostCallbacks}) {
  const {palette, contract, isDark} = useTheme();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  const headerAvatar = post.hasStory ? (
    <Pressable onPress={actions.onOpenHeaderStory} disabled={!actions.onOpenHeaderStory}>
      <StoryRing uri={post.avatar} size={36} />
    </Pressable>
  ) : (
    <Image source={{uri: post.avatar}} style={{width: 36, height: 36, borderRadius: 18}} />
  );

  return (
    <View style={{borderBottomWidth: 8, borderBottomColor: isDark ? '#0a0a0a' : '#f4f4f5', backgroundColor: palette.background}}>
      {/* Header */}
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          {headerAvatar}
          <View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <ThemedText variant="label" style={{fontSize: 13}}>{post.username}</ThemedText>
              {post.verified === 'gold' && (
                <BadgeCheck size={15} color="#FFD700" fill="#FFD700" strokeWidth={2} />
              )}
              {post.verified === 'blue' && (
                <BadgeCheck size={15} color="#3b82f6" fill="#3b82f6" strokeWidth={2} />
              )}
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1}}>
              <MapPin size={9} color={palette.mutedForeground} />
              <ThemedText variant="caption">{post.location} • {post.time}</ThemedText>
            </View>
          </View>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          {!post.hasStory && (
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

      {/* Caption above image */}
      {post.caption && (
        <View style={{paddingHorizontal: 14, paddingBottom: 8}}>
          <ThemedText variant="body" style={{fontSize: 13, lineHeight: 19}}>{post.caption}</ThemedText>
        </View>
      )}

      {/* Image */}
      <Pressable onPress={actions.onOpenPost}>
        <Image
          source={{uri: post.image}}
          style={{width: '100%', aspectRatio: 1, resizeMode: 'cover'}}
        />
      </Pressable>

      {/* Actions */}
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12}}>
        <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
          <Pressable onPress={() => setLiked(p => !p)} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <Heart size={24} color={liked ? '#ef4444' : palette.foreground} fill={liked ? '#ef4444' : 'transparent'} />
            <ThemedText variant="label">{post.likes}</ThemedText>
          </Pressable>
          <Pressable onPress={actions.onOpenComments} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <MessageCircle size={24} color={palette.foreground} />
            <ThemedText variant="label">{post.comments}</ThemedText>
          </Pressable>
          <Pressable onPress={actions.onOpenShare}>
            <Send size={24} color={palette.foreground} />
          </Pressable>
        </View>
        <Pressable onPress={() => setBookmarked(p => !p)}>
          <Bookmark size={24} color={bookmarked ? palette.primary : palette.foreground} fill={bookmarked ? palette.primary : 'transparent'} />
        </Pressable>
      </View>

      {/* Views + Music */}
      <View style={{paddingHorizontal: 14, paddingBottom: 14}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4}}>
          <Eye size={11} color={palette.mutedForeground} />
          <ThemedText variant="caption">{post.views} Views</ThemedText>
        </View>
        <Pressable onPress={actions.onOpenAudio} style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
          <Music2 size={10} color={palette.mutedForeground} />
          <ThemedText variant="caption">{post.music}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export function HomeScreen() {
  const {palette, contract, isDark} = useTheme();
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeCategory, setActiveCategory] = useState('home');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipRadius = borderRadiusScale === 'bold' ? 999 : 12;

  const openProfile = useCallback(() => {
    parentNavigate(navigation, 'Profile');
  }, [navigation]);

  const postActions = useCallback(
    (post: (typeof POSTS)[0]): PostCallbacks => ({
      onOpenPost: () => parentNavigate(navigation, 'PostDetail', {postId: post.id}),
      onOpenComments: () => parentNavigate(navigation, 'Comments'),
      onOpenShare: () => parentNavigate(navigation, 'ShareSend', {postId: post.id}),
      onOpenHeaderStory: post.hasStory
        ? () => parentNavigate(navigation, 'StoryView', {userId: post.handle})
        : undefined,
      onOpenAudio: () => parentNavigate(navigation, 'ReuseAudio', {audioId: post.id}),
    }),
    [navigation],
  );

  const collapseSearch = useCallback(() => {
    setSearchExpanded(false);
    setHomeSearchQuery('');
  }, []);

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
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
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
            <Pressable
              onPress={collapseSearch}
              hitSlop={12}
              accessibilityLabel="Close search"
              style={{padding: 4}}>
              <X size={22} color={palette.foreground} />
            </Pressable>
          </>
        ) : (
          <>
            <View style={{flex: 1}} />
            <Pressable
              onPress={() => setSearchExpanded(true)}
              hitSlop={12}
              accessibilityLabel="Open search"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.input,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Search size={20} color={palette.foreground} />
            </Pressable>
            <Pressable
              hitSlop={8}
              accessibilityLabel="Notifications"
              onPress={() => parentNavigate(navigation, 'Notifications')}>
              <Bell size={22} color={palette.foreground} />
            </Pressable>
            <Pressable
              hitSlop={8}
              accessibilityLabel="Messages"
              onPress={() => parentNavigate(navigation, 'MessagesFlow')}>
              <MessageCircle size={22} color={palette.foreground} />
            </Pressable>
            <Pressable
              onPress={openProfile}
              hitSlop={8}
              accessibilityLabel="Profile"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: palette.border,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.muted,
              }}>
              <User size={20} color={palette.foreground} />
            </Pressable>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: tabBarHeight + 16}}>
        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 10, gap: 8}}
          style={{borderBottomWidth: 1, borderBottomColor: palette.border}}>
          {CATEGORIES.map(cat => {
            const CatIcon = cat.Icon;
            const chipOn = activeCategory === cat.id;
            const fg = chipOn ? palette.background : palette.foreground;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                onLongPress={() => parentNavigate(navigation, 'CategoryFeed', {categoryId: cat.id})}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: chipRadius,
                  borderWidth: 1,
                  borderColor: chipOn ? palette.primary : palette.border,
                  backgroundColor: chipOn ? palette.primary : isDark ? '#0a0a0a' : '#f9f9f9',
                }}>
                <CatIcon size={15} color={chipOn ? palette.primaryForeground : fg} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: chipOn ? palette.primaryForeground : palette.foreground,
                  }}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Stories Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 14, paddingVertical: 14, gap: 16}}
          style={{borderBottomWidth: 1, borderBottomColor: palette.border}}>
          {STORIES.map(story => (
            <Pressable
              key={story.id}
              style={{alignItems: 'center', gap: 5}}
              onPress={() => {
                if (story.isOwn) {
                  parentNavigate(navigation, 'CreateFlow');
                  return;
                }
                parentNavigate(navigation, 'StoryView', {userId: story.username});
              }}>
              {story.isOwn ? (
                <View style={{position: 'relative'}}>
                  <Image
                    source={{uri: story.uri}}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      borderWidth: 2,
                      borderColor: palette.border,
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: palette.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: palette.background,
                    }}>
                    <Plus size={13} color={palette.primaryForeground} strokeWidth={3} />
                  </View>
                </View>
              ) : (
                <StoryRing uri={story.uri} size={60} />
              )}
              <ThemedText variant="caption" style={{maxWidth: 64}} numberOfLines={1}>
                {story.username}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Trending Reels */}
        <View style={{paddingVertical: 16}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Zap size={16} color={palette.primary} fill={palette.primary} />
              <ThemedText variant="heading" style={{fontSize: 14}}>Trending Reels</ThemedText>
              <Flame size={16} color={palette.primary} />
            </View>
            <ThemedText variant="primary" style={{fontSize: 11, fontWeight: '700'}}>See All</ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 14, gap: 12}}>
            {REELS.map(reel => (
              <Pressable
                key={reel.id}
                onPress={() => parentNavigate(navigation, 'PostDetail', {postId: reel.id})}
                style={{
                  width: 150,
                  height: 240,
                  borderRadius: borderRadiusScale === 'bold' ? 18 : 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: palette.border,
                }}>
                <Image source={{uri: reel.uri}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 10,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                  }}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                    <Play size={10} color="#fff" fill="#fff" />
                    <Text style={{color: '#fff', fontSize: 10, fontWeight: '700'}}>{reel.views}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Post 1 */}
        <PostCard post={POSTS[0]} actions={postActions(POSTS[0])} />

        {/* Suggestions */}
        <View style={{paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Users size={16} color={palette.primary} />
              <ThemedText variant="heading" style={{fontSize: 14}}>People You May Know</ThemedText>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 14, gap: 12}}>
            {SUGGESTIONS.map(s => (
              <Pressable
                key={s.id}
                onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: s.username})}>
              <Card
                style={{
                  width: 160,
                  padding: 14,
                  alignItems: 'center',
                }}>
                <Image
                  source={{uri: s.avatar}}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderWidth: 2,
                    borderColor: palette.primary,
                    marginBottom: 8,
                  }}
                />
                <ThemedText variant="label" style={{textAlign: 'center'}} numberOfLines={1}>{s.username}</ThemedText>
                <ThemedText variant="caption" style={{textAlign: 'center', marginTop: 2}}>{s.mutual}</ThemedText>
                <Pressable
                  style={{
                    marginTop: 10,
                    backgroundColor: palette.primary,
                    borderRadius: borderRadiusScale === 'bold' ? 10 : 6,
                    paddingVertical: 8,
                    width: '100%',
                    alignItems: 'center',
                  }}>
                  <Text style={{color: palette.primaryForeground, fontSize: 12, fontWeight: '800'}}>Follow</Text>
                </Pressable>
              </Card>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Remaining Posts */}
        {POSTS.slice(1).map(post => (
          <PostCard key={post.id} post={post} actions={postActions(post)} />
        ))}

        <View style={{height: 20}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}
