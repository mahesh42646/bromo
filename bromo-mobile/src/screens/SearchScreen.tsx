import React, {useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import {BadgeCheck, TrendingUp, Hash, MapPin, ShoppingBag, Users} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedText} from '../components/ui/ThemedText';
import {SearchBar} from '../components/ui/SearchBar';
import {Card} from '../components/ui/Card';
import {Badge} from '../components/ui/Badge';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';

const TRENDING_TOPICS = [
  {id: '1', tag: '#Maharashtra', posts: '2.4M posts', category: 'Politics'},
  {id: '2', tag: '#StartupIndia', posts: '1.1M posts', category: 'Business'},
  {id: '3', tag: '#IPL2025', posts: '5.8M posts', category: 'Sports'},
  {id: '4', tag: '#TechNews', posts: '890K posts', category: 'Tech'},
  {id: '5', tag: '#Bollywood', posts: '3.2M posts', category: 'Entertainment'},
  {id: '6', tag: '#LocalFood', posts: '450K posts', category: 'Lifestyle'},
];

const EXPLORE_GRID = [
  {id: '1', uri: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300', tall: true},
  {id: '2', uri: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=300', tall: false},
  {id: '3', uri: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300', tall: false},
  {id: '4', uri: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=300', tall: true},
  {id: '5', uri: 'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=300', tall: false},
  {id: '6', uri: 'https://images.unsplash.com/photo-1514525253361-bee8718a7439?w=300', tall: false},
  {id: '7', uri: 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=300', tall: false},
  {id: '8', uri: 'https://images.unsplash.com/photo-1555133539-4a34610018f1?w=300', tall: true},
  {id: '9', uri: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=300', tall: false},
];

const PEOPLE = [
  {id: '1', name: 'Amit Desai', handle: 'amit_d', avatar: 'https://i.pravatar.cc/100?img=18', followers: '42.5K', verified: true},
  {id: '2', name: 'Snehal Joshi', handle: 'snehal_22', avatar: 'https://i.pravatar.cc/100?img=32', followers: '18.2K', verified: false},
  {id: '3', name: 'Rahul Sharma', handle: 'rahul_s', avatar: 'https://i.pravatar.cc/100?img=15', followers: '95.1K', verified: true},
];

const FILTER_TABS = [
  {id: 'explore', label: 'Explore', icon: TrendingUp},
  {id: 'people', label: 'People', icon: Users},
  {id: 'tags', label: 'Tags', icon: Hash},
  {id: 'places', label: 'Places', icon: MapPin},
  {id: 'shops', label: 'Shops', icon: ShoppingBag},
];

export function SearchScreen() {
  const navigation = useNavigation();
  const {palette, contract, isDark} = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipRadius = borderRadiusScale === 'bold' ? 999 : 10;

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
        <Pressable onPress={() => parentNavigate(navigation, 'ExploreHome')}>
          <ThemedText variant="heading" style={{fontSize: 20, fontStyle: 'italic', color: palette.primary}}>
            Explore
          </ThemedText>
        </Pressable>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search people, tags, places..."
          onSubmitEditing={() => {
            const q = query.trim() || 'bromo';
            parentNavigate(navigation, 'SearchResults', {query: q});
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
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: chipRadius,
                  backgroundColor: isActive ? palette.primary : isDark ? palette.surface : palette.card,
                  borderWidth: 1,
                  borderColor: isActive ? palette.primary : palette.border,
                }}>
                <Icon size={12} color={isActive ? palette.primaryForeground : palette.mutedForeground} />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isActive ? palette.primaryForeground : palette.foreground,
                }}>
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
        {activeTab === 'explore' && (
          <>
            {/* Trending Topics */}
            <View style={{padding: 14}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12}}>
                <TrendingUp size={14} color={palette.primary} />
                <ThemedText variant="heading" style={{fontSize: 14}}>Trending Now</ThemedText>
              </View>
              {TRENDING_TOPICS.map((topic, index) => (
                <Pressable
                  key={topic.id}
                  onPress={() =>
                    parentNavigate(navigation, 'HashtagDetail', {
                      tag: topic.tag.replace(/^#/, ''),
                    })
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: index < TRENDING_TOPICS.length - 1 ? 1 : 0,
                    borderBottomColor: palette.border,
                  }}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <ThemedText variant="muted" style={{fontSize: 14, fontWeight: '900', width: 20}}>
                      {index + 1}
                    </ThemedText>
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
              <View style={{flexDirection: 'row', gap: 3}}>
                {/* Left column */}
                <View style={{flex: 1, gap: 3}}>
                  {EXPLORE_GRID.filter((_, i) => i % 3 === 0).map(item => (
                    <Pressable
                      key={item.id}
                      onPress={() => parentNavigate(navigation, 'PostDetail', {postId: item.id})}>
                      <Image
                        source={{uri: item.uri}}
                        style={{
                          width: '100%',
                          aspectRatio: item.tall ? 0.7 : 1,
                          borderRadius: 4,
                        }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </View>
                {/* Middle column */}
                <View style={{flex: 1, gap: 3}}>
                  {EXPLORE_GRID.filter((_, i) => i % 3 === 1).map(item => (
                    <Pressable
                      key={item.id}
                      onPress={() => parentNavigate(navigation, 'PostDetail', {postId: item.id})}>
                      <Image
                        source={{uri: item.uri}}
                        style={{
                          width: '100%',
                          aspectRatio: item.tall ? 0.7 : 1,
                          borderRadius: 4,
                        }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </View>
                {/* Right column */}
                <View style={{flex: 1, gap: 3}}>
                  {EXPLORE_GRID.filter((_, i) => i % 3 === 2).map(item => (
                    <Pressable
                      key={item.id}
                      onPress={() => parentNavigate(navigation, 'PostDetail', {postId: item.id})}>
                      <Image
                        source={{uri: item.uri}}
                        style={{
                          width: '100%',
                          aspectRatio: item.tall ? 0.7 : 1,
                          borderRadius: 4,
                        }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {activeTab === 'people' && (
          <View style={{padding: 14, gap: 12}}>
            <ThemedText variant="heading" style={{fontSize: 14, marginBottom: 4}}>Suggested People</ThemedText>
            {PEOPLE.map(person => (
              <Pressable
                key={person.id}
                onPress={() => parentNavigate(navigation, 'OtherUserProfile', {userId: person.handle})}>
              <Card style={{padding: 14}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                  <Image
                    source={{uri: person.avatar}}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      borderWidth: 2,
                      borderColor: palette.primary,
                    }}
                  />
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                      <ThemedText variant="label">{person.name}</ThemedText>
                      {person.verified && (
                        <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
                      )}
                    </View>
                    <ThemedText variant="caption">@{person.handle}</ThemedText>
                    <ThemedText variant="caption">{person.followers} followers</ThemedText>
                  </View>
                  <Pressable
                    style={{
                      backgroundColor: palette.primary,
                      borderRadius: borderRadiusScale === 'bold' ? 10 : 6,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                    }}>
                    <Text style={{color: palette.primaryForeground, fontSize: 12, fontWeight: '800'}}>Follow</Text>
                  </Pressable>
                </View>
              </Card>
              </Pressable>
            ))}
          </View>
        )}

        {(activeTab === 'tags' || activeTab === 'places' || activeTab === 'shops') && (
          <View style={{padding: 40, alignItems: 'center', gap: 16}}>
            {activeTab === 'tags' ? (
              <Hash size={40} color={palette.mutedForeground} strokeWidth={1.5} />
            ) : activeTab === 'places' ? (
              <MapPin size={40} color={palette.mutedForeground} strokeWidth={1.5} />
            ) : (
              <ShoppingBag size={40} color={palette.mutedForeground} strokeWidth={1.5} />
            )}
            <ThemedText variant="muted" style={{marginTop: 12, textAlign: 'center'}}>
              Type above or open a curated hub for {activeTab}.
            </ThemedText>
            <Pressable
              onPress={() => {
                if (activeTab === 'tags') {
                  parentNavigate(navigation, 'ExploreHome');
                } else if (activeTab === 'places') {
                  parentNavigate(navigation, 'NearbyPeople');
                } else {
                  parentNavigate(navigation, 'StoreNearbyHome');
                }
              }}
              style={{
                backgroundColor: palette.primary,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: chipRadius,
              }}>
              <Text style={{color: palette.primaryForeground, fontWeight: '800', fontSize: 13}}>
                {activeTab === 'tags' ? 'Open explore' : activeTab === 'places' ? 'Nearby people' : 'Store map'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{height: 20}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}
