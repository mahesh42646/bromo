import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import {
  Search,
  MapPin,
  Truck,
  SlidersHorizontal,
  Star,
  Package,
  X,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {RefreshableScrollView, Screen, SegmentedTabs} from '../../components/ui';
import {listStores, STORE_CATEGORIES, type Store} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type DistanceFilter = 'all' | '1km' | '3km' | '5km' | '10km';
const DIST_OPTIONS: {label: string; value: DistanceFilter; meters: number | null}[] = [
  {label: 'All', value: 'all', meters: null},
  {label: '< 1 km', value: '1km', meters: 1000},
  {label: '< 3 km', value: '3km', meters: 3000},
  {label: '< 5 km', value: '5km', meters: 5000},
  {label: '< 10 km', value: '10km', meters: 10000},
];

function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function AllStoresScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [distFilter, setDistFilter] = useState<DistanceFilter>('all');
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-get location
  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {/* location denied — continue without */},
      {enableHighAccuracy: false, timeout: 10000},
    );
  }, []);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const distOption = DIST_OPTIONS.find(d => d.value === distFilter);
      const {stores: result} = await listStores({
        q: query.trim() || undefined,
        delivery: deliveryOnly || undefined,
        category: activeCategory || undefined,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
        maxDistance: distOption?.meters ?? undefined,
      });
      setStores(result);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [query, distFilter, deliveryOnly, activeCategory, userLat, userLng]);

  useEffect(() => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchStores(), 400);
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [fetchStores]);

  const hasActiveFilter = distFilter !== 'all' || deliveryOnly || !!activeCategory;

  return (
    <Screen title="Stores" scroll={false}>
      <StatusBar barStyle="light-content" />

      <View style={[s.header, {borderBottomColor: palette.glassFaint, backgroundColor: palette.background}]}>
        <View style={[s.searchBox, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
          <Search size={15} color={palette.placeholder} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search stores, products, categories..."
            placeholderTextColor={palette.placeholder}
            style={[s.searchInput, {color: palette.foreground}]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={14} color={palette.foregroundSubtle} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setShowFilters(v => !v)}
          style={[s.filterBtn, {
            backgroundColor: hasActiveFilter ? `${palette.primary}20` : palette.glassFaint,
            borderColor: hasActiveFilter ? palette.primary : palette.border,
          }]}>
          <SlidersHorizontal size={16} color={hasActiveFilter ? palette.primary : palette.foreground} />
          {hasActiveFilter && <View style={[s.filterDot, {backgroundColor: palette.primary}]} />}
        </Pressable>
      </View>

      {/* Filter panels */}
      {showFilters && (
        <View style={[s.filterPanel, {backgroundColor: palette.surface, borderBottomColor: palette.glassFaint}]}>
          {/* Distance */}
          <Text style={[s.filterGroupLabel, {color: palette.foregroundSubtle}]}>Distance</Text>
          <SegmentedTabs
            items={DIST_OPTIONS.map(opt => ({label: opt.label, value: opt.value}))}
            value={distFilter}
            onChange={setDistFilter}
            variant="pill"
          />

          {/* Delivery toggle */}
          <Pressable
            onPress={() => setDeliveryOnly(v => !v)}
            style={[s.deliveryToggle, {
              backgroundColor: deliveryOnly ? `${palette.success}15` : palette.glassFaint,
              borderColor: deliveryOnly ? palette.success : palette.border,
            }]}>
            <Truck size={15} color={deliveryOnly ? palette.success : palette.foregroundSubtle} />
            <Text style={{color: deliveryOnly ? palette.success : palette.foreground, fontSize: 13, fontWeight: '700', flex: 1}}>
              Courier Delivery Available
            </Text>
            <View style={[s.checkBox, {
              backgroundColor: deliveryOnly ? palette.success : 'transparent',
              borderColor: deliveryOnly ? palette.success : palette.border,
            }]}>
              {deliveryOnly && <X size={10} color="#fff" />}
            </View>
          </Pressable>

          {/* Category */}
          <Text style={[s.filterGroupLabel, {color: palette.foregroundSubtle, marginTop: 10}]}>Category</Text>
          <SegmentedTabs
            items={[{label: 'All', value: ''}, ...STORE_CATEGORIES.map(cat => ({label: cat, value: cat}))]}
            value={activeCategory}
            onChange={setActiveCategory}
            variant="pill"
          />
        </View>
      )}

      {/* Results info bar */}
      <View style={[s.resultsBar, {borderBottomColor: palette.glassFaint}]}>
        {userLat != null ? (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <MapPin size={12} color={palette.primary} />
            <Text style={{color: palette.primary, fontSize: 12, fontWeight: '700'}}>Near me</Text>
          </View>
        ) : (
          <Text style={{color: palette.foregroundSubtle, fontSize: 12}}>All stores</Text>
        )}
        <Text style={{color: palette.foregroundSubtle, fontSize: 12}}>
          {loading ? '…' : `${stores.length} stores`}
        </Text>
      </View>

      <RefreshableScrollView
        onRefresh={fetchStores}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}>
        {loading ? (
          <ActivityIndicator color={palette.primary} style={{marginTop: 40}} />
        ) : stores.length === 0 ? (
          <View style={s.emptyState}>
            <Package size={48} color={palette.foregroundSubtle} />
            <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '700', marginTop: 12}}>No stores found</Text>
            <Text style={{color: palette.foregroundSubtle, fontSize: 13, marginTop: 4}}>Try adjusting your filters</Text>
          </View>
        ) : (
          stores.map(store => (
            <StoreListCard
              key={store._id}
              store={store}
              palette={palette}
              onPress={() => navigation.navigate('StorePublicProfile', {storeId: store._id})}
            />
          ))
        )}
        <View style={{height: 32}} />
      </RefreshableScrollView>
    </Screen>
  );
}

