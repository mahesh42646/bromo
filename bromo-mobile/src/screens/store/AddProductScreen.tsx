import React, {useState, useCallback} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {launchImageLibrary} from 'react-native-image-picker';
import {ChevronLeft, Plus, X, Check, Package} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {createProduct, STORE_CATEGORIES} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'AddProduct'>;

const PRODUCT_CATEGORIES = [
  'Clothing', 'Footwear', 'Accessories', 'Electronics', 'Mobiles', 'Laptops',
  'Home Decor', 'Kitchen', 'Furniture', 'Food', 'Beverages', 'Snacks',
  'Skincare', 'Haircare', 'Makeup', 'Sports Equipment', 'Fitness', 'Outdoor',
  'Books', 'Stationery', 'Toys', 'Games', 'Grocery', 'Other',
];

export function AddProductScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {palette} = useTheme();
  const {storeId} = route.params;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [category, setCategory] = useState('');
  const [inStock, setInStock] = useState(true);
  const [tags, setTags] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickPhotos = useCallback(() => {
    const remaining = 6 - photoUris.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', 'Maximum 6 photos per product');
      return;
    }
    launchImageLibrary({mediaType: 'photo', quality: 1, selectionLimit: remaining}, res => {
      const uris = res.assets?.map(a => a.uri!).filter(Boolean) ?? [];
      setPhotoUris(prev => [...prev, ...uris].slice(0, 6));
    });
  }, [photoUris.length]);

  const removePhoto = useCallback((idx: number) => {
    setPhotoUris(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {Alert.alert('Required', 'Product name is required'); return;}
    if (!price || isNaN(parseFloat(price))) {Alert.alert('Required', 'Valid price is required'); return;}
    if (!category) {Alert.alert('Required', 'Please select a category'); return;}

    setSubmitting(true);
    try {
      await createProduct(storeId, {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        category,
        inStock,
        tags: tags.trim() || undefined,
        photoUris,
      });
      Alert.alert('Product Added!', `"${name}" is now in your store.`, [
        {text: 'Add Another', onPress: () => navigation.replace('AddProduct', {storeId})},
        {text: 'Go to Store', onPress: () => navigation.goBack()},
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  }, [name, description, price, originalPrice, category, inStock, tags, photoUris, storeId, navigation]);

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[s.header, {borderBottomColor: palette.glassFaint}]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={palette.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, {color: palette.foreground}]}>Add Product</Text>
        <View style={{width: 22}} />
      </View>

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>

          {/* Photos */}
          <FieldLabel label="Product Photos (up to 6)" palette={palette} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
            {photoUris.map((uri, idx) => (
              <View key={uri} style={[s.photoThumb, {borderColor: palette.border}]}>
                <Image source={{uri}} style={s.photoImg} resizeMode="cover" />
                <Pressable
                  onPress={() => removePhoto(idx)}
                  style={[s.photoRemove, {backgroundColor: 'rgba(0,0,0,0.6)'}]}>
                  <X size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photoUris.length < 6 && (
              <Pressable
                onPress={pickPhotos}
                style={[s.addPhotoBtn, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                <Plus size={24} color={palette.foregroundSubtle} />
                <Text style={{color: palette.foregroundSubtle, fontSize: 11, marginTop: 4}}>Add Photo</Text>
              </Pressable>
            )}
          </ScrollView>

          {/* Name */}
          <FieldLabel label="Product Name *" palette={palette} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Classic White Sneakers"
            placeholderTextColor={palette.placeholder}
            style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
          />

          {/* Description */}
          <FieldLabel label="Description" palette={palette} />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the product..."
            placeholderTextColor={palette.placeholder}
            multiline
            numberOfLines={4}
            style={[s.input, s.textarea, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
          />

          {/* Price row */}
          <View style={{flexDirection: 'row', gap: 12}}>
            <View style={{flex: 1}}>
              <FieldLabel label="Price (₹) *" palette={palette} />
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={palette.placeholder}
                keyboardType="numeric"
                style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
              />
            </View>
            <View style={{flex: 1}}>
              <FieldLabel label="Original Price (₹)" palette={palette} />
              <TextInput
                value={originalPrice}
                onChangeText={setOriginalPrice}
                placeholder="Optional"
                placeholderTextColor={palette.placeholder}
                keyboardType="numeric"
                style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
              />
            </View>
          </View>

          {/* Category */}
          <FieldLabel label="Category *" palette={palette} />
          <View style={s.categoryGrid}>
            {PRODUCT_CATEGORIES.map(cat => {
              const selected = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    s.catChip,
                    {
                      backgroundColor: selected ? palette.primary : palette.glassFaint,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}>
                  {selected && <Check size={10} color={palette.primaryForeground} />}
                  <Text style={{color: selected ? palette.primaryForeground : palette.foreground, fontSize: 12, fontWeight: '600'}}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tags */}
          <FieldLabel label="Tags (comma separated)" palette={palette} />
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="e.g. casual, summer, unisex"
            placeholderTextColor={palette.placeholder}
            style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
          />

          {/* In stock */}
          <View style={[s.toggleRow, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
            <View style={{flex: 1}}>
              <Text style={[s.toggleLabel, {color: palette.foreground}]}>In Stock</Text>
              <Text style={{color: palette.foregroundSubtle, fontSize: 12, marginTop: 1}}>Is this product available?</Text>
            </View>
            <Switch
              value={inStock}
              onValueChange={setInStock}
              trackColor={{false: palette.glassMid, true: `${palette.success}80`}}
              thumbColor={inStock ? palette.success : palette.foregroundSubtle}
            />
          </View>

          <View style={{height: 24}} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom submit */}
      <View style={[s.bottomBar, {borderTopColor: palette.glassFaint, backgroundColor: palette.background}]}>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[s.submitBtn, {backgroundColor: submitting ? `${palette.primary}80` : palette.primary}]}>
          {submitting ? (
            <ActivityIndicator size="small" color={palette.primaryForeground} />
          ) : (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Package size={16} color={palette.primaryForeground} />
              <Text style={{color: palette.primaryForeground, fontSize: 16, fontWeight: '800'}}>Add Product</Text>
            </View>
          )}
        </Pressable>
      </View>
    </ThemedSafeScreen>
  );
}

function FieldLabel({label, palette}: {label: string; palette: ReturnType<typeof useTheme>['palette']}) {
  return (
    <Text style={[s.fieldLabel, {color: palette.foregroundSubtle}]}>{label}</Text>
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
  headerTitle: {fontSize: 17, fontWeight: '700'},
  scroll: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32},
  fieldLabel: {fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 16},
  input: {borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15},
  textarea: {height: 88, textAlignVertical: 'top', paddingTop: 12},
  photoRow: {gap: 8, paddingBottom: 4},
  photoThumb: {
    width: 90,
    height: 90,
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
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4},
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  toggleLabel: {fontSize: 14, fontWeight: '700'},
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn: {height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
});
