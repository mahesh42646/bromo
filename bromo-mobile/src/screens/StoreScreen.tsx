import React, {useState} from 'react';
import type {ComponentType} from 'react';
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
import {
  Bell,
  SlidersHorizontal,
  MapPin,
  Star,
  ChevronRight,
  Zap,
  ShoppingCart,
  Tag,
  Store,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedText} from '../components/ui/ThemedText';
import {SearchBar} from '../components/ui/SearchBar';
import {Card} from '../components/ui/Card';
import {Badge} from '../components/ui/Badge';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';

type PillIcon = ComponentType<{size?: number; color?: string}>;

const FILTER_PILLS: {id: string; label: string; Icon?: PillIcon}[] = [
  {id: 'all', label: 'All Stores'},
  {id: 'trending', label: 'Trending', Icon: Zap},
  {id: 'premium', label: 'Premium Only'},
  {id: 'offers', label: 'Offers'},
  {id: 'nearby', label: 'Near Me', Icon: MapPin},
];

const FEATURED = [
  {
    id: '1',
    name: 'Nike Elite Store',
    image: 'https://images.unsplash.com/photo-1555133539-4a34610018f1?w=500',
    offer: 'Claim 40% Off Today',
    badge: 'Exclusive',
  },
  {
    id: '2',
    name: 'Coffee Republic',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500',
    offer: 'Buy 1 Get 1 Free',
    badge: 'Hot Deal',
  },
  {
    id: '3',
    name: 'Royal Electronics',
    image: 'https://images.unsplash.com/photo-1604719312563-8912e9223c6a?w=500',
    offer: 'Extra 10% via BROMO Pay',
    badge: 'Partner',
  },
];

const STORES = [
  {
    id: '1',
    name: 'Nike Elite Store',
    category: 'Fashion',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
    rating: 4.8,
    reviews: 1240,
    distance: '0.8 km',
    offer: '40% Off',
    tier: 'premium',
    tags: ['Shoes', 'Sports', 'Apparel'],
  },
  {
    id: '2',
    name: 'Royal Electronics',
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200',
    rating: 4.6,
    reviews: 890,
    distance: '1.2 km',
    offer: '10% BROMO Pay',
    tier: 'glow',
    tags: ['Phones', 'Laptops', 'Gadgets'],
  },
  {
    id: '3',
    name: 'Spice Garden Restaurant',
    category: 'Food & Dining',
    image: 'https://images.unsplash.com/photo-1555133539-4a34610018f1?w=200',
    rating: 4.9,
    reviews: 2100,
    distance: '0.3 km',
    offer: 'Free Delivery',
    tier: 'basic',
    tags: ['Indian', 'Thali', 'Biryani'],
  },
  {
    id: '4',
    name: 'FitLife Gym',
    category: 'Health & Fitness',
    image: 'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=200',
    rating: 4.7,
    reviews: 560,
    distance: '2.1 km',
    offer: '1st Month Free',
    tier: 'glow',
    tags: ['Gym', 'Yoga', 'CrossFit'],
  },
];

const TIER_COLORS: Record<string, {bg: string; text: string; label: string}> = {
  premium: {bg: 'linear-gradient(45deg, #ffd700, #ff8c00)', text: '#000', label: 'PREMIUM'},
  glow: {bg: '#3a7bd5', text: '#fff', label: 'GLOW'},
  basic: {bg: '#222', text: '#888', label: 'BASIC'},
};