function StoreListCard({
  store,
  palette,
  onPress,
}: {
  store: Store;
  palette: ReturnType<typeof useTheme>['palette'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        s.storeCard,
        {backgroundColor: palette.glassFaint, borderColor: palette.border, opacity: pressed ? 0.85 : 1},
      ]}>
      {/* Photo */}
      <View style={[s.cardThumb, {backgroundColor: palette.glassMid}]}>
        {store.profilePhoto ? (
          <Image source={{uri: store.profilePhoto}} style={s.cardThumbImg} resizeMode="cover" />
        ) : (
          <Text style={{color: palette.primary, fontSize: 22, fontWeight: '800'}}>{store.name[0]}</Text>
        )}
      </View>

      {/* Info */}
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
          <Text style={[s.cardName, {color: palette.foreground}]} numberOfLines={1}>{store.name}</Text>
          {store.hasDelivery && (
            <View style={[s.deliveryTag, {backgroundColor: `${palette.success}20`}]}>
              <Truck size={9} color={palette.success} />
              <Text style={{color: palette.success, fontSize: 8, fontWeight: '800'}}>DELIVERY</Text>
            </View>
          )}
        </View>
        <Text style={{color: palette.primary, fontSize: 11, fontWeight: '700', marginTop: 1}}>{store.category}</Text>

        <View style={{flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap'}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
            <MapPin size={11} color={palette.foregroundSubtle} />
            <Text style={{color: palette.foregroundSubtle, fontSize: 11}}>{store.city}</Text>
          </View>
          {store.distance != null && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
              <Text style={{color: palette.primary, fontSize: 11, fontWeight: '700'}}>{fmtDistance(store.distance)}</Text>
            </View>
          )}
          {store.ratingAvg > 0 && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
              <Star size={10} color={palette.warning} fill={palette.warning} />
              <Text style={{color: palette.warning, fontSize: 11, fontWeight: '700'}}>{store.ratingAvg.toFixed(1)}</Text>
            </View>
          )}
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
            <Package size={10} color={palette.foregroundSubtle} />
            <Text style={{color: palette.foregroundSubtle, fontSize: 11}}>{store.totalProducts} products</Text>
          </View>
        </View>

        {store.description ? (
          <Text style={{color: palette.foregroundSubtle, fontSize: 12, marginTop: 4, lineHeight: 16}} numberOfLines={1}>
            {store.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 0},
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterGroupLabel: {fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8},
  pillRow: {gap: 8, paddingBottom: 4},
  pill: {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1},
  deliveryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listContent: {paddingHorizontal: 16, paddingTop: 8},
  emptyState: {alignItems: 'center', paddingVertical: 60},
  storeCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardThumbImg: {width: '100%', height: '100%'},
  cardName: {fontSize: 15, fontWeight: '700'},
  deliveryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
});
