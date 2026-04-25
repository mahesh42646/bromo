import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
  BadgeCheck,
  Bell,
  ChevronRight,
  Crown,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Store,
  Truck,
  X,
} from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import {useTheme} from '../context/ThemeContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';
import {
  createStoreSubscriptionCheckout,
  getMyStore,
  getStorePlans,
  listStores,
  verifyStoreSubscriptionPayment,
  type Store as BromoStore,
  STORE_CATEGORIES,
  type StorePlan,
  type StorePlanId,
} from '../api/storeApi';
import {openExternalUrl} from '../lib/openExternalUrl';

function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

type DistanceFilter = 'all' | '1km' | '3km' | '5km' | '10km';

const DISTANCE_OPTIONS: Array<{id: DistanceFilter; label: string; meters: number | null}> = [
  {id: 'all', label: 'All', meters: null},
  {id: '1km', label: '1 km', meters: 1000},
  {id: '3km', label: '3 km', meters: 3000},
  {id: '5km', label: '5 km', meters: 5000},
  {id: '10km', label: '10 km', meters: 10000},
];

const SORT_OPTIONS: Array<{id: 'nearest' | 'popular' | 'rating' | 'newest'; label: string}> = [
  {id: 'nearest', label: 'Nearest'},
  {id: 'popular', label: 'Popular'},
  {id: 'rating', label: 'Top Rated'},
  {id: 'newest', label: 'Newest'},
];

const RATING_FILTERS: Array<{id: number; label: string}> = [
  {id: 0, label: 'Any Rating'},
  {id: 4, label: '4.0+'},
  {id: 4.5, label: '4.5+'},
];

type CheckoutState = {
  orderId: string;
  amountInr: number;
  currency: 'INR';
  merchantName: string;
  plan: StorePlan;
};

const categoryPills = ['', ...STORE_CATEGORIES.slice(0, 7)];

