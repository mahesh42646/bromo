import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Check, ChevronLeft, Search, ShoppingBag, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {listProducts, type AffiliateProduct} from '../../api/productsApi';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList>;

const MAX_PICK = 6;

export function ProductPickerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {draft, setProducts} = useCreateDraft();
  const [items, setItems] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickedIds = new Set(draft.products.map((p) => p.id));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const {items: list} = await listProducts(query.trim() || undefined);
      setItems(list);
      setLoading(false);
    }, 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const toggle = useCallback(
    (p: AffiliateProduct) => {
      const exists = draft.products.find((x) => x.id === p._id);
      if (exists) {
        setProducts(draft.products.filter((x) => x.id !== p._id));
        return;
      }
      if (draft.products.length >= MAX_PICK) return;
      setProducts([
        ...draft.products,
        {
          id: p._id,
          name: p.title,
          priceLabel: `${p.currency} ${p.price.toLocaleString()}`,
          imageUri: p.imageUrl,
          productUrl: p.productUrl,
        },
      ]);
    },
    [draft.products, setProducts],
  );

  return (
    <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={[styles.title, {color: palette.foreground}]}>
          Products ({draft.products.length}/{MAX_PICK})
        </Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={[styles.doneBtn, {color: palette.accent}]}>Done</Text>
        </Pressable>
      </View>

      <View style={[styles.searchBox, {backgroundColor: palette.card, borderColor: palette.border}]}>
        <Search size={18} color={palette.foregroundMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products"
          placeholderTextColor={palette.foregroundSubtle}
          style={[styles.input, {color: palette.foreground}]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <X size={16} color={palette.foregroundMuted} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={palette.foreground} style={{marginTop: 24}} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p._id}
          numColumns={2}
          contentContainerStyle={{paddingHorizontal: 8, paddingBottom: 24}}
          ListEmptyComponent={
            <View style={{padding: 30, alignItems: 'center'}}>
              <ShoppingBag size={32} color={palette.foregroundSubtle} />
              <Text style={{color: palette.foregroundSubtle, marginTop: 8}}>No products yet</Text>
            </View>
          }
          renderItem={({item}) => {
            const selected = pickedIds.has(item._id);
            const disabled = !selected && draft.products.length >= MAX_PICK;
            return (
              <Pressable
                onPress={() => toggle(item)}
                disabled={disabled}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: selected ? palette.accent : palette.border,
                    opacity: disabled ? 0.45 : 1,
                  },
                ]}>
                <Image source={{uri: item.imageUrl}} style={styles.img} />
                {selected && (
                  <View style={[styles.selectTick, {backgroundColor: palette.accent}]}>
                    <Check size={14} color={palette.accentForeground ?? '#fff'} />
                  </View>
                )}
                <View style={{padding: 8}}>
                  <Text style={[styles.prodTitle, {color: palette.foreground}]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.prodMeta, {color: palette.foregroundSubtle}]} numberOfLines={1}>
                    {item.brand || item.category}
                  </Text>
                  <Text style={[styles.price, {color: palette.primary}]}>
                    {item.currency} {item.price.toLocaleString()}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </ThemedSafeScreen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {fontSize: 17, fontWeight: '700'},
  doneBtn: {fontSize: 14, fontWeight: '700'},
  searchBox: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  input: {flex: 1, paddingVertical: 8, fontSize: 14},
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  img: {width: '100%', aspectRatio: 1, backgroundColor: '#222'},
  selectTick: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodTitle: {fontSize: 13, fontWeight: '700'},
  prodMeta: {fontSize: 11, marginTop: 2},
  price: {fontSize: 13, fontWeight: '800', marginTop: 4},
});
