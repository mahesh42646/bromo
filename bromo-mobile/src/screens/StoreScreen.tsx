import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {
  Bell,
  MapPin,
  Star,
  ChevronRight,
  Truck,
  Package,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedText} from '../components/ui/ThemedText';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {listStores, getFeaturedStores, STORE_CATEGORIES, type Store as BromoStore} from '../api/storeApi';
import Geolocation from '@react-native-community/geolocation';

function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function StoreScreen() {
  const navigation = useNavigation();
  const {palette, isDark} = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [featured, setFeatured] = useState<BromoStore[]>([]);
  const [stores, setStores] = useState<BromoStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Get user location once
  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {/* location denied */},
      {enableHighAccuracy: false, timeout: 10000},
    );
  }, []);

  const loadFeatured = useCallback(async () => {
    try {
      const f = await getFeaturedStores();
      setFeatured(f);
    } catch {/* ignore */}
  }, []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const {stores: result} = await listStores({
        q: query.trim() || undefined,
        delivery: deliveryOnly || undefined,
        category: activeCategory || undefined,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
        maxDistance: userLat != null ? 20000 : undefined,
      });
      setStores(result);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [query, deliveryOnly, activeCategory, userLat, userLng]);

  useFocusEffect(useCallback(() => {
    void loadFeatured();
  }, [loadFeatured]));

  useEffect(() => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void loadStores(), 350);
    return () => { if (debounceRef.current != null) clearTimeout(debounceRef.current); };
  }, [loadStores]);

  const FILTER_PILLS: {id: string; label: string}[] = [
    {id: '', label: 'All'},
    {id: 'Food & Beverages', label: 'Food'},
    {id: 'Fashion & Clothing', label: 'Fashion'},
    {id: 'Electronics & Tech', label: 'Electronics'},
    {id: 'Health & Beauty', label: 'Beauty'},
    {id: 'Grocery', label: 'Grocery'},
  ];

  return (
    <ThemedSafeScreen edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Sticky Header */}
      <View style={[s.header, {backgroundColor: palette.background, borderBottomColor: palette.border}]}>
        <View style={[s.headerTop]}>
          <View style={{flex: 1}}>
            <ThemedText variant="heading" style={{fontSize: 22, fontWeight: '900', letterSpacing: -0.5}}>
              Local<Text style={{color: palette.primary}}> Stores</Text>
            </ThemedText>
          </View>
          <Pressable
            onPress={() => parentNavigate(navigation, 'AllStores')}
            style={[s.allStoresBtn, {backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}30`}]}>
            <Store size={14} color={palette.primary} />
            <Text style={{color: palette.primary, fontSize: 12, fontWeight: '700'}}>All Stores</Text>
          </Pressable>
          <Pressable
            onPress={() => parentNavigate(navigation, 'NotificationHistory3km')}
            style={[s.iconBtn, {backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}30`}]}>
            <Bell size={16} color={palette.primary} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[s.searchRow, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
          <Search size={15} color={palette.placeholder} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search stores, products..."
            placeholderTextColor={palette.placeholder}
            style={[s.searchInput, {color: palette.foreground}]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={14} color={palette.foregroundSubtle} />
            </Pressable>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {FILTER_PILLS.map(pill => {
            const on = activeCategory === pill.id;
            return (
              <Pressable
                key={pill.id}
                onPress={() => setActiveCategory(pill.id)}
                style={[s.pill, {
                  backgroundColor: on ? palette.primary : isDark ? palette.surface : palette.card,
                  borderColor: on ? palette.primary : palette.border,
                }]}>
                <Text style={{fontSize: 12, fontWeight: '700', color: on ? palette.primaryForeground : palette.foreground}}>
                  {pill.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setDeliveryOnly(v => !v)}
            style={[s.pill, {
              backgroundColor: deliveryOnly ? palette.success : isDark ? palette.surface : palette.card,
              borderColor: deliveryOnly ? palette.success : palette.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }]}>
            <Truck size={12} color={deliveryOnly ? '#fff' : palette.foregroundSubtle} />
            <Text style={{fontSize: 12, fontWeight: '700', color: deliveryOnly ? '#fff' : palette.foreground}}>
              Delivery
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: tabBarHeight + 16}}>

        {/* Featured carousel */}
        {featured.length > 0 && (
          <View style={{paddingTop: 14}}>
            <View style={s.sectionHeader}>
              <ThemedText variant="heading" style={{fontSize: 13, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase'}}>
                Featured Stores
              </ThemedText>
              <Pressable onPress={() => parentNavigate(navigation, 'AllStores')} hitSlop={8}>
                <Text style={{color: palette.primary, fontSize: 12, fontWeight: '700'}}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 14, gap: 12, paddingBottom: 4}}>
              {featured.map(store => (
                <Pressable
                  key={store._id}
                  onPress={() => parentNavigate(navigation, 'StorePublicProfile', {storeId: store._id})}
                  style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}>
                  <View style={[s.featuredCard, {borderColor: palette.border}]}>
                    {store.bannerImage ? (
                      <Image source={{uri: store.bannerImage}} style={s.featuredImg} resizeMode="cover" />
                    ) : (
                      <View style={[s.featuredImg, {backgroundColor: `${palette.primary}20`, alignItems: 'center', justifyContent: 'center'}]}>
                        <Text style={{color: palette.primary, fontSize: 32, fontWeight: '800'}}>{store.name[0]}</Text>
                      </View>
                    )}
                    <View style={[s.featuredOverlay, {backgroundColor: 'rgba(0,0,0,0.45)'}]} />
                    {store.hasDelivery && (
                      <View style={[s.deliveryBadge, {backgroundColor: palette.success}]}>
                        <Truck size={9} color="#fff" />
                        <Text style={{color: '#fff', fontSize: 8, fontWeight: '800'}}>DELIVERY</Text>
                      </View>
                    )}
                    <View style={s.featuredInfo}>
                      <Text style={{color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 18}} numberOfLines={1}>{store.name}</Text>
                      <Text style={{color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', marginTop: 2}}>{store.category}</Text>
                      {store.ratingAvg > 0 && (
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3}}>
                          <Star size={10} color="#FFD700" fill="#FFD700" />
                          <Text style={{color: '#FFD700', fontSize: 10, fontWeight: '700'}}>{store.ratingAvg.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Stores list */}
        <View style={s.storeListSection}>
          <View style={s.sectionHeader}>
            <ThemedText variant="heading" style={{fontSize: 13, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase'}}>
              {userLat != null ? 'Stores Near You' : 'All Stores'}
            </ThemedText>
            {userLat != null && (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <MapPin size={11} color={palette.primary} />
                <Text style={{color: palette.primary, fontSize: 11, fontWeight: '700'}}>Nearby</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={palette.primary} style={{marginTop: 24}} />
          ) : stores.length === 0 ? (
            <View style={s.emptyState}>
              <Package size={40} color={palette.foregroundSubtle} />
              <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '600', marginTop: 10}}>No stores found</Text>
              <Text style={{color: palette.foregroundSubtle, fontSize: 12, marginTop: 4}}>Try adjusting your filters</Text>
            </View>
          ) : (
            stores.map((store, i) => (
              <StoreListItem
                key={store._id}
                store={store}
                palette={palette}
                index={i}
                onPress={() => parentNavigate(navigation, 'StorePublicProfile', {storeId: store._id})}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ThemedSafeScreen>
  );
}

function StoreListItem({
  store,
  palette,
  index,
  onPress,
}: {
  store: BromoStore;
  palette: ReturnType<typeof useTheme>['palette'];
  index: number;
  onPress: () => void;
}) {
  const isEven = index % 2 === 0;
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        s.storeCard,
        {
          flexDirection: isEven ? 'row' : 'row-reverse',
          backgroundColor: palette.card,
          borderColor: palette.glassFaint,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[s.storeCardImg, {backgroundColor: palette.glassMid}]}>
        {store.profilePhoto ? (
          <Image source={{uri: store.profilePhoto}} style={{width: '100%', height: '100%'}} resizeMode="cover" />
        ) : (
          <Text style={{color: palette.primary, fontSize: 22, fontWeight: '800'}}>{store.name[0]}</Text>
        )}
      </View>
      <View style={{flex: 1, alignItems: isEven ? 'flex-start' : 'flex-end'}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
          <Text style={{color: palette.foreground, fontSize: 14, fontWeight: '700'}} numberOfLines={1}>{store.name}</Text>
          {store.hasDelivery && (
            <View style={[s.deliveryTag, {backgroundColor: `${palette.success}20`}]}>
              <Truck size={9} color={palette.success} />
              <Text style={{color: palette.success, fontSize: 8, fontWeight: '800'}}>DEL</Text>
            </View>
          )}
        </View>
        <Text style={{color: palette.primary, fontSize: 11, fontWeight: '700', marginTop: 2}}>{store.category}</Text>
        <View style={{flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap'}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
            <MapPin size={10} color={palette.foregroundSubtle} />
            <Text style={{color: palette.foregroundSubtle, fontSize: 11}}>{store.city}</Text>
          </View>
          {store.distance != null && (
            <Text style={{color: palette.primary, fontSize: 11, fontWeight: '700'}}>{fmtDistance(store.distance)}</Text>
          )}
          {store.ratingAvg > 0 && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
              <Star size={10} color={palette.warning} fill={palette.warning} />
              <Text style={{color: palette.warning, fontSize: 11, fontWeight: '700'}}>{store.ratingAvg.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4}}>
          <Package size={10} color={palette.foregroundSubtle} />
          <Text style={{color: palette.foregroundSubtle, fontSize: 11}}>{store.totalProducts} products</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    padding: 14,
    gap: 10,
  },
  headerTop: {flexDirection: 'row', alignItems: 'center', gap: 8},
  allStoresBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 0},
  pillRow: {gap: 8},
  pill: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  featuredCard: {
    width: 220,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  featuredImg: {width: '100%', height: '100%'},
  featuredOverlay: {position: 'absolute', inset: 0},
  deliveryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  featuredInfo: {position: 'absolute', bottom: 12, left: 12},
  storeListSection: {paddingHorizontal: 14, paddingTop: 20},
  emptyState: {alignItems: 'center', paddingVertical: 40},
  storeCard: {
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
  },
  storeCardImg: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deliveryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
});