export function StoreScreen() {
  const navigation = useNavigation();
  const {palette, isDark, contract} = useTheme();
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

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const [myStore, setMyStore] = useState<BromoStore | null>(null);
  const [myStoreLoading, setMyStoreLoading] = useState(true);

  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [plansHiddenSession, setPlansHiddenSession] = useState(false);

  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [paying, setPaying] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const appTitle = contract.branding.appTitle || 'BROMO';

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
      {enableHighAccuracy: false, timeout: 10000, maximumAge: 20000},
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

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const {stores: result} = await listStores({
        q: query.trim() || undefined,
        delivery: deliveryOnly || undefined,
        category: activeCategory || undefined,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
        maxDistance: userLat != null && distanceMeters != null ? distanceMeters : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        sortBy,
        plan: planFilter === 'all' ? undefined : planFilter,
      });
      setStores(result);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
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

  const locationLabel =
    userLat != null && userLng != null
      ? `${userLat.toFixed(3)}, ${userLng.toFixed(3)}`
      : 'Location unavailable';

  const mapPreviewUrl =
    userLat != null && userLng != null
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${userLat},${userLng}&zoom=14&size=900x260&markers=${userLat},${userLng},blue-pushpin`
      : null;

  const hasActiveFilters =
    Boolean(activeCategory) ||
    deliveryOnly ||
    distanceFilter !== '5km' ||
    minRating > 0 ||
    planFilter !== 'all' ||
    sortBy !== 'nearest';

  const planHeaderSubtitle = myStore?.subscription?.status === 'active' && myStore.activePlan
    ? `Current: ${myStore.activePlan.title}`
    : 'Grow faster with premium visibility';

  const openMyStore = useCallback(() => {
    if (myStore?._id) {
      parentNavigate(navigation, 'StorePublicProfile', {storeId: myStore._id});
      return;
    }
    parentNavigate(navigation, 'CreateStore');
  }, [myStore?._id, navigation]);

  const openMapFullScreen = useCallback(() => {
    if (userLat == null || userLng == null) {
      Alert.alert('Location required', 'Turn on location to view nearby stores on map.');
      return;
    }
    openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`stores near ${userLat},${userLng}`)}`)
      .catch(() => undefined);
  }, [userLat, userLng]);

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
      const {checkout: checkoutData} = await createStoreSubscriptionCheckout(plan.id);
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

  return (
    <ThemedSafeScreen edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[s.header, {borderBottomColor: palette.border, backgroundColor: palette.background}]}> 
        {searchExpanded ? (
          <>
            <Text style={[s.brandCompact, {color: palette.primary}]} numberOfLines={1}>{appTitle}</Text>
            <View style={[s.searchRow, {backgroundColor: palette.input, borderColor: palette.border}]}> 
              <Search size={15} color={palette.placeholder} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search stores or products"
                placeholderTextColor={palette.placeholder}
                style={[s.searchInput, {color: palette.foreground}]}
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
              style={[s.circleBtn, {borderColor: palette.border, backgroundColor: hasActiveFilters ? `${palette.primary}18` : palette.input}]}
              hitSlop={8}>
              <SlidersHorizontal size={17} color={hasActiveFilters ? palette.primary : palette.foreground} />
            </Pressable>
            <Pressable onPress={() => setSearchExpanded(false)} style={[s.circleBtn, {borderColor: palette.border, backgroundColor: palette.input}]}>
              <X size={17} color={palette.foreground} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.brandTitle, {color: palette.primary}]} numberOfLines={1}>{appTitle}</Text>
            <View style={{flex: 1}} />
            <View style={s.headerActions}>
              <Pressable
                onPress={() => setSearchExpanded(true)}
                style={[s.circleBtn, {borderColor: palette.border, backgroundColor: palette.input}]}
                hitSlop={8}>
                <Search size={18} color={palette.foreground} />
              </Pressable>
              <Pressable
                onPress={() => parentNavigate(navigation, 'NotificationHistory3km')}
                style={[s.circleBtn, {borderColor: palette.border, backgroundColor: palette.input}]}
                hitSlop={8}>
                <Bell size={18} color={palette.foreground} />
              </Pressable>
              <Pressable
                onPress={openMyStore}
                style={[s.circleBtn, {borderColor: palette.border, backgroundColor: palette.input}]}
                hitSlop={8}>
                {myStoreLoading ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : myStore?.profilePhoto ? (
                  <Image source={{uri: myStore.profilePhoto}} style={s.profileAvatar} resizeMode="cover" />
                ) : (
                  <Plus size={20} color={palette.primary} />
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>

      {showFilters && (
        <View style={[s.filtersPanel, {backgroundColor: palette.surface, borderBottomColor: palette.border}]}> 
          <Text style={[s.filterLabel, {color: palette.foregroundSubtle}]}>Sort</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {SORT_OPTIONS.map(option => {
              const active = sortBy === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSortBy(option.id)}
                  style={[s.pill, {backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border}]}> 
                  <Text style={{fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground}}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.filterLabel, {color: palette.foregroundSubtle}]}>Distance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {DISTANCE_OPTIONS.map(option => {
              const active = distanceFilter === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setDistanceFilter(option.id)}
                  style={[s.pill, {backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border}]}> 
                  <Text style={{fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground}}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.filterLabel, {color: palette.foregroundSubtle}]}>Rating & Plan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {RATING_FILTERS.map(option => {
              const active = minRating === option.id;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setMinRating(option.id)}
                  style={[s.pill, {backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border}]}> 
                  <Text style={{fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground}}>{option.label}</Text>
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
                  style={[s.pill, {backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border}]}> 
                  <Text style={{fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground}}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setDeliveryOnly(v => !v)}
            style={[s.deliveryToggle, {borderColor: deliveryOnly ? palette.success : palette.border, backgroundColor: deliveryOnly ? `${palette.success}16` : palette.input}]}> 
            <Truck size={14} color={deliveryOnly ? palette.success : palette.foregroundSubtle} />
            <Text style={{flex: 1, fontSize: 12, fontWeight: '700', color: deliveryOnly ? palette.success : palette.foreground}}>Delivery Available</Text>
            <View style={[s.checkPill, {backgroundColor: deliveryOnly ? palette.success : 'transparent', borderColor: deliveryOnly ? palette.success : palette.border}]}>
              {deliveryOnly ? <Text style={{color: '#fff', fontSize: 10, fontWeight: '800'}}>ON</Text> : null}
            </View>
          </Pressable>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: tabBarHeight + 90}}>
        <View style={[s.locationCard, {borderColor: palette.border, backgroundColor: palette.card}]}> 
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <MapPin size={14} color={palette.primary} />
              <Text style={{color: palette.foreground, fontSize: 13, fontWeight: '700'}}>Your Location</Text>
            </View>
            <Text style={{color: palette.foregroundSubtle, fontSize: 12, marginTop: 2}}>{locationLabel}</Text>
            <Text style={{color: palette.placeholder, fontSize: 11, marginTop: 2}}>
              Auto-detected for nearest stores and products
            </Text>
          </View>
          <Pressable
            onPress={refreshLocation}
            style={[s.relocateBtn, {borderColor: palette.border, backgroundColor: palette.input}]}
            hitSlop={8}>
            <LocateFixed size={14} color={palette.primary} />
            <Text style={{fontSize: 11, fontWeight: '700', color: palette.primary}}>Refresh</Text>
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
                style={[s.pill, {backgroundColor: active ? palette.primary : palette.input, borderColor: active ? palette.primary : palette.border}]}> 
                <Text style={{fontSize: 12, fontWeight: '700', color: active ? palette.primaryForeground : palette.foreground}}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[s.mapCard, {borderColor: palette.border, backgroundColor: palette.card}]}> 
          <View style={s.sectionHeadRow}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 7}}>
              <Navigation size={14} color={palette.primary} />
              <Text style={{fontSize: 13, fontWeight: '800', color: palette.foreground}}>Stores Near Me</Text>
            </View>
            <Pressable onPress={openMapFullScreen}>
              <Text style={{color: palette.primary, fontSize: 12, fontWeight: '700'}}>View full map</Text>
            </Pressable>
          </View>
          {mapPreviewUrl ? (
            <Image source={{uri: mapPreviewUrl}} style={[s.mapPreview, {borderColor: palette.border}]} resizeMode="cover" />
          ) : (
            <View style={[s.mapEmpty, {borderColor: palette.border, backgroundColor: palette.input}]}> 
              <MapPin size={20} color={palette.foregroundSubtle} />
              <Text style={{fontSize: 12, color: palette.foregroundSubtle}}>Enable location to load nearby map</Text>
            </View>
          )}
        </View>

        {!plansHiddenSession && plans.length > 0 && (
          <View style={{paddingTop: 16}}>
            <View style={s.sectionHeadRowPadded}>
              <View>
                <Text style={{fontSize: 14, fontWeight: '900', color: palette.foreground}}>Store Plans</Text>
                <Text style={{fontSize: 12, color: palette.foregroundSubtle}}>{planHeaderSubtitle}</Text>
              </View>
              <Pressable
                onPress={() => setPlansHiddenSession(true)}
                style={[s.closePlansBtn, {borderColor: palette.border, backgroundColor: palette.input}]}
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
                  <View key={plan.id} style={[s.planCard, {borderColor: isActive ? palette.primary : palette.border, backgroundColor: palette.card}]}> 
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Text style={{fontSize: 17, fontWeight: '900', color: palette.foreground}}>{plan.title}</Text>
                      <View style={[s.badgePill, {backgroundColor: `${badgeColor}20`, borderColor: `${badgeColor}40`}]}> 
                        <ShieldCheck size={11} color={badgeColor} />
                        <Text style={{fontSize: 10, fontWeight: '800', color: badgeColor, textTransform: 'uppercase'}}>{plan.badge}</Text>
                      </View>
                    </View>

                    <Text style={{fontSize: 23, fontWeight: '900', color: palette.primary, marginTop: 10}}>₹{plan.monthlyPriceInr}</Text>
                    <Text style={{fontSize: 11, color: palette.foregroundSubtle}}>/month · {plan.billedAs}</Text>

                    <View style={{marginTop: 12, gap: 7}}>
                      {plan.features.slice(0, 5).map(feature => (
                        <View key={feature} style={{flexDirection: 'row', gap: 7, alignItems: 'flex-start'}}>
                          <BadgeCheck size={12} color={palette.success} style={{marginTop: 1}} />
                          <Text style={{flex: 1, fontSize: 12, color: palette.foregroundSubtle, lineHeight: 17}}>{feature}</Text>
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
                      <Text style={{fontSize: 13, fontWeight: '800', color: isActive ? palette.success : palette.primaryForeground}}>
                        {isActive ? 'Current Plan' : myStore ? `Subscribe ₹${plan.monthlyPriceInr}` : 'Create Store to Subscribe'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={[s.sectionHeadRowPadded, {paddingTop: 18}]}> 
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Store size={15} color={palette.primary} />
            <Text style={{fontSize: 14, fontWeight: '900', color: palette.foreground}}>
              {query.trim() ? 'Search Results' : 'Stores Nearby'}
            </Text>
          </View>
          <Pressable onPress={() => parentNavigate(navigation, 'AllStores')}>
            <Text style={{fontSize: 12, fontWeight: '700', color: palette.primary}}>All stores</Text>
          </Pressable>
        </View>

        <View style={{paddingHorizontal: 14}}>
          {loading ? (
            <ActivityIndicator color={palette.primary} style={{marginTop: 26}} />
          ) : stores.length === 0 ? (
            <View style={s.emptyState}>
              <Package size={44} color={palette.foregroundSubtle} />
              <Text style={{fontSize: 15, fontWeight: '700', marginTop: 10, color: palette.foreground}}>No stores found</Text>
              <Text style={{fontSize: 12, marginTop: 4, color: palette.foregroundSubtle}}>Try another filter or search keyword.</Text>
            </View>
          ) : (
            stores.map((store, i) => (
              <StoreDiscoverCard
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

      <Pressable
        onPress={openMyStore}
        style={[s.fab, {bottom: tabBarHeight + 16, backgroundColor: palette.primary, shadowColor: palette.primary}]}
        hitSlop={10}>
        {myStore?._id ? <Store size={15} color={palette.primaryForeground} /> : <Plus size={15} color={palette.primaryForeground} />}
        <Text style={{fontSize: 12, fontWeight: '800', color: palette.primaryForeground}}>
          {myStore?._id ? 'My Store' : 'Create Store'}
        </Text>
      </Pressable>

      <Modal
        transparent
        animationType="slide"
        visible={checkout != null}
        onRequestClose={() => {
          if (!paying) setCheckout(null);
        }}>
        <View style={s.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => (!paying ? setCheckout(null) : undefined)} />
          <View style={[s.checkoutSheet, {backgroundColor: palette.card, borderColor: palette.border}]}> 
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={{fontSize: 16, fontWeight: '900', color: palette.foreground}}>Razorpay (Simulated)</Text>
              <Pressable
                onPress={() => setCheckout(null)}
                disabled={paying}
                style={[s.closePlansBtn, {borderColor: palette.border, backgroundColor: palette.input}]}> 
                <X size={15} color={palette.foreground} />
              </Pressable>
            </View>

            {checkout && (
              <>
                <Text style={{fontSize: 13, color: palette.foregroundSubtle, marginTop: 10}}>{checkout.plan.title}</Text>
                <Text style={{fontSize: 24, fontWeight: '900', color: palette.primary, marginTop: 6}}>₹{checkout.amountInr}</Text>
                <Text style={{fontSize: 11, color: palette.foregroundSubtle, marginTop: 2}}>Order ID: {checkout.orderId}</Text>

                <View style={[s.checkoutSummary, {borderColor: palette.border, backgroundColor: palette.input}]}> 
                  <View style={s.checkoutRow}>
                    <Text style={{fontSize: 12, color: palette.foregroundSubtle}}>Merchant</Text>
                    <Text style={{fontSize: 12, color: palette.foreground, fontWeight: '700'}}>{checkout.merchantName}</Text>
                  </View>
                  <View style={s.checkoutRow}>
                    <Text style={{fontSize: 12, color: palette.foregroundSubtle}}>Plan</Text>
                    <Text style={{fontSize: 12, color: palette.foreground, fontWeight: '700'}}>{checkout.plan.title}</Text>
                  </View>
                  <View style={s.checkoutRow}>
                    <Text style={{fontSize: 12, color: palette.foregroundSubtle}}>Billing</Text>
                    <Text style={{fontSize: 12, color: palette.foreground, fontWeight: '700'}}>Monthly</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    completePayment().catch(() => undefined);
                  }}
                  disabled={paying}
                  style={[s.payBtn, {backgroundColor: palette.primary}]}> 
                  {paying ? (
                    <ActivityIndicator size="small" color={palette.primaryForeground} />
                  ) : (
                    <Text style={{fontSize: 14, fontWeight: '900', color: palette.primaryForeground}}>Pay ₹{checkout.amountInr}</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ThemedSafeScreen>
  );
}

function StoreDiscoverCard({
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
  const badge = store.subscription?.status === 'active' ? store.subscription.badge : 'none';
  const badgeColor =
    badge === 'gold' ? '#d4a837' : badge === 'premium' ? '#3b82f6' : badge === 'standard' ? '#10b981' : '';

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        s.storeCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: pressed ? 0.9 : 1,
          marginTop: index === 0 ? 0 : 14,
        },
      ]}>
      <View style={[s.storeBanner, {backgroundColor: palette.glassFaint}]}> 
        {store.bannerImage ? (
          <Image source={{uri: store.bannerImage}} style={s.storeBannerImg} resizeMode="cover" />
        ) : (
          <View style={[s.storeBannerImg, {alignItems: 'center', justifyContent: 'center'}]}>
            <Store size={20} color={palette.primary} />
          </View>
        )}
      </View>

      <View style={s.storeBody}>
        <View style={[s.storeAvatarWrap, {borderColor: palette.background, backgroundColor: palette.background}]}> 
          {store.profilePhoto ? (
            <Image source={{uri: store.profilePhoto}} style={s.storeAvatar} resizeMode="cover" />
          ) : (
            <View style={[s.storeAvatar, {alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.primary}1a`}]}> 
              <Text style={{fontSize: 18, fontWeight: '900', color: palette.primary}}>{store.name[0]}</Text>
            </View>
          )}
        </View>

        <View style={{flex: 1, minWidth: 0}}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
            <View style={{flex: 1}}>
              <Text style={{fontSize: 15, fontWeight: '900', color: palette.foreground}} numberOfLines={1}>{store.name}</Text>
              <Text style={{fontSize: 11, fontWeight: '700', color: palette.primary, marginTop: 2}} numberOfLines={1}>{store.category}</Text>
            </View>
            <ChevronRight size={16} color={palette.foregroundSubtle} />
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8}}>
            <View style={s.metaItem}>
              <MapPin size={11} color={palette.foregroundSubtle} />
              <Text style={{fontSize: 11, color: palette.foregroundSubtle}}>{store.city}</Text>
            </View>
            {store.distance != null && (
              <View style={s.metaItem}>
                <Navigation size={11} color={palette.primary} />
                <Text style={{fontSize: 11, fontWeight: '700', color: palette.primary}}>{fmtDistance(store.distance)}</Text>
              </View>
            )}
            {store.ratingAvg > 0 && (
              <View style={s.metaItem}>
                <Star size={11} color={palette.warning} fill={palette.warning} />
                <Text style={{fontSize: 11, fontWeight: '700', color: palette.warning}}>{store.ratingAvg.toFixed(1)}</Text>
              </View>
            )}
            <View style={s.metaItem}>
              <Package size={11} color={palette.foregroundSubtle} />
              <Text style={{fontSize: 11, color: palette.foregroundSubtle}}>{store.totalProducts} products</Text>
            </View>
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10}}>
            {store.hasDelivery && (
              <View style={[s.infoTag, {backgroundColor: `${palette.success}16`, borderColor: `${palette.success}45`}]}> 
                <Truck size={10} color={palette.success} />
                <Text style={{fontSize: 10, fontWeight: '800', color: palette.success}}>DELIVERY</Text>
              </View>
            )}
            {badge !== 'none' && (
              <View style={[s.infoTag, {backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}45`}]}> 
                {badge === 'gold' ? <Crown size={10} color={badgeColor} /> : <BadgeCheck size={10} color={badgeColor} />}
                <Text style={{fontSize: 10, fontWeight: '800', color: badgeColor, textTransform: 'uppercase'}}>{badge}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
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
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 9},
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
    height: 125,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
  },
  mapEmpty: {
    height: 125,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  storeCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  storeBanner: {
    height: 82,
  },
  storeBannerImg: {
    width: '100%',
    height: '100%',
  },
  storeBody: {
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  storeAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    marginTop: -34,
    overflow: 'hidden',
  },
  storeAvatar: {
    width: '100%',
    height: '100%',
  },
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  infoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    shadowOffset: {width: 0, height: 5},
    elevation: 8,
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
