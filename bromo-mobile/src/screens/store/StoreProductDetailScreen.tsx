import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Dimensions, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {ExternalLink, Package} from 'lucide-react-native';
import {Screen} from '../../components/ui';
import {useTheme} from '../../context/ThemeContext';
import {getStore, listProducts, type Store, type StoreProduct} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Route = RouteProp<AppStackParamList, 'StoreProductDetail'>;

export function StoreProductDetailScreen() {
  const width = Dimensions.get('window').width;
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {storeId, productId} = route.params;

  const [store, setStore] = useState<Store | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [s, products] = await Promise.all([getStore(storeId), listProducts(storeId)]);
        setStore(s);
        setProduct(products.find(p => p._id === productId) ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId, storeId]);

  const photos = useMemo(() => product?.photos ?? [], [product?.photos]);
  const selectedPhoto = photos[selectedPhotoIndex] ?? photos[0] ?? '';
  const hasDiscount = Boolean(product?.originalPrice && product.originalPrice > product.price);
  const discountPercent =
    hasDiscount && product?.originalPrice
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  if (loading) {
    return (
      <Screen title="Product details">
        <ActivityIndicator color={palette.primary} style={{flex: 1}} />
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen title="Product details">
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10}}>
          <Package size={40} color={palette.foregroundSubtle} />
          <Text style={{color: palette.foreground, fontWeight: '700'}}>Product not found</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Product details" scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 32}}>
        <View style={[s.heroWrap, {backgroundColor: palette.glassFaint}]}>
          {selectedPhoto ? (
            <Image source={{uri: selectedPhoto}} style={[s.hero, {width}]} resizeMode="cover" />
          ) : (
            <View style={[s.hero, {width}, s.heroFallback]}>
              <Package size={42} color={palette.foregroundSubtle} />
            </View>
          )}
          {hasDiscount ? (
            <View style={[s.discountPill, {backgroundColor: palette.accent}]}>
              <Text style={s.discountPillText}>{discountPercent}% OFF</Text>
            </View>
          ) : null}
        </View>

        {photos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbRow}>
            {photos.map((uri, idx) => {
              const active = idx === selectedPhotoIndex;
              return (
                <Pressable
                  key={`${uri}-${idx}`}
                  onPress={() => setSelectedPhotoIndex(idx)}
                  style={[
                    s.thumbOuter,
                    {
                      borderColor: active ? palette.primary : palette.border,
                      backgroundColor: palette.glassFaint,
                    },
                  ]}>
                  <Image source={{uri}} style={s.thumbImg} resizeMode="cover" />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={{paddingHorizontal: 16, paddingTop: 14}}>
          <Text style={{color: palette.foreground, fontSize: 23, fontWeight: '800'}}>{product.name}</Text>

          <View style={s.priceRow}>
            <Text style={{color: palette.primary, fontSize: 26, fontWeight: '900'}}>₹{product.price}</Text>
            {hasDiscount && product.originalPrice ? (
              <Text style={{color: palette.foregroundSubtle, textDecorationLine: 'line-through', fontSize: 16}}>
                ₹{product.originalPrice}
              </Text>
            ) : null}
          </View>

          <View style={s.metaGrid}>
            <View style={[s.metaItem, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Text style={[s.metaLabel, {color: palette.foregroundSubtle}]}>Category</Text>
              <Text style={[s.metaValue, {color: palette.foreground}]}>{product.category}</Text>
            </View>
            <View style={[s.metaItem, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Text style={[s.metaLabel, {color: palette.foregroundSubtle}]}>Stock</Text>
              <Text style={[s.metaValue, {color: product.inStock ? palette.success : palette.accent}]}>
                {product.inStock ? 'In stock' : 'Out of stock'}
              </Text>
            </View>
          </View>

          {store ? (
            <View style={[s.sellerCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Text style={[s.metaLabel, {color: palette.foregroundSubtle}]}>Seller</Text>
              <Text style={[s.metaValue, {color: palette.foreground}]}>{store.name}</Text>
              <Text style={{color: palette.foregroundSubtle, marginTop: 2}}>{store.city}</Text>
            </View>
          ) : null}

          {product.description ? (
            <View style={[s.detailsCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <Text style={[s.detailsTitle, {color: palette.foreground}]}>Product Details</Text>
              <Text style={{color: palette.foreground, marginTop: 8, lineHeight: 21}}>{product.description}</Text>
            </View>
          ) : null}

          {product.videoUrl?.trim() ? (
            <Pressable
              onPress={() => Linking.openURL(product.videoUrl!.trim()).catch(() => undefined)}
              style={[s.videoBtn, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
              <ExternalLink size={14} color={palette.primary} />
              <Text style={{color: palette.primary, fontWeight: '700'}}>Open product video</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroWrap: {position: 'relative'},
  hero: {height: 360},
  heroFallback: {alignItems: 'center', justifyContent: 'center'},
  discountPill: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  discountPillText: {color: '#fff', fontWeight: '900', fontSize: 11},
  thumbRow: {paddingHorizontal: 12, paddingVertical: 10, gap: 8},
  thumbOuter: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbImg: {width: '100%', height: '100%'},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8},
  metaGrid: {flexDirection: 'row', gap: 10, marginTop: 12},
  metaItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaLabel: {fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4},
  metaValue: {fontSize: 14, fontWeight: '700', marginTop: 4},
  sellerCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailsCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  detailsTitle: {fontSize: 15, fontWeight: '800'},
  videoBtn: {
    marginTop: 16,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
