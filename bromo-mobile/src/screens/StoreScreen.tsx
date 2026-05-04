import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, UrlTile, type LatLng } from 'react-native-maps';
import {
  BadgeCheck,
  Bell,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Truck,
  X,
} from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { StoreDiscoverCard } from '../components/store/StoreDiscoverCard';
import { useTheme } from '../context/ThemeContext';
import { RefreshableScrollView, Screen } from '../components/ui';
import { parentNavigate } from '../navigation/parentNavigate';
import {
  createStoreSubscriptionCheckout,
  favoriteStore,
  getMyStore,
  getStorePlans,
  listStores,
  unfavoriteStore,
  verifyStoreSubscriptionPayment,
  type Store as BromoStore,
  STORE_CATEGORIES,
  type StorePlan,
  type StorePlanId,
} from '../api/storeApi';
import { openExternalUrl } from '../lib/openExternalUrl';

type DistanceFilter = 'all' | '1km' | '3km' | '5km' | '10km';

const DISTANCE_OPTIONS: Array<{ id: DistanceFilter; label: string; meters: number | null }> = [
  { id: 'all', label: 'All', meters: null },
  { id: '1km', label: '1 km', meters: 1000 },
  { id: '3km', label: '3 km', meters: 3000 },
  { id: '5km', label: '5 km', meters: 5000 },
  { id: '10km', label: '10 km', meters: 10000 },
];

const SORT_OPTIONS: Array<{ id: 'nearest' | 'popular' | 'rating' | 'newest'; label: string }> = [
  { id: 'nearest', label: 'Nearest' },
  { id: 'popular', label: 'Popular' },
  { id: 'rating', label: 'Top Rated' },
  { id: 'newest', label: 'Newest' },
];

const RATING_FILTERS: Array<{ id: number; label: string }> = [
  { id: 0, label: 'Any Rating' },
  { id: 4, label: '4.0+' },
  { id: 4.5, label: '4.5+' },
];

type CheckoutState = {
  orderId: string;
  amountInr: number;
  currency: 'INR';
  merchantName: string;
  plan: StorePlan;
};

const categoryPills = ['', ...STORE_CATEGORIES.slice(0, 7)];

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type StoreMarker = {
  store: BromoStore;
  latitude: number;
  longitude: number;
};

function getStoreMarker(store: BromoStore): StoreMarker | null {
  const [longitude, latitude] = store.location.coordinates ?? [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { store, latitude, longitude };
}

function buildMapRegion(markers: StoreMarker[], userLat?: number | null, userLng?: number | null): Region {
  const points = markers.map(marker => ({
    latitude: marker.latitude,
    longitude: marker.longitude,
  }));
  if (userLat != null && userLng != null) {
    points.push({ latitude: userLat, longitude: userLng });
  }

  if (points.length === 0) {
    return {
      latitude: 20.5937,
      longitude: 78.9629,
      latitudeDelta: 0.18,
      longitudeDelta: 0.18,
    };
  }

  const latitudes = points.map(point => point.latitude);
  const longitudes = points.map(point => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.5, 0.045),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.5, 0.045),
  };
}

