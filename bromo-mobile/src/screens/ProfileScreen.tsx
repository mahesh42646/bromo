import React, {useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  Coins,
  AlignJustify,
  Grid3X3,
  Clapperboard,
  Bookmark,
  Flame,
  Zap,
  Trophy,
  TrendingUp,
  Play,
  Flag,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedText} from '../components/ui/ThemedText';
import {Card} from '../components/ui/Card';
import {Badge} from '../components/ui/Badge';
import {PrimaryButton} from '../components/ui/PrimaryButton';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';

const PROFILE = {
  name: 'Siddharth Patil',
  handle: 'siddharth_patil',
  avatar: 'https://i.pravatar.cc/150?img=11',
  bioLines: [
    'Proud Indian · Entrepreneur',
    'Mining H-Coins via Reels',
    'Tech enthusiast & explorer',
  ] as string[],
  link: 'bromo.me/siddharth_pro',
  posts: 124,
  fans: '42.5K',
  following: 840,
  verified: true,
  karma: '8.2',
  streak: 12,
  rank: 452,
  coins: 450,
};

const POST_GRID = [
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=300',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300',
  'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=300',
  'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=300',
  'https://images.unsplash.com/photo-1514525253361-bee8718a7439?w=300',
  'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=300',
  'https://images.unsplash.com/photo-1555133539-4a34610018f1?w=300',
  'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=300',
];

const AFFILIATE_PRODUCTS = [
  {
    id: '1',
    name: 'Nike Air Max Elite',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
    originalPrice: '₹2,499',
    profit: '+₹250',
    adCost: '50 H-Coins',
  },
  {
    id: '2',
    name: 'Smart Watch X',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
    originalPrice: '₹4,999',
    profit: '+₹800',
    adCost: '120 H-Coins',
  },
];

const GRID_TABS = [
  {id: 'posts', icon: Grid3X3},
  {id: 'reels', icon: Clapperboard},
  {id: 'saved', icon: Bookmark},
];

