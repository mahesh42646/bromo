import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  Settings2,
  ExternalLink,
  Save,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useTheme} from '../../context/ThemeContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {
  STORE_CATEGORIES,
  deleteProduct,
  getMyStore,
  listProducts,
  updateProduct,
  updateStore,
  type Store,
  type StoreCategory,
  type StoreProduct,
} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';
import {openExternalUrl} from '../../lib/openExternalUrl';
import bromoConfig from '../../../bromo-config.json';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Palette = ReturnType<typeof useTheme>['palette'];
type StoreDraft = {
  name: string;
  phone: string;
  city: string;
  address: string;
  description: string;
  category: StoreCategory | '';
  hasDelivery: boolean;
  profilePhotoUri: string;
  bannerImageUri: string;
  removeProfilePhoto: boolean;
  removeBannerImage: boolean;
};
type ProductDraft = {
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  category: string;
  inStock: boolean;
  tags: string;
  photoUris: string[];
  videoUrl: string;
};

const PRODUCT_CATEGORIES = [
  'Clothing', 'Footwear', 'Accessories', 'Electronics', 'Mobiles', 'Laptops',
  'Home Decor', 'Kitchen', 'Furniture', 'Food', 'Beverages', 'Snacks',
  'Skincare', 'Haircare', 'Makeup', 'Sports Equipment', 'Fitness', 'Outdoor',
  'Books', 'Stationery', 'Toys', 'Games', 'Grocery', 'Other',
];

const DEFAULT_STORE_DRAFT: StoreDraft = {
  name: '',
  phone: '',
  city: '',
  address: '',
  description: '',
  category: '',
  hasDelivery: false,
  profilePhotoUri: '',
  bannerImageUri: '',
  removeProfilePhoto: false,
  removeBannerImage: false,
};

const DEFAULT_PRODUCT_DRAFT: ProductDraft = {
  name: '',
  description: '',
  price: '',
  originalPrice: '',
  category: '',
  inStock: true,
  tags: '',
  photoUris: [],
  videoUrl: '',
};

