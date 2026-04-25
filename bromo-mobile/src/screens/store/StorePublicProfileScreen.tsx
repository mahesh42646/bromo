import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {
  ChevronLeft,
  Heart,
  MapPin,
  Truck,
  Phone,
  Package,
  Navigation,
  Star,
  Eye,
  BadgeCheck,
  Crown,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {getStore, listProducts, favoriteStore, unfavoriteStore, type Store, type StoreProduct} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StorePublicProfile'>;

export function StorePublicProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {storeId} = route.params;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([getStore(storeId), listProducts(storeId)]);
        setStore(s);
        setProducts(p);
        setFavorited(s.isFavorited ?? false);
      } catch {
        Alert.alert('Error', 'Failed to load store');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId, navigation]);

  const toggleFavorite = useCallback(async () => {
    if (!store) return;
    setFavLoading(true);
    const prev = favorited;
    setFavorited(!prev);
    try {
      if (prev) await unfavoriteStore(store._id);
      else await favoriteStore(store._id);
    } catch {
      setFavorited(prev);
    } finally {
      setFavLoading(false);
    }
  }, [store, favorited]);

  const openDirections = useCallback(() => {
    if (!store) return;
    const [lng, lat] = store.location.coordinates;
    const label = encodeURIComponent(store.name);
    const url =
      Platform.OS === 'ios'
        ? `maps://app?daddr=${lat},${lng}&q=${label}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.canOpenURL(url).then(can => {
      if (can) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`);
      }
    });
  }, [store]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = activeCategory === 'All' ? products : products.filter(p => p.category === activeCategory);
  const verifiedBadge = store?.subscription?.status === 'active' ? store.subscription.badge : 'none';
  const verifiedColor =
    verifiedBadge === 'gold'
      ? '#d4a837'
      : verifiedBadge === 'premium'
        ? '#3b82f6'
        : verifiedBadge === 'standard'
          ? palette.success
          : palette.foregroundSubtle;

  if (loading) {
    return (
      <ThemedSafeScreen>
        <ActivityIndicator color={palette.primary} style={{flex: 1}} />
      </ThemedSafeScreen>
    );
  }

  if (!store) return null;

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={s.bannerWrapper}>
          {store.bannerImage ? (
            <Image source={{uri: store.bannerImage}} style={s.bannerImg} resizeMode="cover" />
          ) : (
            <View style={[s.bannerPlaceholder, {backgroundColor: `${palette.primary}15`}]} />
          )}

          {/* Overlay gradient */}
          <View style={[s.bannerOverlay, {backgroundColor: 'rgba(0,0,0,0.35)'}]} />

          {/* Back btn */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={[s.backBtn, {backgroundColor: 'rgba(0,0,0,0.5)'}]}
            hitSlop={12}>
            <ChevronLeft size={22} color="#fff" />
          </Pressable>

          {/* Favorite btn */}
          <Pressable
            onPress={toggleFavorite}
            disabled={favLoading}
            style={[s.favBtn, {backgroundColor: 'rgba(0,0,0,0.5)'}]}
            hitSlop={12}>
            <Heart
              size={20}
              color={favorited ? '#e94560' : '#fff'}
              fill={favorited ? '#e94560' : 'transparent'}
            />
          </Pressable>

          {/* Profile photo */}
          <View style={[s.avatarOuter, {borderColor: palette.background, backgroundColor: palette.background}]}>
            {store.profilePhoto ? (
              <Image source={{uri: store.profilePhoto}} style={s.avatarImg} />
            ) : (
              <View style={[s.avatarImg, {backgroundColor: `${palette.primary}20`, alignItems: 'center', justifyContent: 'center'}]}>
                <Text style={{color: palette.primary, fontSize: 28, fontWeight: '800'}}>{store.name[0]}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Store name + info */}
        <View style={[s.storeInfoBlock, {borderBottomColor: palette.glassFaint}]}>
          <View style={s.nameLine}>
            <Text style={[s.storeName, {color: palette.foreground}]}>{store.name}</Text>
            {store.hasDelivery && (
              <View style={[s.deliveryTag, {backgroundColor: `${palette.success}20`, borderColor: `${palette.success}40`}]}>
                <Truck size={10} color={palette.success} />
                <Text style={{color: palette.success, fontSize: 9, fontWeight: '800'}}>DELIVERY</Text>
              </View>
            )}
            {verifiedBadge !== 'none' && (
              <View style={[s.deliveryTag, {backgroundColor: `${verifiedColor}20`, borderColor: `${verifiedColor}40`}]}>
                {verifiedBadge === 'gold' ? <Crown size={10} color={verifiedColor} /> : <BadgeCheck size={10} color={verifiedColor} />}
                <Text style={{color: verifiedColor, fontSize: 9, fontWeight: '800', textTransform: 'uppercase'}}>
                  {verifiedBadge}
                </Text>
              </View>
            )}
          </View>
          <Text style={[s.catLabel, {color: palette.primary}]}>{store.category}</Text>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Eye size={13} color={palette.foregroundSubtle} />
              <Text style={[s.statText, {color: palette.foregroundSubtle}]}>{store.totalViews} views</Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Package size={13} color={palette.foregroundSubtle} />
              <Text style={[s.statText, {color: palette.foregroundSubtle}]}>{store.totalProducts} products</Text>
            </View>
            {store.ratingAvg > 0 && (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Star size={13} color={palette.warning} fill={palette.warning} />
                <Text style={[s.statText, {color: palette.foregroundSubtle}]}>{store.ratingAvg.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6}}>
            <MapPin size={13} color={palette.foregroundSubtle} />
            <Text style={[s.addressText, {color: palette.foregroundSubtle}]}>{store.address}, {store.city}</Text>
          </View>

          {store.description ? (
            <Text style={[s.descText, {color: palette.foreground}]}>{store.description}</Text>
          ) : null}

          {/* CTA buttons */}
          <View style={s.ctaRow}>
            <Pressable
              onPress={openDirections}
              style={[s.ctaBtn, {backgroundColor: palette.primary}]}>
              <Navigation size={15} color={palette.primaryForeground} />
              <Text style={[s.ctaBtnText, {color: palette.primaryForeground}]}>Directions</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(`tel:${store.phone}`)}
              style={[s.ctaBtn, {backgroundColor: palette.glassFaint, borderWidth: 1, borderColor: palette.border}]}>
              <Phone size={15} color={palette.foreground} />
              <Text style={[s.ctaBtnText, {color: palette.foreground}]}>Call</Text>
            </Pressable>
            <Pressable
              onPress={toggleFavorite}
              style={[s.ctaBtn, {
                backgroundColor: favorited ? `${palette.accent}20` : palette.glassFaint,
                borderWidth: 1,
                borderColor: favorited ? palette.accent : palette.border,
              }]}>
              <Heart size={15} color={favorited ? palette.accent : palette.foreground} fill={favorited ? palette.accent : 'transparent'} />
              <Text style={[s.ctaBtnText, {color: favorited ? palette.accent : palette.foreground}]}>
                {favorited ? 'Saved' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Category filter */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catScrollContent}>
            {categories.map(cat => {
              const active = activeCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={[
                    s.catPill,
                    {
                      backgroundColor: active ? palette.primary : palette.glassFaint,
                      borderColor: active ? palette.primary : palette.border,
                    },
                  ]}>
                  <Text style={{color: active ? palette.primaryForeground : palette.foreground, fontSize: 12, fontWeight: '700'}}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Products */}
        <View style={s.productsSection}>
          {filtered.length === 0 ? (
            <View style={[s.emptyProducts, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Package size={40} color={palette.foregroundSubtle} />
              <Text style={[s.emptyText, {color: palette.foreground}]}>No products yet</Text>
            </View>
          ) : (
            <View style={s.productGrid}>
              {filtered.map(product => (
                <ProductViewCard key={product._id} product={product} palette={palette} />
              ))}
            </View>
          )}
        </View>

        <View style={{height: 40}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

function ProductViewCard({
  product,
  palette,
}: {
  product: StoreProduct;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  const thumb = product.photos?.[0];
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPct = hasDiscount ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;

  return (
    <View style={[s.productCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
      <View style={[s.productThumb, {backgroundColor: palette.glassMid}]}>
        {thumb ? (
          <Image source={{uri: thumb}} style={s.productThumbImg} resizeMode="cover" />
        ) : (
          <Package size={28} color={palette.foregroundSubtle} />
        )}
        {hasDiscount ? (
          <View style={[s.discountBadge, {backgroundColor: palette.accent}]}>
            <Text style={{color: '#fff', fontSize: 9, fontWeight: '900'}}>{discountPct}% OFF</Text>
          </View>
        ) : null}
        {!product.inStock && (
          <View style={[s.outOfStockOverlay, {backgroundColor: 'rgba(0,0,0,0.65)'}]}>
            <Text style={{color: '#fff', fontSize: 10, fontWeight: '700'}}>Out of Stock</Text>
          </View>
        )}
      </View>
      <View style={s.productInfo}>
        <Text style={[s.productName, {color: palette.foreground}]} numberOfLines={2}>{product.name}</Text>
        <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 4}}>
          <Text style={[s.productPrice, {color: palette.primary}]}>₹{product.price}</Text>
          {hasDiscount && (
            <Text style={[s.origPrice, {color: palette.placeholder}]}>₹{product.originalPrice}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bannerWrapper: {height: 240, position: 'relative'},
  bannerImg: {width: '100%', height: '100%'},
  bannerPlaceholder: {flex: 1},
  bannerOverlay: {position: 'absolute', inset: 0},
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOuter: {
    position: 'absolute',
    bottom: -36,
    left: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarImg: {width: '100%', height: '100%'},
  storeInfoBlock: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameLine: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  storeName: {fontSize: 22, fontWeight: '800', letterSpacing: -0.5},
  deliveryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catLabel: {fontSize: 13, fontWeight: '700', marginTop: 3},
  statsRow: {flexDirection: 'row', gap: 14, marginTop: 6},
  statText: {fontSize: 12},
  addressText: {fontSize: 13, flex: 1},
  descText: {fontSize: 13, lineHeight: 19, marginTop: 8},
  ctaRow: {flexDirection: 'row', gap: 10, marginTop: 16},
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  ctaBtnText: {fontSize: 13, fontWeight: '700'},
  catScrollContent: {paddingHorizontal: 16, paddingVertical: 12, gap: 8},
  catPill: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1},
  productsSection: {paddingHorizontal: 16, paddingTop: 4},
  emptyProducts: {
    alignItems: 'center',
    gap: 8,
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyText: {fontSize: 15, fontWeight: '600'},
  productGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  productCard: {width: '47%', borderRadius: 14, borderWidth: 1, overflow: 'hidden'},
  productThumb: {width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative'},
  productThumbImg: {width: '100%', height: '100%'},
  discountBadge: {position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6},
  outOfStockOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {padding: 10},
  productName: {fontSize: 13, fontWeight: '600', lineHeight: 17},
  productPrice: {fontSize: 15, fontWeight: '800'},
  origPrice: {fontSize: 12, textDecorationLine: 'line-through'},
});