export function ProfileScreen() {
  const navigation = useNavigation();
  const {palette, contract, isDark} = useTheme();
  const [gridTab, setGridTab] = useState('posts');
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 14 : 10;

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={20} color={palette.mutedForeground} />
          </Pressable>
          <ThemedText variant="primary" style={{fontSize: 14, fontStyle: 'italic', fontWeight: '900'}}>
            @{PROFILE.handle}
          </ThemedText>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: `${palette.primary}15`,
              borderWidth: 1,
              borderColor: `${palette.primary}30`,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}>
            <Coins size={12} color="#FFD700" />
            <ThemedText variant="primary" style={{fontSize: 11, fontWeight: '900'}}>
              {PROFILE.coins} H-Coins
            </ThemedText>
          </View>
          <Pressable onPress={() => parentNavigate(navigation, 'SettingsMain')}>
            <AlignJustify size={20} color={palette.foreground} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={{padding: 16}}>
          {/* Avatar + Stats */}
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 24}}>
            {/* Avatar with gradient ring */}
            <View
              style={{
                padding: 3,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: palette.primary,
                shadowColor: palette.primary,
                shadowOffset: {width: 0, height: 0},
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
              }}>
              <Image
                source={{uri: PROFILE.avatar}}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: palette.background,
                }}
              />
            </View>

            {/* Stats */}
            <View style={{flex: 1, flexDirection: 'row', justifyContent: 'space-around'}}>
              {[
                {label: 'Posts', value: PROFILE.posts, onPress: () => parentNavigate(navigation, 'ManageContent')},
                {
                  label: 'Fans',
                  value: PROFILE.fans,
                  onPress: () =>
                    parentNavigate(navigation, 'FollowersFollowing', {
                      userId: PROFILE.handle,
                      tab: 'followers',
                    }),
                },
                {
                  label: 'Vibing',
                  value: PROFILE.following,
                  onPress: () =>
                    parentNavigate(navigation, 'FollowersFollowing', {
                      userId: PROFILE.handle,
                      tab: 'following',
                    }),
                },
              ].map(stat => (
                <Pressable key={stat.label} onPress={stat.onPress} style={{alignItems: 'center'}}>
                  <ThemedText variant="heading" style={{fontSize: 18, lineHeight: 22}}>
                    {stat.value}
                  </ThemedText>
                  <ThemedText variant="caption" style={{fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 2}}>
                    {stat.label.toUpperCase()}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Name + Bio */}
          <View style={{marginTop: 14}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <ThemedText variant="heading" style={{fontSize: 15}}>{PROFILE.name}</ThemedText>
              {PROFILE.verified && (
                <BadgeCheck size={16} color="#3b82f6" fill="#3b82f6" strokeWidth={2} />
              )}
              <View
                style={{
                  backgroundColor: '#8b5cf620',
                  borderWidth: 1,
                  borderColor: '#8b5cf640',
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}>
                <Text style={{color: '#8b5cf6', fontSize: 9, fontWeight: '900'}}>KARMA {PROFILE.karma}</Text>
              </View>
            </View>
            <View style={{marginTop: 10, gap: 8}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Flag size={14} color={palette.mutedForeground} />
                <ThemedText variant="body" style={{flex: 1, lineHeight: 19}}>
                  {PROFILE.bioLines[0]}
                </ThemedText>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Coins size={14} color="#FFD700" />
                <ThemedText variant="body" style={{flex: 1, lineHeight: 19}}>
                  {PROFILE.bioLines[1]}
                </ThemedText>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Camera size={14} color={palette.mutedForeground} />
                <ThemedText variant="body" style={{flex: 1, lineHeight: 19}}>
                  {PROFILE.bioLines[2]}
                </ThemedText>
              </View>
            </View>
            <ThemedText variant="primary" style={{marginTop: 4, fontSize: 12, fontStyle: 'italic'}}>
              {PROFILE.link}
            </ThemedText>
          </View>

          {/* Stat Pills */}
          <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
            <Card style={{flex: 1, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
              <View>
                <ThemedText variant="caption" style={{fontSize: 8, fontWeight: '900', letterSpacing: 0.5}}>DAILY STREAK</ThemedText>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2}}>
                  <Flame size={14} color="#f59e0b" />
                  <Text style={{color: '#f59e0b', fontSize: 12, fontWeight: '900'}}>
                    {PROFILE.streak} Days
                  </Text>
                </View>
              </View>
              <Zap size={14} color="#f59e0b" />
            </Card>
            <Card style={{flex: 1, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
              <View>
                <ThemedText variant="caption" style={{fontSize: 8, fontWeight: '900', letterSpacing: 0.5}}>GLOBAL RANK</ThemedText>
                <Text style={{color: '#3b82f6', fontSize: 12, fontWeight: '900', marginTop: 2}}>
                  #{PROFILE.rank}
                </Text>
              </View>
              <Trophy size={14} color="#FFD700" />
            </Card>
          </View>

          {/* Action Buttons */}
          <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
            <PrimaryButton
              label="Edit Profile"
              variant="solid"
              fullWidth
              style={{flex: 1, borderRadius: radius}}
              onPress={() => parentNavigate(navigation, 'EditProfile')}
            />
            <PrimaryButton
              label="H-Coin Wallet"
              variant="outline"
              fullWidth
              style={{flex: 1, borderRadius: radius}}
              onPress={() => parentNavigate(navigation, 'PointsWallet')}
            />
          </View>
        </View>

        {/* Affiliate Hub */}
        <View style={{paddingHorizontal: 14, paddingBottom: 16}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <ThemedText variant="primary" style={{fontSize: 10, fontWeight: '900', letterSpacing: 2, fontStyle: 'italic'}}>
              AFFILIATE HUB (PRIVATE)
            </ThemedText>
            <Pressable
              onPress={() => parentNavigate(navigation, 'MyAdsDashboard')}
              style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <TrendingUp size={10} color={palette.mutedForeground} />
              <ThemedText variant="muted" style={{fontSize: 9, fontWeight: '700', textDecorationLine: 'underline'}}>
                Ad Analytics
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: 12}}>
            {AFFILIATE_PRODUCTS.map(product => (
              <Card
                key={product.id}
                style={{
                  width: 280,
                  padding: 14,
                }}>
                <View style={{flexDirection: 'row', gap: 12}}>
                  <Image
                    source={{uri: product.image}}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: borderRadiusScale === 'bold' ? 16 : 10,
                      resizeMode: 'cover',
                    }}
                  />
                  <View style={{flex: 1}}>
                    <ThemedText variant="label" style={{fontSize: 12}}>{product.name}</ThemedText>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
                      <ThemedText variant="muted" style={{textDecorationLine: 'line-through', fontSize: 10}}>
                        {product.originalPrice}
                      </ThemedText>
                      <Badge label={`Profit ${product.profit}`} variant="green" />
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10}}>
                      <Pressable
                        onPress={() => parentNavigate(navigation, 'CreateAdStep1')}
                        style={{
                          backgroundColor: '#3b82f6',
                          borderRadius: borderRadiusScale === 'bold' ? 10 : 6,
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          shadowColor: '#3b82f6',
                          shadowOffset: {width: 0, height: 3},
                          shadowOpacity: 0.3,
                          shadowRadius: 6,
                          elevation: 4,
                        }}>
                        <Text style={{color: '#fff', fontSize: 10, fontWeight: '800'}}>RUN ADS</Text>
                      </Pressable>
                      <View style={{alignItems: 'flex-end'}}>
                        <ThemedText variant="caption" style={{fontSize: 8, fontWeight: '900'}}>COST</ThemedText>
                        <ThemedText variant="primary" style={{fontSize: 10, fontWeight: '900'}}>{product.adCost}</ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Grid Tab Bar */}
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: palette.border,
          }}>
          {GRID_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = gridTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setGridTab(tab.id)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderBottomWidth: isActive ? 2 : 0,
                  borderBottomColor: palette.primary,
                }}>
                <Icon size={20} color={isActive ? palette.primary : palette.mutedForeground} />
              </Pressable>
            );
          })}
        </View>

        {/* Post Grid */}
        <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
          {POST_GRID.map((uri, index) => (
            <Pressable
              key={index}
              onPress={() => {
                if (gridTab === 'saved') {
                  parentNavigate(navigation, 'SavedPosts');
                  return;
                }
                parentNavigate(navigation, 'PostDetail', {postId: String(index + 1)});
              }}
              style={{
                width: '33.33%',
                aspectRatio: 1,
                padding: 1,
              }}>
              <Image
                source={{uri}}
                style={{width: '100%', height: '100%', resizeMode: 'cover'}}
              />
              {gridTab === 'reels' && (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                  }}>
                  <Play size={14} color="#fff" fill="#fff" />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <View style={{height: 20}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}