export function StoreScreen() {
  const navigation = useNavigation();
  const { palette, isDark, branding } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [stores, setStores] = useState<BromoStore[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [activeCategory, setActiveCategory] = useState('');
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('5km');
  const [sortBy, setSortBy] = useState<'nearest' | 'popular' | 'rating' | 'newest'>('nearest');
  const [minRating, setMinRating] = useState(0);
  const [planFilter, setPlanFilter] = useState<'all' | StorePlanId>('all');
  const [storeTypeFilter, setStoreTypeFilter] = useState<'all' | 'd2c' | 'b2b' | 'online'>('all');

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const [myStore, setMyStore] = useState<BromoStore | null>(null);
  const [myStoreLoading, setMyStoreLoading] = useState(true);

  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [plansHiddenSession, setPlansHiddenSession] = useState(false);

  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [paying, setPaying] = useState(false);
  const [likedStoreIds, setLikedStoreIds] = useState<Record<string, boolean>>({});
  const [fullMapVisible, setFullMapVisible] = useState(false);
  const [mapTileFallback, setMapTileFallback] = useState(false);
  const [miniMapLoaded, setMiniMapLoaded] = useState(false);
  const [fullMapLoaded, setFullMapLoaded] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mapRef = useRef<MapView | null>(null);
  const fullMapRef = useRef<MapView | null>(null);
  const miniMapLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullMapLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appTitle = branding.appTitle || 'BROMO';

  const refreshLocation = useCallback(() => {
    Geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {
        setUserLat(null);
        setUserLng(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 20000 },
    );
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  const loadMyStore = useCallback(async () => {
    setMyStoreLoading(true);
    try {
      const mine = await getMyStore();
      setMyStore(mine);
    } catch {
      setMyStore(null);
    } finally {
      setMyStoreLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const catalog = await getStorePlans();
      setPlans(catalog);
    } catch {
      setPlans([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyStore().catch(() => undefined);
      if (plans.length === 0) loadPlans().catch(() => undefined);
    }, [loadMyStore, loadPlans, plans.length]),
  );

  const distanceMeters = useMemo(() => {
    const hit = DISTANCE_OPTIONS.find(d => d.id === distanceFilter);
    return hit?.meters ?? null;
  }, [distanceFilter]);

  const [listRefreshing, setListRefreshing] = useState(false);

  const loadStores = useCallback(async (mode: 'full' | 'refresh' = 'full') => {
    if (mode === 'full') setLoading(true);
    try {
      const { stores: result } = await listStores({
        q: query.trim() || undefined,
        delivery: deliveryOnly || undefined,
        category: activeCategory || undefined,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
        maxDistance: userLat != null && distanceMeters != null ? distanceMeters : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        sortBy,
        plan: planFilter === 'all' ? undefined : planFilter,
        storeType: storeTypeFilter,
      });
      setStores(result);
    } catch {
      setStores([]);
    } finally {
      if (mode === 'full') setLoading(false);
    }
  }, [
    query,
    deliveryOnly,
    activeCategory,
    userLat,
    userLng,
    distanceMeters,
    minRating,
    sortBy,
    planFilter,
    storeTypeFilter,
  ]);

  useEffect(() => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadStores().catch(() => undefined);
    }, 350);
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [loadStores]);

  useEffect(() => {
    if (query.trim().length > 0) {
      setPlansHiddenSession(true);
    }
  }, [query]);

  useEffect(() => {
    setLikedStoreIds(prev => {
      const next = { ...prev };
      for (const store of stores) {
        if (next[store._id] == null) next[store._id] = Boolean(store.isFavorited);
      }
      return next;
    });
  }, [stores]);

  const locationLabel =
    userLat != null && userLng != null
      ? `${userLat.toFixed(3)}, ${userLng.toFixed(3)}`
      : 'Location unavailable';

  const mapMarkers = useMemo(() => stores.map(getStoreMarker).filter((store): store is StoreMarker => store != null), [stores]);

  const mapRegion = useMemo(() => buildMapRegion(mapMarkers, userLat, userLng), [mapMarkers, userLat, userLng]);

  const mapFitCoordinates = useMemo<LatLng[]>(() => {
    const coordinates = mapMarkers.map(marker => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
    }));
    if (userLat != null && userLng != null) {
      coordinates.push({ latitude: userLat, longitude: userLng });
    }
    return coordinates;
  }, [mapMarkers, userLat, userLng]);

  const fitMapToCoordinates = useCallback((ref: React.RefObject<MapView | null>, animated: boolean) => {
    if (!ref.current || mapFitCoordinates.length === 0) return;
    ref.current.fitToCoordinates(mapFitCoordinates, {
      edgePadding: { top: 56, right: 56, bottom: 56, left: 56 },
      animated,
    });
  }, [mapFitCoordinates]);

  const clearMiniMapLoadTimeout = useCallback(() => {
    if (miniMapLoadTimeoutRef.current) {
      clearTimeout(miniMapLoadTimeoutRef.current);
      miniMapLoadTimeoutRef.current = null;
    }
  }, []);

  const clearFullMapLoadTimeout = useCallback(() => {
    if (fullMapLoadTimeoutRef.current) {
      clearTimeout(fullMapLoadTimeoutRef.current);
      fullMapLoadTimeoutRef.current = null;
    }
  }, []);

  const armMiniMapFallback = useCallback(() => {
    clearMiniMapLoadTimeout();
    miniMapLoadTimeoutRef.current = setTimeout(() => {
      setMapTileFallback(true);
    }, 2200);
  }, [clearMiniMapLoadTimeout]);

  const armFullMapFallback = useCallback(() => {
    clearFullMapLoadTimeout();
    fullMapLoadTimeoutRef.current = setTimeout(() => {
      setMapTileFallback(true);
    }, 2200);
  }, [clearFullMapLoadTimeout]);

  const handleMiniMapReady = useCallback(() => {
    fitMapToCoordinates(mapRef, false);
    if (!miniMapLoaded) armMiniMapFallback();
  }, [armMiniMapFallback, fitMapToCoordinates, miniMapLoaded]);

  const handleMiniMapLoaded = useCallback(() => {
    setMiniMapLoaded(true);
    clearMiniMapLoadTimeout();
  }, [clearMiniMapLoadTimeout]);

  const handleFullMapReady = useCallback(() => {
    fitMapToCoordinates(fullMapRef, false);
    if (!fullMapLoaded) armFullMapFallback();
  }, [armFullMapFallback, fitMapToCoordinates, fullMapLoaded]);

  const handleFullMapLoaded = useCallback(() => {
    setFullMapLoaded(true);
    clearFullMapLoadTimeout();
  }, [clearFullMapLoadTimeout]);

  useEffect(() => {
    if (mapFitCoordinates.length === 0) return;
    const timer = setTimeout(() => {
      fitMapToCoordinates(mapRef, true);
    }, 120);
    return () => clearTimeout(timer);
  }, [fitMapToCoordinates, mapFitCoordinates]);

  useEffect(() => {
    if (!fullMapVisible || mapFitCoordinates.length === 0) return;
    setFullMapLoaded(false);
    const timer = setTimeout(() => {
      fitMapToCoordinates(fullMapRef, true);
    }, 120);
    return () => clearTimeout(timer);
  }, [fitMapToCoordinates, fullMapVisible, mapFitCoordinates]);

  useEffect(() => {
    setMiniMapLoaded(false);
  }, [mapMarkers, userLat, userLng, loading, mapTileFallback]);

  useEffect(() => {
    if (loading) {
      clearMiniMapLoadTimeout();
      clearFullMapLoadTimeout();
      return;
    }
    if (!miniMapLoaded) armMiniMapFallback();
    return () => clearMiniMapLoadTimeout();
  }, [armMiniMapFallback, clearMiniMapLoadTimeout, clearFullMapLoadTimeout, loading, miniMapLoaded]);

  useEffect(() => {
    if (!fullMapVisible) {
      clearFullMapLoadTimeout();
      return;
    }
    if (!fullMapLoaded) armFullMapFallback();
    return () => clearFullMapLoadTimeout();
  }, [armFullMapFallback, clearFullMapLoadTimeout, fullMapLoaded, fullMapVisible]);

  useEffect(() => () => {
    clearMiniMapLoadTimeout();
    clearFullMapLoadTimeout();
  }, [clearFullMapLoadTimeout, clearMiniMapLoadTimeout]);

  const hasActiveFilters =
    Boolean(activeCategory) ||
    deliveryOnly ||
    distanceFilter !== '5km' ||
    minRating > 0 ||
    planFilter !== 'all' ||
    storeTypeFilter !== 'all' ||
    sortBy !== 'nearest';

  const planHeaderSubtitle = myStore?.subscription?.status === 'active' && myStore.activePlan
    ? `Current: ${myStore.activePlan.title}`
    : 'Grow faster with premium visibility';

  const openMyStore = useCallback(() => {
    if (myStore?._id) {
      parentNavigate(navigation, 'ManageStore');
      return;
    }
    parentNavigate(navigation, 'CreateStore');
  }, [myStore?._id, navigation]);

  const openMapFullScreen = useCallback(() => {
    setFullMapVisible(true);
  }, []);

  const startPlanCheckout = useCallback(async (plan: StorePlan) => {
    if (!myStore?._id) {
      Alert.alert('Create your store first', 'Set up your store to subscribe to a plan.');
      parentNavigate(navigation, 'CreateStore');
      return;
    }

    if (myStore.subscription?.status === 'active' && myStore.subscription?.planId === plan.id) {
      Alert.alert('Already active', `${plan.title} is already active for your store.`);
      return;
    }

    try {
      const { checkout: checkoutData } = await createStoreSubscriptionCheckout(plan.id);
      setCheckout(checkoutData);
    } catch (e) {
      Alert.alert('Unable to continue', e instanceof Error ? e.message : 'Checkout could not be created.');
    }
  }, [myStore, navigation]);

  const completePayment = useCallback(async () => {
    if (!checkout) return;
    setPaying(true);
    try {
      const paymentId = `pay_sim_${Date.now()}`;
      const result = await verifyStoreSubscriptionPayment(checkout.orderId, paymentId);
      setCheckout(null);
      await loadMyStore();
      Alert.alert('Payment successful', result.message);
    } catch (e) {
      Alert.alert('Payment failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPaying(false);
    }
  }, [checkout, loadMyStore]);

  const toggleStoreLike = useCallback(async (store: BromoStore) => {
    const storeId = store._id;
    const currentlyLiked = likedStoreIds[storeId] ?? Boolean(store.isFavorited);
    setLikedStoreIds(prev => ({ ...prev, [storeId]: !currentlyLiked }));
    try {
      if (currentlyLiked) await unfavoriteStore(storeId);
      else await favoriteStore(storeId);
    } catch {
      setLikedStoreIds(prev => ({ ...prev, [storeId]: currentlyLiked }));
    }
  }, [likedStoreIds]);

  const callStore = useCallback((store: BromoStore) => {
    if (!store.phone?.trim()) {
      Alert.alert('Phone unavailable', 'This store has no phone number yet.');
      return;
    }
    openExternalUrl(`tel:${store.phone.trim()}`).catch(() => {
      Alert.alert('Call failed', 'Unable to open dialer.');
    });
  }, []);

  const openStoreDirection = useCallback((store: BromoStore) => {
    const [lng, lat] = store.location.coordinates;
    openExternalUrl(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
      .catch(() => Alert.alert('Directions unavailable', 'Unable to open maps right now.'));
  }, []);

  const openStoreProfile = useCallback((storeId: string) => {
    parentNavigate(navigation, 'StorePublicProfile', { storeId });
  }, [navigation]);

  const openStoreFromFullMap = useCallback((storeId: string) => {
    setFullMapVisible(false);
    openStoreProfile(storeId);
  }, [openStoreProfile]);

  const renderStoreMarkers = useCallback((onPressStore: (storeId: string) => void) => (
    mapMarkers.map(({ store, latitude, longitude }, markerIndex) => {
      const addressLine = store.address?.trim() || store.city?.trim() || 'Address unavailable';
      return (
        <Marker
          key={`${store._id}-${markerIndex}`}
          coordinate={{ latitude, longitude }}
          onCalloutPress={() => onPressStore(store._id)}>
          <View style={[s.storeMarkerOuter, { borderColor: palette.primary }]}>
            <View style={[s.storeMarkerInner, { backgroundColor: palette.primary }]} />
          </View>
          <Callout tooltip>
            <View style={[s.mapCallout, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {store.profilePhoto ? (
                <Image source={{ uri: store.profilePhoto }} style={s.mapCalloutImage} resizeMode="cover" />
              ) : null}
              <Text style={[s.mapCalloutName, { color: palette.foreground }]} numberOfLines={1}>
                {store.name}
              </Text>
              <Text style={[s.mapCalloutSubtle, { color: palette.foregroundSubtle }]} numberOfLines={1}>
                {store.category}
              </Text>
              <Text style={[s.mapCalloutSubtle, { color: palette.foregroundSubtle }]} numberOfLines={2}>
                {addressLine}
              </Text>
              <Text style={[s.mapCalloutCta, { color: palette.primary }]}>Tap to open →</Text>
            </View>
          </Callout>
        </Marker>
      );
    })
  ), [mapMarkers, palette.border, palette.card, palette.foreground, palette.foregroundSubtle, palette.primary]);

  const onPullRefresh = useCallback(async () => {
    setListRefreshing(true);
    try {
      await loadStores('refresh');
    } finally {
      setListRefreshing(false);
    }
  }, [loadStores]);

  return (
    <Screen bare edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[s.header, { borderBottomColor: palette.border, backgroundColor: palette.background }]}>
        {searchExpanded ? (
          <>
            <Text style={[s.brandCompact, { color: palette.primary }]} numberOfLines={1}>{appTitle}</Text>
            <View style={[s.searchRow, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Search size={15} color={palette.placeholder} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search stores or products"
                placeholderTextColor={palette.placeholder}
                style={[s.searchInput, { color: palette.foreground }]}
                autoFocus
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={14} color={palette.foregroundSubtle} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => setShowFilters(v => !v)}
              style={[s.circleBtn, { borderColor: palette.border, backgroundColor: hasActiveFilters ? `${palette.primary}18` : palette.input }]}
              hitSlop={8}>
              <SlidersHorizontal size={17} color={hasActiveFilters ? palette.primary : palette.foreground} />
            </Pressable>
            <Pressable onPress={() => setSearchExpanded(false)} style={[s.circleBtn, { borderColor: palette.border, backgroundColor: palette.input }]}>
              <X size={17} color={palette.foreground} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.brandTitle, { color: palette.primary }]} numberOfLines={1}>{appTitle}</Text>
            <View style={{ flex: 1 }} />
            <View style={s.headerActions}>
              <Pressable
                onPress={() => setSearchExpanded(true)}
                style={[s.circleBtn, { borderColor: palette.border, backgroundColor: palette.input }]}
                hitSlop={8}>
                <Search size={18} color={palette.foreground} />
              </Pressable>
              <Pressable
                onPress={() => parentNavigate(navigation, 'NotificationHistory3km')}
                style={[s.circleBtn, { borderColor: palette.border, backgroundColor: palette.input }]}
                hitSlop={8}>
                <Bell size={18} color={palette.foreground} />
              </Pressable>
              <Pressable
                onPress={openMyStore}
                style={[s.circleBtn, { borderColor: palette.border, backgroundColor: palette.input }]}
                hitSlop={8}>
                {myStoreLoading ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : myStore?.profilePhoto ? (
                  <Image source={{ uri: myStore.profilePhoto }} style={s.profileAvatar} resizeMode="cover" />
                ) : (
                  <Plus size={20} color={palette.primary} />
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>

      {showFilters && (
        <View style={[s.filtersPanel, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
          <Text style={[s.filterLabel, { color: palette.foregroundSubtle }]}>Sort</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {SORT_OPTIONS.map(option => {
              const active = sortBy === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSortBy(option.id)}
                  style={[s.pill, { backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.filterLabel, { color: palette.foregroundSubtle }]}>Distance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {DISTANCE_OPTIONS.map(option => {
              const active = distanceFilter === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setDistanceFilter(option.id)}
                  style={[s.pill, { backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.filterLabel, { color: palette.foregroundSubtle }]}>Rating & Plan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {RATING_FILTERS.map(option => {
              const active = minRating === option.id;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setMinRating(option.id)}
                  style={[s.pill, { backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground }}>{option.label}</Text>
                </Pressable>
              );
            })}
            {(['all', 'basic', 'premium', 'gold'] as const).map(id => {
              const active = planFilter === id;
              const label = id === 'all' ? 'All Plans' : id[0].toUpperCase() + id.slice(1);
              return (
                <Pressable
                  key={id}
                  onPress={() => setPlanFilter(id)}
                  style={[s.pill, { backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground }}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.filterLabel, { color: palette.foregroundSubtle }]}>Store Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {([
              ['all', 'All Stores'],
              ['d2c', 'D2C Discounts'],
              ['b2b', 'B2B Bulk'],
              ['online', 'Online Selling'],
            ] as const).map(([id, label]) => {
              const active = storeTypeFilter === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setStoreTypeFilter(id)}
                  style={[s.pill, { backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground }}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setDeliveryOnly(v => !v)}
            style={[s.deliveryToggle, { borderColor: deliveryOnly ? palette.success : palette.border, backgroundColor: deliveryOnly ? `${palette.success}16` : palette.input }]}>
            <Truck size={14} color={deliveryOnly ? palette.success : palette.foregroundSubtle} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: deliveryOnly ? palette.success : palette.foreground }}>Delivery Available</Text>
            <View style={[s.checkPill, { backgroundColor: deliveryOnly ? palette.success : 'transparent', borderColor: deliveryOnly ? palette.success : palette.border }]}>
              {deliveryOnly ? <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>ON</Text> : null}
            </View>
          </Pressable>
        </View>
      )}

      <RefreshableScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 90 }}
        refreshing={listRefreshing}
        onRefresh={onPullRefresh}>
        <View style={[s.locationCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color={palette.primary} />
              <Text style={{ color: palette.foreground, fontSize: 13, fontWeight: '700' }}>Your Location</Text>
            </View>
            <Text style={{ color: palette.foregroundSubtle, fontSize: 12, marginTop: 2 }}>{locationLabel}</Text>
            <Text style={{ color: palette.placeholder, fontSize: 11, marginTop: 2 }}>
              Auto-detected for nearest stores and products
            </Text>
          </View>
          <Pressable
            onPress={refreshLocation}
            style={[s.relocateBtn, { borderColor: palette.border, backgroundColor: palette.input }]}
            hitSlop={8}>
            <LocateFixed size={14} color={palette.primary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.primary }}>Refresh</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
          {categoryPills.map(cat => {
            const active = activeCategory === cat;
            const label = cat === '' ? 'All' : cat.replace(' & ', ' · ');
            return (
              <Pressable
                key={cat || 'all'}
                onPress={() => setActiveCategory(cat)}
                style={[s.pill, { backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground }}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[s.mapCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
          <View style={s.sectionHeadRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Navigation size={14} color={palette.primary} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: palette.foreground }}>Stores Near Me</Text>
            </View>
            <Pressable onPress={openMapFullScreen}>
              <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>View full map</Text>
            </Pressable>
          </View>
          {loading ? (
            <View style={[s.mapLoading, { borderColor: palette.border, backgroundColor: palette.input }]}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <View style={[s.mapPreviewWrap, { borderColor: palette.border, backgroundColor: palette.input }]}>
              <MapView
                key={mapTileFallback ? 'mini-fallback' : 'mini-google'}
                ref={mapRef}
                style={s.mapPreview}
                provider={mapTileFallback && Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
                initialRegion={mapRegion}
                mapType={mapTileFallback && Platform.OS === 'android' ? 'none' : 'satellite'}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                showsCompass={false}
                showsUserLocation={userLat != null && userLng != null}
                onMapReady={handleMiniMapReady}
                onMapLoaded={handleMiniMapLoaded}>
                {mapTileFallback && Platform.OS === 'android' ? (
                  <UrlTile
                    urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maximumZ={19}
                  />
                ) : null}
                {renderStoreMarkers(openStoreProfile)}
              </MapView>
              <View style={[s.mapHintPill, { backgroundColor: `${palette.background}D8`, borderColor: palette.border }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: palette.foreground }}>
                  {mapMarkers.length} stores pinned
                </Text>
                <Text style={{ fontSize: 10, color: palette.foregroundSubtle }}>
                  {mapMarkers.length > 0 ? 'Tap a marker, then tap the callout to open store' : 'Map centered to default region'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {!plansHiddenSession && plans.length > 0 && (
          <View style={{ paddingTop: 16 }}>
            <View style={s.sectionHeadRowPadded}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '900', color: palette.foreground }}>Store Plans</Text>
                <Text style={{ fontSize: 12, color: palette.foregroundSubtle }}>{planHeaderSubtitle}</Text>
              </View>
              <Pressable
                onPress={() => setPlansHiddenSession(true)}
                style={[s.closePlansBtn, { borderColor: palette.border, backgroundColor: palette.input }]}
                hitSlop={8}>
                <X size={15} color={palette.foreground} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.plansRow}>
              {plans.map(plan => {
                const isActive =
                  myStore?.subscription?.status === 'active' && myStore?.subscription?.planId === plan.id;
                const badgeColor =
                  plan.badge === 'gold' ? '#d4a837' : plan.badge === 'premium' ? '#3b82f6' : palette.success;

                return (
                  <View key={plan.id} style={[s.planCard, { borderColor: isActive ? palette.primary : palette.border, backgroundColor: palette.card }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 17, fontWeight: '900', color: palette.foreground }}>{plan.title}</Text>
                      <View style={[s.badgePill, { backgroundColor: `${badgeColor}20`, borderColor: `${badgeColor}40` }]}>
                        <ShieldCheck size={11} color={badgeColor} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: badgeColor, textTransform: 'uppercase' }}>{plan.badge}</Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 23, fontWeight: '900', color: palette.primary, marginTop: 10 }}>₹{plan.monthlyPriceInr}</Text>
                    <Text style={{ fontSize: 11, color: palette.foregroundSubtle }}>/month · {plan.billedAs}</Text>

                    <View style={{ marginTop: 12, gap: 7 }}>
                      {plan.features.slice(0, 5).map((feature, featureIndex) => (
                        <View key={`${plan.id}-${featureIndex}`} style={{ flexDirection: 'row', gap: 7, alignItems: 'flex-start' }}>
                          <BadgeCheck size={12} color={palette.success} style={{ marginTop: 1 }} />
                          <Text style={{ flex: 1, fontSize: 12, color: palette.foregroundSubtle, lineHeight: 17 }}>{feature}</Text>
                        </View>
                      ))}
                    </View>

                    <Pressable
                      onPress={() => {
                        startPlanCheckout(plan).catch(() => undefined);
                      }}
                      style={[s.planCta, {
                        backgroundColor: isActive ? `${palette.success}18` : palette.primary,
                        borderColor: isActive ? `${palette.success}44` : palette.primary,
                      }]}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: isActive ? palette.success : palette.primaryForeground }}>
                        {isActive ? 'Current Plan' : myStore ? `Subscribe ₹${plan.monthlyPriceInr}` : 'Create Store to Subscribe'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={[s.sectionHeadRowPadded, { paddingTop: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Store size={15} color={palette.primary} />
            <Text style={{ fontSize: 14, fontWeight: '900', color: palette.foreground }}>
              {query.trim() ? 'Search Results' : 'Stores Near You'}
            </Text>
          </View>
          <Pressable onPress={() => parentNavigate(navigation, 'AllStores')}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.primary }}>All stores</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 14 }}>
          {loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 26 }} />
          ) : stores.length === 0 ? (
            <View style={s.emptyState}>
              <Package size={44} color={palette.foregroundSubtle} />
              <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 10, color: palette.foreground }}>No stores found</Text>
              <Text style={{ fontSize: 12, marginTop: 4, color: palette.foregroundSubtle }}>Try another filter or search keyword.</Text>
            </View>
          ) : (
            stores.map((store, i) => (

              <View
                key={`${store._id}-${i}`}
                style={{
                  width: '100%',
                  marginTop: 10,
                  borderWidth: 1.5,
                  borderColor: palette.border,
                  // paddingVertical: 10,
                  borderRadius: 28,
                  backgroundColor: palette.surface,
                }}
              >
                <StoreDiscoverCard
                  store={store}
                  palette={palette}
                  liked={likedStoreIds[store._id] ?? Boolean(store.isFavorited)}
                  style={{ marginTop: i === 0 ? 0 : 14 }}
                  onPressCard={() => parentNavigate(navigation, 'StorePublicProfile', { storeId: store._id })}
                  onToggleLike={() => {
                    toggleStoreLike(store).catch(() => undefined);
                  }}
                  onCall={() => callStore(store)}
                  onDirection={() => openStoreDirection(store)}
                  onViewOffers={() => parentNavigate(navigation, 'StorePublicProfile', { storeId: store._id })}
                />
              </View>
            ))
          )}
        </View>
      </RefreshableScrollView>

      <Pressable
        onPress={openMyStore}
        style={[s.fab, { bottom: tabBarHeight + 16, backgroundColor: palette.primary, shadowColor: palette.primary }]}
        hitSlop={10}>
        {myStore?._id ? <Store size={15} color={palette.primaryForeground} /> : <Plus size={15} color={palette.primaryForeground} />}
        <Text style={{ fontSize: 12, fontWeight: '800', color: palette.primaryForeground }}>
          {myStore?._id ? 'My Store' : 'Create Store'}
        </Text>
      </Pressable>

      <Modal
        animationType="slide"
        presentationStyle="fullScreen"
        visible={fullMapVisible}
        onRequestClose={() => setFullMapVisible(false)}>
        <SafeAreaView edges={['top', 'bottom']} style={[s.fullMapModal, { backgroundColor: palette.background }]}>
          <View style={[s.fullMapHeader, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
            <Pressable
              onPress={() => setFullMapVisible(false)}
              style={[s.fullMapCloseBtn, { borderColor: palette.border, backgroundColor: palette.input }]}>
              <X size={16} color={palette.foreground} />
            </Pressable>
            <View style={s.fullMapHeaderCenter}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: palette.foreground }}>Stores Near You</Text>
              <Text style={{ fontSize: 12, color: palette.foregroundSubtle }}>{mapMarkers.length} stores</Text>
            </View>
            <View style={s.fullMapHeaderSpacer} />
          </View>

          <View style={s.fullMapBody}>
            <MapView
              key={mapTileFallback ? 'full-fallback' : 'full-google'}
              ref={fullMapRef}
              style={s.fullMap}
              provider={mapTileFallback && Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE}
              initialRegion={mapRegion}
              mapType={mapTileFallback && Platform.OS === 'android' ? 'none' : 'satellite'}
              scrollEnabled
              zoomEnabled
              rotateEnabled
              pitchEnabled
              toolbarEnabled
              showsCompass
              showsMyLocationButton
              showsUserLocation={userLat != null && userLng != null}
              onMapReady={handleFullMapReady}
              onMapLoaded={handleFullMapLoaded}>
              {mapTileFallback && Platform.OS === 'android' ? (
                <UrlTile
                  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                />
              ) : null}
              {renderStoreMarkers(openStoreFromFullMap)}
            </MapView>
            <View style={[s.fullMapHintBar, { backgroundColor: `${palette.background}E8`, borderColor: palette.border }]}>
              <Text style={{ fontSize: 12, color: palette.foregroundSubtle }}>
                {mapMarkers.length > 0 ? 'Tap a marker, then tap the callout to open store.' : 'No nearby stores pinned yet.'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={checkout != null}
        onRequestClose={() => {
          if (!paying) setCheckout(null);
        }}>
        <View style={s.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => (!paying ? setCheckout(null) : undefined)} />
          <View style={[s.checkoutSheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: palette.foreground }}>Razorpay (Simulated)</Text>
              <Pressable
                onPress={() => setCheckout(null)}
                disabled={paying}
                style={[s.closePlansBtn, { borderColor: palette.border, backgroundColor: palette.input }]}>
                <X size={15} color={palette.foreground} />
              </Pressable>
            </View>

            {checkout && (
              <>
                <Text style={{ fontSize: 13, color: palette.foregroundSubtle, marginTop: 10 }}>{checkout.plan.title}</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: palette.primary, marginTop: 6 }}>₹{checkout.amountInr}</Text>
                <Text style={{ fontSize: 11, color: palette.foregroundSubtle, marginTop: 2 }}>Order ID: {checkout.orderId}</Text>

                <View style={[s.checkoutSummary, { borderColor: palette.border, backgroundColor: palette.input }]}>
                  <View style={s.checkoutRow}>
                    <Text style={{ fontSize: 12, color: palette.foregroundSubtle }}>Merchant</Text>
                    <Text style={{ fontSize: 12, color: palette.foreground, fontWeight: '700' }}>{checkout.merchantName}</Text>
                  </View>
                  <View style={s.checkoutRow}>
                    <Text style={{ fontSize: 12, color: palette.foregroundSubtle }}>Plan</Text>
                    <Text style={{ fontSize: 12, color: palette.foreground, fontWeight: '700' }}>{checkout.plan.title}</Text>
                  </View>
                  <View style={s.checkoutRow}>
                    <Text style={{ fontSize: 12, color: palette.foregroundSubtle }}>Billing</Text>
                    <Text style={{ fontSize: 12, color: palette.foreground, fontWeight: '700' }}>Monthly</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    completePayment().catch(() => undefined);
                  }}
                  disabled={paying}
                  style={[s.payBtn, { backgroundColor: palette.primary }]}>
                  {paying ? (
                    <ActivityIndicator size="small" color={palette.primaryForeground} />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '900', color: palette.primaryForeground }}>Pay ₹{checkout.amountInr}</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandTitle: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.9,
    fontStyle: 'italic',
  },
  brandCompact: {
    width: 86,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontStyle: 'italic',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  searchRow: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filtersPanel: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    gap: 10,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginHorizontal: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pillRow: {
    paddingHorizontal: 14,
    gap: 8,
  },
  categoryRow: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  deliveryToggle: {
    marginHorizontal: 14,
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkPill: {
    minWidth: 24,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  locationCard: {
    marginHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  relocateBtn: {
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapCard: {
    marginHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 8,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeadRowPadded: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  mapPreview: {
    height: 188,
    width: '100%',
  },
  mapPreviewWrap: {
    height: 188,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapLoading: {
    height: 188,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  storeMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapCallout: {
    minWidth: 190,
    maxWidth: 240,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapCalloutImage: {
    width: '100%',
    height: 92,
    borderRadius: 8,
    marginBottom: 8,
  },
  mapCalloutName: {
    fontSize: 13,
    fontWeight: '800',
  },
  mapCalloutSubtle: {
    marginTop: 2,
    fontSize: 11,
  },
  mapCalloutCta: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  mapHintPill: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  closePlansBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansRow: {
    paddingHorizontal: 14,
    gap: 12,
    paddingTop: 10,
  },
  planCard: {
    width: 295,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planCta: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 44,
  },
  fab: {
    position: 'absolute',
    right: 14,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowOpacity: 0.35,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  fullMapModal: {
    flex: 1,
  },
  fullMapHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullMapCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullMapHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  fullMapHeaderSpacer: {
    width: 34,
    height: 34,
  },
  fullMapBody: {
    flex: 1,
  },
  fullMap: {
    ...StyleSheet.absoluteFillObject,
  },
  fullMapHintBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  checkoutSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
  },
  checkoutSummary: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 14,
    padding: 12,
    gap: 8,
  },
  checkoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payBtn: {
    marginTop: 16,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
