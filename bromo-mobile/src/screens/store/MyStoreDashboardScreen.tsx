import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  ChevronLeft,
  Plus,
  Package,
  Eye,
  ShoppingBag,
  Truck,
  MapPin,
  Edit3,
  Trash2,
  BarChart2,
  Star,
  Grid3X3,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {getMyStore, listProducts, deleteProduct, type Store, type StoreProduct} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function MyStoreDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  const loadData = useCallback(async () => {
    try {
      const s = await getMyStore();
      setStore(s);
      const p = await listProducts(s._id);
      setProducts(p);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load store');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const handleDeleteProduct = useCallback((product: StoreProduct) => {
    Alert.alert('Delete Product', `Remove "${product.name}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(store!._id, product._id);
            setProducts(prev => prev.filter(p => p._id !== product._id));
          } catch {
            Alert.alert('Error', 'Failed to delete product');
          }
        },
      },
    ]);
  }, [store]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = activeCategory === 'All' ? products : products.filter(p => p.category === activeCategory);

  if (loading) {
    return (
      <ThemedSafeScreen>
        <ActivityIndicator color={palette.primary} style={{flex: 1}} />
      </ThemedSafeScreen>
    );
  }

  if (!store) {
    return (
      <ThemedSafeScreen>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12}}>
          <ShoppingBag size={48} color={palette.foregroundSubtle} />
          <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '700'}}>No store found</Text>
          <Pressable
            onPress={() => navigation.navigate('CreateStore')}
            style={{backgroundColor: palette.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12}}>
            <Text style={{color: palette.primaryForeground, fontWeight: '700'}}>Create Store</Text>
          </Pressable>
        </View>
      </ThemedSafeScreen>
    );
  }

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[s.header, {borderBottomColor: palette.glassFaint}]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={palette.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, {color: palette.foreground}]} numberOfLines={1}>My Store</Text>
        <Pressable
          onPress={() => navigation.navigate('AddProduct', {storeId: store._id})}
          style={[s.addBtn, {backgroundColor: palette.primary}]}>
          <Plus size={16} color={palette.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(); }} tintColor={palette.primary} />}>

        {/* Store Profile Card */}
        <View>
          {/* Banner */}
          <View style={[s.bannerContainer, {backgroundColor: palette.glassMid}]}>
            {store.bannerImage ? (
              <Image source={{uri: store.bannerImage}} style={s.bannerImg} resizeMode="cover" />
            ) : (
              <View style={[s.bannerPlaceholder, {backgroundColor: `${palette.primary}20`}]}>
                <ShoppingBag size={32} color={palette.primary} />
              </View>
            )}
            {/* Profile photo overlay */}
            <View style={[s.avatarRing, {borderColor: palette.background, backgroundColor: palette.background}]}>
              {store.profilePhoto ? (
                <Image source={{uri: store.profilePhoto}} style={s.avatarImg} />
              ) : (
                <View style={[s.avatarImg, {backgroundColor: `${palette.primary}20`, alignItems: 'center', justifyContent: 'center'}]}>
                  <Text style={{color: palette.primary, fontSize: 24, fontWeight: '800'}}>{store.name[0]}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Store info */}
          <View style={s.storeInfo}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Text style={[s.storeName, {color: palette.foreground}]}>{store.name}</Text>
              {store.hasDelivery && (
                <View style={[s.deliveryBadge, {backgroundColor: `${palette.success}20`}]}>
                  <Truck size={10} color={palette.success} />
                  <Text style={{color: palette.success, fontSize: 9, fontWeight: '800'}}>DELIVERY</Text>
                </View>
              )}
            </View>
            <Text style={[s.storeCategory, {color: palette.primary}]}>{store.category}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2}}>
              <MapPin size={12} color={palette.foregroundSubtle} />
              <Text style={[s.storeMeta, {color: palette.foregroundSubtle}]}>{store.city}</Text>
            </View>
            {store.description ? (
              <Text style={[s.storeDesc, {color: palette.foreground}]}>{store.description}</Text>
            ) : null}
          </View>
        </View>

        {/* Analytics row */}
        <View style={[s.analyticsRow, {borderColor: palette.glassMid}]}>
          {[
            {icon: Eye, label: 'Views', value: store.totalViews, color: palette.primary},
            {icon: Package, label: 'Products', value: store.totalProducts, color: palette.accent},
            {icon: Star, label: 'Rating', value: store.ratingAvg > 0 ? store.ratingAvg.toFixed(1) : '—', color: palette.warning},
          ].map(({icon: Icon, label, value, color}) => (
            <View key={label} style={[s.statCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Icon size={18} color={color} />
              <Text style={[s.statValue, {color: palette.foreground}]}>{value}</Text>
              <Text style={[s.statLabel, {color: palette.foregroundSubtle}]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Category filter */}
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

        {/* Products grid */}
        <View style={s.productsSection}>
          <View style={s.productsSectionHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Grid3X3 size={16} color={palette.foreground} />
              <Text style={[s.sectionTitle, {color: palette.foreground}]}>
                {filtered.length} {activeCategory === 'All' ? 'Products' : activeCategory}
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('AddProduct', {storeId: store._id})}
              style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Plus size={14} color={palette.primary} />
              <Text style={{color: palette.primary, fontSize: 13, fontWeight: '700'}}>Add</Text>
            </Pressable>
          </View>

          {filtered.length === 0 ? (
            <Pressable
              onPress={() => navigation.navigate('AddProduct', {storeId: store._id})}
              style={[s.emptyProducts, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Package size={40} color={palette.foregroundSubtle} />
              <Text style={[s.emptyTitle, {color: palette.foreground}]}>No products yet</Text>
              <Text style={[s.emptySub, {color: palette.foregroundSubtle}]}>Tap to add your first product</Text>
            </Pressable>
          ) : (
            <View style={s.productGrid}>
              {filtered.map(product => (
                <ProductCard
                  key={product._id}
                  product={product}
                  palette={palette}
                  onDelete={() => handleDeleteProduct(product)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{height: 32}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

function ProductCard({
  product,
  palette,
  onDelete,
}: {
  product: StoreProduct;
  palette: ReturnType<typeof useTheme>['palette'];
  onDelete: () => void;
}) {
  const thumb = product.photos?.[0];
  return (
    <View style={[s.productCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
      <View style={[s.productThumb, {backgroundColor: palette.glassMid}]}>
        {thumb ? (
          <Image source={{uri: thumb}} style={s.productThumbImg} resizeMode="cover" />
        ) : (
          <Package size={24} color={palette.foregroundSubtle} />
        )}
        {!product.inStock && (
          <View style={[s.outOfStockBadge, {backgroundColor: 'rgba(0,0,0,0.7)'}]}>
            <Text style={{color: '#fff', fontSize: 9, fontWeight: '800'}}>OUT OF STOCK</Text>
          </View>
        )}
      </View>
      <View style={s.productInfo}>
        <Text style={[s.productName, {color: palette.foreground}]} numberOfLines={2}>{product.name}</Text>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4}}>
          <Text style={[s.productPrice, {color: palette.primary}]}>₹{product.price}</Text>
          {product.originalPrice && product.originalPrice > product.price ? (
            <Text style={[s.productOrigPrice, {color: palette.placeholder}]}>₹{product.originalPrice}</Text>
          ) : null}
        </View>
        <Text style={[s.productCat, {color: palette.foregroundSubtle}]}>{product.category}</Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={8} style={s.deleteBtn}>
        <Trash2 size={14} color={palette.accent} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', marginHorizontal: 12},
  addBtn: {width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  bannerContainer: {height: 160, position: 'relative'},
  bannerImg: {width: '100%', height: '100%'},
  bannerPlaceholder: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  avatarRing: {
    position: 'absolute',
    bottom: -32,
    left: 16,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarImg: {width: '100%', height: '100%'},
  storeInfo: {paddingHorizontal: 16, paddingTop: 40, paddingBottom: 16},
  storeName: {fontSize: 20, fontWeight: '800', letterSpacing: -0.3},
  storeCategory: {fontSize: 13, fontWeight: '700', marginTop: 2},
  storeMeta: {fontSize: 12},
  storeDesc: {fontSize: 13, lineHeight: 18, marginTop: 8, color: 'rgba(255,255,255,0.8)'},
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {fontSize: 20, fontWeight: '800'},
  statLabel: {fontSize: 11, fontWeight: '600'},
  catScrollContent: {paddingHorizontal: 16, paddingVertical: 12, gap: 8},
  catPill: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1},
  productsSection: {paddingHorizontal: 16},
  productsSectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12},
  sectionTitle: {fontSize: 15, fontWeight: '700'},
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTitle: {fontSize: 16, fontWeight: '700'},
  emptySub: {fontSize: 13},
  productGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  productCard: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productThumbImg: {width: '100%', height: '100%'},
  outOfStockBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 4,
  },
  productInfo: {padding: 10, paddingBottom: 8},
  productName: {fontSize: 13, fontWeight: '600', lineHeight: 17},
  productPrice: {fontSize: 14, fontWeight: '800'},
  productOrigPrice: {fontSize: 12, textDecorationLine: 'line-through'},
  productCat: {fontSize: 11, marginTop: 2},
  deleteBtn: {position: 'absolute', top: 8, right: 8, zIndex: 2},
});