const portalBaseUrl = String(
  (bromoConfig as {portalBaseUrl?: string; webBaseUrl?: string}).portalBaseUrl ??
    (bromoConfig as {webBaseUrl?: string}).webBaseUrl ??
    'http://localhost:3000',
).replace(/\/+$/, '');

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function MyStoreDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [storeEditorVisible, setStoreEditorVisible] = useState(false);
  const [storeDraft, setStoreDraft] = useState<StoreDraft>(DEFAULT_STORE_DRAFT);
  const [savingStore, setSavingStore] = useState(false);
  const [productEditorVisible, setProductEditorVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(DEFAULT_PRODUCT_DRAFT);
  const [savingProduct, setSavingProduct] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const s = await getMyStore();
      setStore(s);
      if (s.approvalStatus === 'approved' && s.isActive) {
        const p = await listProducts(s._id);
        setProducts(p);
      } else {
        setProducts([]);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load store');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const openStoreEditor = useCallback(() => {
    if (!store) return;
    setStoreDraft({
      name: store.name,
      phone: store.phone,
      city: store.city,
      address: store.address,
      description: store.description ?? '',
      category: store.category,
      hasDelivery: store.hasDelivery,
      profilePhotoUri: store.profilePhoto ?? '',
      bannerImageUri: store.bannerImage ?? '',
      removeProfilePhoto: false,
      removeBannerImage: false,
    });
    setStoreEditorVisible(true);
  }, [store]);

  const saveStoreChanges = useCallback(async () => {
    if (!store) return;
    if (!storeDraft.name.trim()) { Alert.alert('Required', 'Store name is required'); return; }
    if (!storeDraft.phone.trim()) { Alert.alert('Required', 'Phone number is required'); return; }
    if (!storeDraft.city.trim()) { Alert.alert('Required', 'City is required'); return; }
    if (!storeDraft.address.trim()) { Alert.alert('Required', 'Address is required'); return; }
    if (!storeDraft.category) { Alert.alert('Required', 'Store category is required'); return; }

    setSavingStore(true);
    try {
      const updated = await updateStore(store._id, {
        name: storeDraft.name.trim(),
        phone: storeDraft.phone.trim(),
        city: storeDraft.city.trim(),
        address: storeDraft.address.trim(),
        description: storeDraft.description.trim(),
        category: storeDraft.category,
        hasDelivery: storeDraft.hasDelivery,
        profilePhotoUri: storeDraft.profilePhotoUri.trim() || undefined,
        bannerImageUri: storeDraft.bannerImageUri.trim() || undefined,
        removeProfilePhoto: storeDraft.removeProfilePhoto,
        removeBannerImage: storeDraft.removeBannerImage,
      });
      setStore(updated);
      setStoreEditorVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update store');
    } finally {
      setSavingStore(false);
    }
  }, [store, storeDraft]);

  const openProductEditor = useCallback((product: StoreProduct) => {
    setEditingProduct(product);
    setProductDraft({
      name: product.name,
      description: product.description ?? '',
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : '',
      category: product.category,
      inStock: product.inStock,
      tags: (product.tags ?? []).join(', '),
      photoUris: product.photos ?? [],
      videoUrl: product.videoUrl ?? '',
    });
    setProductEditorVisible(true);
  }, []);

  const saveProductChanges = useCallback(async () => {
    if (!store || !editingProduct) return;
    const price = Number(productDraft.price);
    const originalPriceInput = productDraft.originalPrice.trim();
    const originalPrice = originalPriceInput ? Number(originalPriceInput) : 0;
    if (!productDraft.name.trim()) { Alert.alert('Required', 'Product name is required'); return; }
    if (!Number.isFinite(price) || price <= 0) { Alert.alert('Required', 'Valid product price is required'); return; }
    if (originalPriceInput && (!Number.isFinite(originalPrice) || originalPrice <= 0)) {
      Alert.alert('Required', 'Original price must be valid');
      return;
    }
    if (!productDraft.category.trim()) { Alert.alert('Required', 'Product category is required'); return; }

    setSavingProduct(true);
    try {
      const updated = await updateProduct(store._id, editingProduct._id, {
        name: productDraft.name.trim(),
        description: productDraft.description.trim(),
        price,
        originalPrice,
        category: productDraft.category.trim(),
        inStock: productDraft.inStock,
        tags: productDraft.tags.trim(),
        photoUris: productDraft.photoUris,
        videoUrl: productDraft.videoUrl.trim(),
        replacePhotos: true,
      });
      setProducts(prev => prev.map(p => (p._id === updated._id ? updated : p)));
      setProductEditorVisible(false);
      setEditingProduct(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update product');
    } finally {
      setSavingProduct(false);
    }
  }, [editingProduct, productDraft, store]);

  const pickStoreImage = useCallback((kind: 'profile' | 'banner') => {
    launchImageLibrary({mediaType: 'photo', quality: 1, selectionLimit: 1}, res => {
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      if (kind === 'profile') {
        setStoreDraft(prev => ({...prev, profilePhotoUri: uri, removeProfilePhoto: false}));
      } else {
        setStoreDraft(prev => ({...prev, bannerImageUri: uri, removeBannerImage: false}));
      }
    });
  }, []);

  const clearStoreImage = useCallback((kind: 'profile' | 'banner') => {
    if (kind === 'profile') {
      setStoreDraft(prev => ({...prev, profilePhotoUri: '', removeProfilePhoto: true}));
    } else {
      setStoreDraft(prev => ({...prev, bannerImageUri: '', removeBannerImage: true}));
    }
  }, []);

  const pickProductPhotos = useCallback(() => {
    const remaining = Math.max(0, 8 - productDraft.photoUris.length);
    if (remaining === 0) {
      Alert.alert('Limit reached', 'Maximum 8 product images');
      return;
    }
    launchImageLibrary({mediaType: 'photo', quality: 1, selectionLimit: remaining}, res => {
      const uris = res.assets?.map(a => a.uri).filter((x): x is string => Boolean(x)) ?? [];
      if (uris.length === 0) return;
      setProductDraft(prev => ({...prev, photoUris: [...prev.photoUris, ...uris].slice(0, 8)}));
    });
  }, [productDraft.photoUris.length]);

  const removeProductPhoto = useCallback((index: number) => {
    setProductDraft(prev => ({...prev, photoUris: prev.photoUris.filter((_, i) => i !== index)}));
  }, []);

  const openWebDashboard = useCallback(() => {
    openExternalUrl(`${portalBaseUrl}/dashboard/store`).catch(() => {
      Alert.alert('Unable to open dashboard', 'Web dashboard could not be opened right now.');
    });
  }, []);

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

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const filtered = useMemo(
    () => (activeCategory === 'All' ? products : products.filter(p => p.category === activeCategory)),
    [activeCategory, products],
  );

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

  const storeLocked = store.approvalStatus !== 'approved' || !store.isActive;
  const openProductCreate = () => {
    if (storeLocked) {
      navigation.navigate('CreateStore');
      return;
    }
    navigation.navigate('AddProduct', {storeId: store._id});
  };

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
          onPress={openProductCreate}
          style={[s.addBtn, {backgroundColor: storeLocked ? palette.warning : palette.primary}]}>
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

        {storeLocked ? (
          <View style={[s.pendingCard, {backgroundColor: `${palette.warning}18`, borderColor: `${palette.warning}55`}]}>
            <View style={[s.pendingIcon, {backgroundColor: `${palette.warning}22`}]}>
              <ShieldCheck size={20} color={palette.warning} />
            </View>
            <View style={{flex: 1}}>
              <Text style={[s.pendingTitle, {color: palette.foreground}]}>
                {store.approvalStatus === 'rejected' ? 'Approval Required' : store.requestPendingLabel || 'Request Pending'}
              </Text>
              <Text style={[s.pendingBody, {color: palette.foregroundSubtle}]}>
                Legacy and new stores stay offline until KYC, terms, and admin approval are complete.
              </Text>
              <Pressable onPress={() => navigation.navigate('CreateStore')} style={[s.pendingBtn, {backgroundColor: palette.primary}]}>
                <Text style={{color: palette.primaryForeground, fontSize: 12, fontWeight: '900'}}>Complete / Resubmit KYC</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={s.quickActions}>
          <QuickAction
            icon={Edit3}
            label="Edit Store"
            sublabel="Profile, address, category"
            palette={palette}
            onPress={openStoreEditor}
          />
          <QuickAction
            icon={Settings2}
            label="Store Settings"
            sublabel="Delivery and category"
            palette={palette}
            onPress={openStoreEditor}
          />
          <QuickAction
            icon={Plus}
            label={storeLocked ? 'KYC Required' : 'Add Product'}
            sublabel={storeLocked ? 'Approval needed before listings' : 'Create new listing'}
            palette={palette}
            onPress={openProductCreate}
          />
          <QuickAction
            icon={ExternalLink}
            label="Web Dashboard"
            sublabel="Open portal"
            palette={palette}
            onPress={openWebDashboard}
          />
        </View>

        {/* Analytics row */}
        <View style={[s.analyticsRow, {borderColor: palette.glassMid}]}>
          {[
            {icon: Eye, label: 'Views', value: compactNumber(store.totalViews), color: palette.primary},
            {icon: Package, label: 'Products', value: compactNumber(products.length), color: palette.accent},
            {icon: Star, label: 'Rating', value: store.ratingAvg > 0 ? store.ratingAvg.toFixed(1) : '—', color: palette.warning},
            {icon: BarChart2, label: 'Reviews', value: compactNumber(store.ratingCount), color: palette.success},
          ].map(({icon: Icon, label, value, color}) => (
            <View key={label} style={[s.statCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Icon size={18} color={color} />
              <Text style={[s.statValue, {color: palette.foreground}]}>{value}</Text>
              <Text style={[s.statLabel, {color: palette.foregroundSubtle}]}>{label}</Text>
            </View>
          ))}
        </View>

        {storeLocked ? (
          <View style={[s.lockedProducts, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
            <Package size={36} color={palette.foregroundSubtle} />
            <Text style={[s.emptyTitle, {color: palette.foreground}]}>Products locked until approval</Text>
            <Text style={[s.emptySub, {color: palette.foregroundSubtle, textAlign: 'center'}]}>
              Your store and listings will not appear publicly until admin approves KYC and plan details.
            </Text>
          </View>
        ) : (
          <>
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
                  onPress={openProductCreate}
                  style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Plus size={14} color={palette.primary} />
                  <Text style={{color: palette.primary, fontSize: 13, fontWeight: '700'}}>Add</Text>
                </Pressable>
              </View>

              {filtered.length === 0 ? (
                <Pressable
                  onPress={openProductCreate}
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
                      onEdit={() => openProductEditor(product)}
                      onDelete={() => handleDeleteProduct(product)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{height: 32}} />
      </ScrollView>

      <StoreEditModal
        visible={storeEditorVisible}
        draft={storeDraft}
        currentProfilePhoto={store?.profilePhoto ?? ''}
        currentBannerImage={store?.bannerImage ?? ''}
        palette={palette}
        saving={savingStore}
        onChange={setStoreDraft}
        onPickImage={pickStoreImage}
        onRemoveImage={clearStoreImage}
        onClose={() => setStoreEditorVisible(false)}
        onSave={saveStoreChanges}
      />

      <ProductEditModal
        visible={productEditorVisible}
        draft={productDraft}
        palette={palette}
        saving={savingProduct}
        onChange={setProductDraft}
        onPickPhotos={pickProductPhotos}
        onRemovePhoto={removeProductPhoto}
        onClose={() => {
          setProductEditorVisible(false);
          setEditingProduct(null);
        }}
        onSave={saveProductChanges}
      />
    </ThemedSafeScreen>
  );
}

function QuickAction({
  icon: Icon,
  label,
  sublabel,
  palette,
  onPress,
}: {
  icon: typeof Edit3;
  label: string;
  sublabel: string;
  palette: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        s.quickActionCard,
        {
          backgroundColor: palette.glassFaint,
          borderColor: palette.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <View style={[s.quickIcon, {backgroundColor: `${palette.primary}18`}]}>
        <Icon size={18} color={palette.primary} />
      </View>
      <View style={s.quickCopy}>
        <Text style={[s.quickLabel, {color: palette.foreground}]}>{label}</Text>
        <Text style={[s.quickSub, {color: palette.foregroundSubtle}]} numberOfLines={1}>{sublabel}</Text>
      </View>
    </Pressable>
  );
}

function ProductCard({
  product,
  palette,
  onEdit,
  onDelete,
}: {
  product: StoreProduct;
  palette: Palette;
  onEdit: () => void;
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
        {product.videoUrl?.trim() ? (
          <View style={[s.videoBadge, {backgroundColor: 'rgba(0,0,0,0.7)'}]}>
            <Text style={{color: '#fff', fontSize: 9, fontWeight: '800'}}>VIDEO</Text>
          </View>
        ) : null}
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
      <Pressable onPress={onEdit} hitSlop={8} style={[s.editBtn, {backgroundColor: palette.background}]}>
        <Edit3 size={14} color={palette.primary} />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} style={s.deleteBtn}>
        <Trash2 size={14} color={palette.accent} />
      </Pressable>
    </View>
  );
}

function StoreEditModal({
  visible,
  draft,
  currentProfilePhoto,
  currentBannerImage,
  palette,
  saving,
  onChange,
  onPickImage,
  onRemoveImage,
  onClose,
  onSave,
}: {
  visible: boolean;
  draft: StoreDraft;
  currentProfilePhoto: string;
  currentBannerImage: string;
  palette: Palette;
  saving: boolean;
  onChange: React.Dispatch<React.SetStateAction<StoreDraft>>;
  onPickImage: (kind: 'profile' | 'banner') => void;
  onRemoveImage: (kind: 'profile' | 'banner') => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedSafeScreen>
        <KeyboardAvoidingView style={s.modalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <EditorHeader title="Edit Store" palette={palette} saving={saving} onClose={onClose} onSave={onSave} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.editorScroll}>
            <Text style={[s.editorLabel, {color: palette.foregroundSubtle}]}>Profile photo</Text>
            <View style={s.mediaRow}>
              <View style={[s.mediaThumb, {borderColor: palette.border, backgroundColor: palette.glassFaint}]}>
                {draft.profilePhotoUri || (!draft.removeProfilePhoto && currentProfilePhoto) ? (
                  <Image
                    source={{uri: draft.profilePhotoUri || currentProfilePhoto}}
                    style={s.mediaThumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.mediaThumbFallback}>
                    <Text style={{color: palette.foregroundSubtle, fontSize: 11}}>No image</Text>
                  </View>
                )}
              </View>
              <View style={s.mediaButtons}>
                <Pressable
                  onPress={() => onPickImage('profile')}
                  style={[s.mediaActionBtn, {borderColor: palette.border, backgroundColor: palette.glassFaint}]}>
                  <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 12}}>Change</Text>
                </Pressable>
                <Pressable
                  onPress={() => onRemoveImage('profile')}
                  style={[s.mediaActionBtn, {borderColor: palette.border, backgroundColor: palette.glassFaint}]}>
                  <Text style={{color: palette.accent, fontWeight: '700', fontSize: 12}}>Remove</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[s.editorLabel, {color: palette.foregroundSubtle}]}>Banner image</Text>
            <View style={s.mediaRow}>
              <View style={[s.mediaThumbWide, {borderColor: palette.border, backgroundColor: palette.glassFaint}]}>
                {draft.bannerImageUri || (!draft.removeBannerImage && currentBannerImage) ? (
                  <Image
                    source={{uri: draft.bannerImageUri || currentBannerImage}}
                    style={s.mediaThumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.mediaThumbFallback}>
                    <Text style={{color: palette.foregroundSubtle, fontSize: 11}}>No image</Text>
                  </View>
                )}
              </View>
              <View style={s.mediaButtons}>
                <Pressable
                  onPress={() => onPickImage('banner')}
                  style={[s.mediaActionBtn, {borderColor: palette.border, backgroundColor: palette.glassFaint}]}>
                  <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 12}}>Change</Text>
                </Pressable>
                <Pressable
                  onPress={() => onRemoveImage('banner')}
                  style={[s.mediaActionBtn, {borderColor: palette.border, backgroundColor: palette.glassFaint}]}>
                  <Text style={{color: palette.accent, fontWeight: '700', fontSize: 12}}>Remove</Text>
                </Pressable>
              </View>
            </View>

            <EditorField label="Store Name" value={draft.name} palette={palette} onChangeText={name => onChange(prev => ({...prev, name}))} />
            <EditorField label="Phone" value={draft.phone} palette={palette} keyboardType="phone-pad" onChangeText={phone => onChange(prev => ({...prev, phone}))} />
            <EditorField label="City" value={draft.city} palette={palette} onChangeText={city => onChange(prev => ({...prev, city}))} />
            <EditorField
              label="Address"
              value={draft.address}
              palette={palette}
              multiline
              onChangeText={address => onChange(prev => ({...prev, address}))}
            />
            <EditorField
              label="Description"
              value={draft.description}
              palette={palette}
              multiline
              onChangeText={description => onChange(prev => ({...prev, description}))}
            />

            <Text style={[s.editorLabel, {color: palette.foregroundSubtle}]}>Category</Text>
            <View style={s.editorChipGrid}>
              {STORE_CATEGORIES.map(cat => {
                const selected = draft.category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => onChange(prev => ({...prev, category: cat}))}
                    style={[
                      s.editorChip,
                      {
                        backgroundColor: selected ? palette.primary : palette.glassFaint,
                        borderColor: selected ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={{color: selected ? palette.primaryForeground : palette.foreground, fontSize: 12, fontWeight: '700'}}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[s.editorToggle, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <View style={s.editorToggleCopy}>
                <Text style={[s.editorToggleTitle, {color: palette.foreground}]}>Home Delivery</Text>
                <Text style={[s.editorToggleSub, {color: palette.foregroundSubtle}]}>Show delivery availability on your store.</Text>
              </View>
              <Switch
                value={draft.hasDelivery}
                onValueChange={hasDelivery => onChange(prev => ({...prev, hasDelivery}))}
                trackColor={{false: palette.glassMid, true: `${palette.primary}80`}}
                thumbColor={draft.hasDelivery ? palette.primary : palette.foregroundSubtle}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedSafeScreen>
    </Modal>
  );
}

function ProductEditModal({
  visible,
  draft,
  palette,
  saving,
  onChange,
  onPickPhotos,
  onRemovePhoto,
  onClose,
  onSave,
}: {
  visible: boolean;
  draft: ProductDraft;
  palette: Palette;
  saving: boolean;
  onChange: React.Dispatch<React.SetStateAction<ProductDraft>>;
  onPickPhotos: () => void;
  onRemovePhoto: (index: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedSafeScreen>
        <KeyboardAvoidingView style={s.modalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <EditorHeader title="Edit Product" palette={palette} saving={saving} onClose={onClose} onSave={onSave} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.editorScroll}>
            <Text style={[s.editorLabel, {color: palette.foregroundSubtle}]}>Product images</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
              {draft.photoUris.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={[s.photoThumb, {borderColor: palette.border}]}>
                  <Image source={{uri}} style={s.photoImg} resizeMode="cover" />
                  <Pressable onPress={() => onRemovePhoto(idx)} style={[s.photoRemove, {backgroundColor: 'rgba(0,0,0,0.65)'}]}>
                    <X size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {draft.photoUris.length < 8 ? (
                <Pressable
                  onPress={onPickPhotos}
                  style={[s.addPhotoBtn, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                  <Plus size={22} color={palette.foregroundSubtle} />
                  <Text style={{color: palette.foregroundSubtle, fontSize: 11, marginTop: 4}}>Add image</Text>
                </Pressable>
              ) : null}
            </ScrollView>

            <EditorField label="Product Name" value={draft.name} palette={palette} onChangeText={name => onChange(prev => ({...prev, name}))} />
            <EditorField
              label="Description"
              value={draft.description}
              palette={palette}
              multiline
              onChangeText={description => onChange(prev => ({...prev, description}))}
            />
            <EditorField label="Price" value={draft.price} palette={palette} keyboardType="numeric" onChangeText={price => onChange(prev => ({...prev, price}))} />
            <EditorField
              label="Original Price"
              value={draft.originalPrice}
              palette={palette}
              keyboardType="numeric"
              onChangeText={originalPrice => onChange(prev => ({...prev, originalPrice}))}
            />

            <Text style={[s.editorLabel, {color: palette.foregroundSubtle}]}>Category</Text>
            <View style={s.editorChipGrid}>
              {PRODUCT_CATEGORIES.map(cat => {
                const selected = draft.category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => onChange(prev => ({...prev, category: cat}))}
                    style={[
                      s.editorChip,
                      {
                        backgroundColor: selected ? palette.primary : palette.glassFaint,
                        borderColor: selected ? palette.primary : palette.border,
                      },
                    ]}>
                    <Text style={{color: selected ? palette.primaryForeground : palette.foreground, fontSize: 12, fontWeight: '700'}}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <EditorField label="Tags" value={draft.tags} palette={palette} onChangeText={tags => onChange(prev => ({...prev, tags}))} />
            <EditorField
              label="Product video URL"
              value={draft.videoUrl}
              palette={palette}
              onChangeText={videoUrl => onChange(prev => ({...prev, videoUrl}))}
            />
            <View style={[s.editorToggle, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <View style={s.editorToggleCopy}>
                <Text style={[s.editorToggleTitle, {color: palette.foreground}]}>In Stock</Text>
                <Text style={[s.editorToggleSub, {color: palette.foregroundSubtle}]}>Customers can see this item as available.</Text>
              </View>
              <Switch
                value={draft.inStock}
                onValueChange={inStock => onChange(prev => ({...prev, inStock}))}
                trackColor={{false: palette.glassMid, true: `${palette.success}80`}}
                thumbColor={draft.inStock ? palette.success : palette.foregroundSubtle}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedSafeScreen>
    </Modal>
  );
}

function EditorHeader({
  title,
  palette,
  saving,
  onClose,
  onSave,
}: {
  title: string;
  palette: Palette;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <View style={[s.editorHeader, {borderBottomColor: palette.border}]}>
      <Pressable onPress={onClose} disabled={saving} style={[s.editorIconBtn, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
        <X size={18} color={palette.foreground} />
      </Pressable>
      <Text style={[s.editorTitle, {color: palette.foreground}]}>{title}</Text>
      <Pressable onPress={onSave} disabled={saving} style={[s.editorSaveBtn, {backgroundColor: palette.primary}]}>
        {saving ? (
          <ActivityIndicator size="small" color={palette.primaryForeground} />
        ) : (
          <>
            <Save size={15} color={palette.primaryForeground} />
            <Text style={{color: palette.primaryForeground, fontSize: 13, fontWeight: '800'}}>Save</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function EditorField({
  label,
  value,
  palette,
  multiline,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  palette: Palette;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={s.editorField}>
      <Text style={[s.editorLabel, {color: palette.foregroundSubtle}]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={palette.placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          s.editorInput,
          multiline ? s.editorTextarea : null,
          {color: palette.foreground, backgroundColor: palette.glassFaint, borderColor: palette.border},
        ]}
      />
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
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quickActionCard: {
    width: '48%',
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCopy: {flex: 1, minWidth: 0},
  quickLabel: {fontSize: 13, fontWeight: '800'},
  quickSub: {fontSize: 11, marginTop: 2},
  pendingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  pendingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {fontSize: 15, fontWeight: '900'},
  pendingBody: {fontSize: 12, lineHeight: 17, marginTop: 3},
  pendingBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 8,
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
  lockedProducts: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
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
  videoBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  productInfo: {padding: 10, paddingBottom: 8},
  productName: {fontSize: 13, fontWeight: '600', lineHeight: 17},
  productPrice: {fontSize: 14, fontWeight: '800'},
  productOrigPrice: {fontSize: 12, textDecorationLine: 'line-through'},
  productCat: {fontSize: 11, marginTop: 2},
  editBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {position: 'absolute', top: 8, right: 8, zIndex: 2},
  modalFlex: {flex: 1},
  editorHeader: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editorIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorTitle: {flex: 1, fontSize: 17, fontWeight: '800'},
  editorSaveBtn: {
    minWidth: 82,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editorScroll: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28},
  mediaRow: {flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'center'},
  mediaThumb: {width: 86, height: 86, borderRadius: 12, borderWidth: 1, overflow: 'hidden'},
  mediaThumbWide: {flex: 1, height: 86, borderRadius: 12, borderWidth: 1, overflow: 'hidden'},
  mediaThumbImage: {width: '100%', height: '100%'},
  mediaThumbFallback: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  mediaButtons: {gap: 8, minWidth: 86},
  mediaActionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorField: {marginBottom: 12},
  editorLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  editorInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  editorTextarea: {
    minHeight: 82,
    textAlignVertical: 'top',
    paddingTop: 11,
  },
  editorChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  editorChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editorToggle: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  editorToggleCopy: {flex: 1},
  editorToggleTitle: {fontSize: 14, fontWeight: '800'},
  editorToggleSub: {fontSize: 12, marginTop: 2},
  photoRow: {gap: 8, paddingBottom: 4, marginBottom: 12},
  photoThumb: {
    width: 86,
    height: 86,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  photoImg: {width: '100%', height: '100%'},
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 86,
    height: 86,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