function StoreCard({
  store,
  index,
  onPress,
}: {
  store: (typeof STORES)[0];
  index: number;
  onPress: () => void;
}) {
  const {palette, contract} = useTheme();
  const {borderRadiusScale} = contract.brandGuidelines;
  const radius = borderRadiusScale === 'bold' ? 24 : 16;
  const isEven = index % 2 === 0;
  const tier = TIER_COLORS[store.tier] || TIER_COLORS.basic;

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => ({
        flexDirection: isEven ? 'row' : 'row-reverse',
        gap: 16,
        alignItems: 'center',
        backgroundColor: '#080808',
        borderWidth: 1,
        borderColor: `rgba(255,255,255,0.05)`,
        padding: 14,
        borderRadius: radius,
        marginBottom: 20,
        opacity: pressed ? 0.85 : 1,
        position: 'relative',
      })}>
      {/* Tier badge */}
      <View
        style={{
          position: 'absolute',
          top: -8,
          left: isEven ? 14 : undefined,
          right: isEven ? undefined : 14,
          backgroundColor: store.tier === 'premium' ? '#ffd700' : store.tier === 'glow' ? '#3a7bd5' : '#222',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}>
        <Text style={{
          color: store.tier === 'premium' ? '#000' : store.tier === 'glow' ? '#fff' : '#888',
          fontSize: 8,
          fontWeight: '900',
          letterSpacing: 1,
        }}>
          {tier.label}
        </Text>
      </View>

      {/* Image */}
      <View
        style={{
          width: 90,
          height: 90,
          borderRadius: borderRadiusScale === 'bold' ? 20 : 12,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
        <Image source={{uri: store.image}} style={{width: '100%', height: '100%', resizeMode: 'cover'}} />
      </View>

      {/* Info */}
      <View style={{flex: 1, alignItems: isEven ? 'flex-start' : 'flex-end'}}>
        <ThemedText variant="label" style={{fontSize: 13}}>{store.name}</ThemedText>
        <ThemedText variant="caption" style={{marginTop: 2}}>{store.category}</ThemedText>

        {/* Rating */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4}}>
          <Star size={11} color="#FFD700" fill="#FFD700" />
          <Text style={{color: '#FFD700', fontSize: 11, fontWeight: '700'}}>{store.rating}</Text>
          <ThemedText variant="caption">({store.reviews})</ThemedText>
        </View>

        {/* Distance + Offer */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
            <MapPin size={10} color={palette.mutedForeground} />
            <ThemedText variant="caption">{store.distance}</ThemedText>
          </View>
          <Badge label={store.offer} variant="green" />
        </View>

        {/* Tags */}
        <View style={{flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap'}}>
          {store.tags.slice(0, 2).map(tag => (
            <View
              key={tag}
              style={{
                backgroundColor: `${palette.primary}15`,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}>
              <Text style={{color: palette.primary, fontSize: 9, fontWeight: '700'}}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export function StoreScreen() {
  const navigation = useNavigation();
  const {palette, contract, isDark} = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipRadius = borderRadiusScale === 'bold' ? 14 : 10;

  return (
    <ThemedSafeScreen edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Sticky Header */}
      <View
        style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          padding: 14,
          gap: 12,
        }}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
            <ThemedText variant="heading" style={{fontSize: 22, fontStyle: 'italic', letterSpacing: -1}}>
              Local
            </ThemedText>
            <ThemedText variant="heading" style={{fontSize: 22, fontStyle: 'italic', letterSpacing: -1, color: palette.primary}}>
              Pulse
            </ThemedText>
          </View>
          <Pressable
            onPress={() => parentNavigate(navigation, 'NotificationHistory3km')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: `${palette.primary}15`,
              borderWidth: 1,
              borderColor: `${palette.primary}30`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Bell size={16} color={palette.primary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search brands, vibes or codes..."
            style={{flex: 1}}
          />
          <Pressable
            style={{
              width: 42,
              height: 42,
              borderRadius: chipRadius,
              backgroundColor: palette.input,
              borderWidth: 1,
              borderColor: palette.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <SlidersHorizontal size={16} color={palette.primary} />
          </Pressable>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap: 8}}>
          {FILTER_PILLS.map(pill => {
            const on = activeFilter === pill.id;
            const fg = on ? palette.primaryForeground : palette.foreground;
            const PillIcon = pill.Icon;
            return (
              <Pressable
                key={pill.id}
                onPress={() => setActiveFilter(pill.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: chipRadius,
                  backgroundColor: on ? palette.primary : isDark ? '#111' : '#f4f4f5',
                  borderWidth: 1,
                  borderColor: on ? palette.primary : palette.border,
                }}>
                {PillIcon ? <PillIcon size={14} color={fg} /> : null}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: fg,
                  }}>
                  {pill.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: tabBarHeight + 16}}>
        {/* Featured Drops */}
        <View style={{padding: 14}}>
          <ThemedText variant="caption" style={{fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 12}}>
            FEATURED DROPS
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: 12}}>
            {FEATURED.map(item => (
              <Pressable
                key={item.id}
                onPress={() => parentNavigate(navigation, 'StoreProfile', {storeId: item.id})}
                style={{
                  width: 280,
                  height: 140,
                  borderRadius: borderRadiusScale === 'bold' ? 22 : 14,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: palette.border,
                  position: 'relative',
                }}>
                <Image source={{uri: item.image}} style={{width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.6}} />
                <View style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)'}} />
                <View style={{position: 'absolute', bottom: 14, left: 14}}>
                  <View
                    style={{
                      backgroundColor: palette.primary,
                      borderRadius: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      marginBottom: 4,
                      alignSelf: 'flex-start',
                    }}>
                    <Text style={{color: palette.primaryForeground, fontSize: 8, fontWeight: '900'}}>{item.badge.toUpperCase()}</Text>
                  </View>
                  <Text style={{color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 20}}>{item.name}</Text>
                  <Text style={{color: palette.primary, fontSize: 10, fontWeight: '700', marginTop: 2}}>{item.offer}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Store List */}
        <View style={{paddingHorizontal: 14}}>
          <Pressable
            onPress={() => parentNavigate(navigation, 'StoreNearbyHome')}
            style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14}}>
            <ThemedText variant="heading" style={{fontSize: 14}}>Stores Near You</ThemedText>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <MapPin size={12} color={palette.primary} />
              <ThemedText variant="primary" style={{fontSize: 11}}>Pune, MH · Map</ThemedText>
            </View>
          </Pressable>

          {STORES.map((store, index) => (
            <StoreCard
              key={store.id}
              store={store}
              index={index}
              onPress={() => parentNavigate(navigation, 'StoreProfile', {storeId: store.id})}
            />
          ))}
        </View>

        {/* Quick Categories */}
        <View style={{padding: 14}}>
          <ThemedText variant="heading" style={{fontSize: 14, marginBottom: 12}}>Browse by Category</ThemedText>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
            {[
              {label: 'Fashion', icon: Tag, color: '#ec4899'},
              {label: 'Food', icon: Store, color: '#f59e0b'},
              {label: 'Electronics', icon: Zap, color: '#3b82f6'},
              {label: 'Grocery', icon: ShoppingCart, color: '#10b981'},
            ].map(cat => {
              const Icon = cat.icon;
              return (
                <Pressable
                  key={cat.label}
                  onPress={() => parentNavigate(navigation, 'StoreMenu', {storeId: 'demo'})}
                  style={{
                    flex: 1,
                    minWidth: '45%',
                    backgroundColor: `${cat.color}15`,
                    borderWidth: 1,
                    borderColor: `${cat.color}30`,
                    borderRadius: borderRadiusScale === 'bold' ? 16 : 10,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                  <Icon size={18} color={cat.color} />
                  <ThemedText variant="label" style={{fontSize: 13}}>{cat.label}</ThemedText>
                  <ChevronRight size={14} color={palette.mutedForeground} style={{marginLeft: 'auto'}} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{height: 20}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}
