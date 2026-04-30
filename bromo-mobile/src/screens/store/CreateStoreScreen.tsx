import React, {useCallback, useEffect, useState} from 'react';
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
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';
import {
  ChevronLeft,
  MapPin,
  Camera,
  Image as ImageIcon,
  Truck,
  Store,
  ChevronDown,
  Navigation,
  Check,
  BadgePercent,
  Building2,
  FileText,
  ShieldCheck,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {STORE_CATEGORIES, createStore, getMyStore, updateStore, type Store as StoreRecord, type StoreCategory} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STEPS = ['Basic Info', 'Location', 'Photos', 'Category', 'KYC'] as const;

type StoreKind = 'd2c' | 'b2b' | 'online';

const STORE_TYPES: {id: StoreKind; title: string; body: string}[] = [
  {id: 'd2c', title: 'D2C Discount Store', body: 'Coin-based customer offers and QR redemption'},
  {id: 'b2b', title: 'B2B Wholesale Store', body: 'Bulk inquiry leads with no coin discount system'},
  {id: 'online', title: 'Online Selling Store', body: 'Product discovery with external checkout links'},
];

export function CreateStoreScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {refreshDbUser} = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [existingStore, setExistingStore] = useState<StoreRecord | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [category, setCategory] = useState<StoreCategory | ''>('');
  const [description, setDescription] = useState('');
  const [storeType, setStoreType] = useState<StoreKind>('d2c');
  const [gstNumber, setGstNumber] = useState('');
  const [shopActLicense, setShopActLicense] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [panCardUri, setPanCardUri] = useState<string | null>(null);
  const [aadhaarCardUri, setAadhaarCardUri] = useState<string | null>(null);
  const [addressProofUri, setAddressProofUri] = useState<string | null>(null);
  const [storePhotoUris, setStorePhotoUris] = useState<string[]>([]);
  const [coinsRequired, setCoinsRequired] = useState('1500');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [minOrderInr, setMinOrderInr] = useState('0');
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [bannerImageUri, setBannerImageUri] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyStore()
      .then(store => {
        if (!alive) return;
        setExistingStore(store);
        setName(store.name ?? '');
        setPhone(store.phone ?? '');
        setCity(store.city ?? '');
        setAddress(store.address ?? '');
        setLng(store.location?.coordinates?.[0] ?? null);
        setLat(store.location?.coordinates?.[1] ?? null);
        setHasDelivery(Boolean(store.hasDelivery));
        setCategory(store.category ?? '');
        setDescription(store.description ?? '');
        setStoreType(store.storeType ?? 'd2c');
        setGstNumber(store.kyc?.gstNumber ?? '');
        setShopActLicense(store.kyc?.shopActLicense ?? '');
        setAcceptedTerms(Boolean(store.termsPdfUrl || store.termsAcceptedAt));
        setPanCardUri(store.kyc?.panCardUrl || null);
        setAadhaarCardUri(store.kyc?.aadhaarCardUrl || null);
        setAddressProofUri(store.kyc?.addressProofUrl || null);
        setStorePhotoUris(store.kyc?.storePhotoUrls ?? []);
        setCoinsRequired(String(store.coinDiscountRule?.coinsRequired || 1500));
        setDiscountPercent(String(store.coinDiscountRule?.discountPercent || 10));
        setMinOrderInr(String(store.coinDiscountRule?.minOrderInr || 0));
        setProfilePhotoUri(store.profilePhoto || null);
        setBannerImageUri(store.bannerImage || null);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  const detectLocation = useCallback(() => {
    setLocating(true);
    Geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      err => {
        setLocating(false);
        Alert.alert('Location Error', err.message || 'Could not get location');
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  }, []);

  const pickImage = useCallback((type: 'profile' | 'banner' | 'pan' | 'aadhaar' | 'address' | 'storePhotos') => {
    launchImageLibrary({mediaType: 'photo', quality: 1, selectionLimit: type === 'storePhotos' ? 6 : 1}, res => {
      const assets = res.assets?.filter(a => Boolean(a.uri)) ?? [];
      const asset = assets[0];
      if (!asset?.uri) return;
      if (type === 'profile') setProfilePhotoUri(asset.uri);
      else if (type === 'banner') setBannerImageUri(asset.uri);
      else if (type === 'pan') setPanCardUri(asset.uri);
      else if (type === 'aadhaar') setAadhaarCardUri(asset.uri);
      else if (type === 'address') setAddressProofUri(asset.uri);
      else setStorePhotoUris(prev => [...prev, ...assets.map(a => a.uri!).slice(0, 6 - prev.length)]);
    });
  }, []);

  const validateStep = useCallback((): boolean => {
    if (step === 0) {
      if (!name.trim()) {Alert.alert('Required', 'Store name is required'); return false;}
      if (!phone.trim()) {Alert.alert('Required', 'Phone number is required'); return false;}
      if (!city.trim()) {Alert.alert('Required', 'City is required'); return false;}
      if (!address.trim()) {Alert.alert('Required', 'Address is required'); return false;}
    }
    if (step === 1) {
      if (lat == null || lng == null) {Alert.alert('Required', 'Please detect your location'); return false;}
    }
    if (step === 3) {
      if (!category) {Alert.alert('Required', 'Please select a category'); return false;}
    }
    if (step === 4) {
      if (!gstNumber.trim() && !shopActLicense.trim()) {Alert.alert('Required', 'Enter GST number or Shop Act license'); return false;}
      if (!panCardUri) {Alert.alert('Required', 'Upload PAN card'); return false;}
      if (!aadhaarCardUri) {Alert.alert('Required', 'Upload Aadhaar card'); return false;}
      if (!addressProofUri) {Alert.alert('Required', 'Upload address proof'); return false;}
      if (storePhotoUris.length === 0) {Alert.alert('Required', 'Upload at least one store photo'); return false;}
      if (!acceptedTerms) {Alert.alert('Required', 'Accept Terms & Conditions to continue'); return false;}
      if (storeType === 'd2c') {
        const coins = Number(coinsRequired);
        const discount = Number(discountPercent);
        if (!Number.isFinite(coins) || coins <= 0) {Alert.alert('Required', 'Enter valid coins required'); return false;}
        if (!Number.isFinite(discount) || discount <= 0) {Alert.alert('Required', 'Enter valid discount percent'); return false;}
      }
    }
    return true;
  }, [step, name, phone, city, address, lat, lng, category, gstNumber, shopActLicense, panCardUri, aadhaarCardUri, addressProofUri, storePhotoUris.length, acceptedTerms, storeType, coinsRequired, discountPercent]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }, [step, validateStep]);

  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;
    if (!category) return;
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
        lat: lat!,
        lng: lng!,
        hasDelivery,
        category: category as StoreCategory,
        description: description.trim(),
        profilePhotoUri: profilePhotoUri ?? undefined,
        bannerImageUri: bannerImageUri ?? undefined,
        storeType,
        gstNumber: gstNumber.trim() || undefined,
        shopActLicense: shopActLicense.trim() || undefined,
        acceptedTerms,
        panCardUri: panCardUri ?? undefined,
        aadhaarCardUri: aadhaarCardUri ?? undefined,
        addressProofUri: addressProofUri ?? undefined,
        storePhotoUris,
        coinsRequired: storeType === 'd2c' ? Number(coinsRequired) : undefined,
        discountPercent: storeType === 'd2c' ? Number(discountPercent) : undefined,
        minOrderInr: storeType === 'd2c' ? Number(minOrderInr || '0') : undefined,
      };
      if (existingStore) {
        await updateStore(existingStore._id, payload);
      } else {
        await createStore(payload);
      }
      await refreshDbUser();
      Alert.alert('Request Pending', 'Your store registration is submitted for admin approval.', [
        {text: 'Manage Store', onPress: () => navigation.replace('ManageStore')},
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  }, [validateStep, category, name, phone, city, address, lat, lng, hasDelivery, description, profilePhotoUri, bannerImageUri, storeType, gstNumber, shopActLicense, acceptedTerms, panCardUri, aadhaarCardUri, addressProofUri, storePhotoUris, coinsRequired, discountPercent, minOrderInr, existingStore, refreshDbUser, navigation]);

  const mapPreviewUrl =
    lat != null && lng != null
      ? `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${lng},${lat}&z=14&size=650,300&l=map&pt=${lng},${lat},pm2rdm`
      : null;

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[s.header, {borderBottomColor: palette.glassFaint}]}>
        <Pressable onPress={() => (step > 0 ? setStep(s => s - 1) : navigation.goBack())} hitSlop={12}>
          <ChevronLeft size={22} color={palette.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, {color: palette.foreground}]}>
          {existingStore ? 'Store KYC' : 'Create Store'}
        </Text>
        <View style={{width: 22}} />
      </View>

      {/* Step dots */}
      <View style={s.stepRow}>
        {STEPS.map((label, i) => (
          <View key={label} style={s.stepItem}>
            <View
              style={[
                s.stepDot,
                {backgroundColor: i <= step ? palette.primary : palette.glassMid},
              ]}>
              {i < step ? (
                <Check size={10} color={palette.primaryForeground} />
              ) : (
                <Text style={{color: i === step ? palette.primaryForeground : palette.foregroundSubtle, fontSize: 10, fontWeight: '700'}}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[s.stepLabel, {color: i === step ? palette.foreground : palette.foregroundSubtle}]}>{label}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollContent}>

          {/* ── Step 0: Basic Info ── */}
          {step === 0 && (
            <View style={s.stepContent}>
              <Text style={[s.stepHeading, {color: palette.foreground}]}>Store Details</Text>
              <Text style={[s.stepSub, {color: palette.foregroundSubtle}]}>Tell customers about your store</Text>

              <Text style={[s.fieldLabel, {color: palette.foregroundSubtle}]}>Store Type *</Text>
              <View style={s.typeGrid}>
                {STORE_TYPES.map(type => {
                  const selected = storeType === type.id;
                  return (
                    <Pressable
                      key={type.id}
                      onPress={() => setStoreType(type.id)}
                      style={[
                        s.typeCard,
                        {
                          borderColor: selected ? palette.primary : palette.border,
                          backgroundColor: selected ? `${palette.primary}18` : palette.glassFaint,
                        },
                      ]}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        {type.id === 'd2c' ? (
                          <BadgePercent size={18} color={selected ? palette.primary : palette.foregroundSubtle} />
                        ) : type.id === 'b2b' ? (
                          <Building2 size={18} color={selected ? palette.primary : palette.foregroundSubtle} />
                        ) : (
                          <Store size={18} color={selected ? palette.primary : palette.foregroundSubtle} />
                        )}
                        <Text style={[s.typeTitle, {color: selected ? palette.primary : palette.foreground}]}>
                          {type.title}
                        </Text>
                      </View>
                      <Text style={[s.typeBody, {color: palette.foregroundSubtle}]}>{type.body}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Field label="Store Name *" palette={palette}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Mahesh Electronics"
                  placeholderTextColor={palette.placeholder}
                  style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>

              <Field label="Mobile Number *" palette={palette}>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={palette.placeholder}
                  keyboardType="phone-pad"
                  style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>

              <Field label="City *" palette={palette}>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Pune"
                  placeholderTextColor={palette.placeholder}
                  style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>

              <Field label="Full Address *" palette={palette}>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, area, landmark..."
                  placeholderTextColor={palette.placeholder}
                  multiline
                  numberOfLines={3}
                  style={[s.input, s.textarea, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>

              {/* Delivery toggle */}
              <View style={[s.toggleRow, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                  <Truck size={18} color={palette.primary} />
                  <View>
                    <Text style={[s.toggleLabel, {color: palette.foreground}]}>Courier / Home Delivery</Text>
                    <Text style={[s.toggleSub, {color: palette.foregroundSubtle}]}>Can you ship products?</Text>
                  </View>
                </View>
                <Switch
                  value={hasDelivery}
                  onValueChange={setHasDelivery}
                  trackColor={{false: palette.glassMid, true: `${palette.primary}80`}}
                  thumbColor={hasDelivery ? palette.primary : palette.foregroundSubtle}
                />
              </View>
            </View>
          )}

          {/* ── Step 1: Location ── */}
          {step === 1 && (
            <View style={s.stepContent}>
              <Text style={[s.stepHeading, {color: palette.foreground}]}>Pin Your Location</Text>
              <Text style={[s.stepSub, {color: palette.foregroundSubtle}]}>
                Customers will find your store by distance
              </Text>

              <Pressable
                onPress={detectLocation}
                style={[s.locateBtn, {backgroundColor: `${palette.primary}15`, borderColor: `${palette.primary}40`}]}>
                {locating ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Navigation size={20} color={palette.primary} />
                )}
                <Text style={[s.locateBtnText, {color: palette.primary}]}>
                  {lat != null ? 'Re-detect Location' : 'Detect My Location'}
                </Text>
              </Pressable>

              {lat != null && lng != null ? (
                <>
                  <View style={[s.coordBox, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                    <MapPin size={14} color={palette.success} />
                    <Text style={[s.coordText, {color: palette.foregroundSubtle}]}>
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </Text>
                    <View style={[s.coordBadge, {backgroundColor: `${palette.success}20`}]}>
                      <Text style={{color: palette.success, fontSize: 10, fontWeight: '700'}}>LOCATED</Text>
                    </View>
                  </View>
                  {mapPreviewUrl ? (
                    <Image
                      source={{uri: mapPreviewUrl}}
                      style={[s.mapPreview, {borderColor: palette.border}]}
                      resizeMode="cover"
                    />
                  ) : null}
                </>
              ) : (
                <View style={[s.mapPlaceholder, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                  <MapPin size={32} color={palette.foregroundSubtle} />
                  <Text style={[s.mapPlaceholderText, {color: palette.foregroundSubtle}]}>No location set</Text>
                  <Text style={[s.mapPlaceholderSub, {color: palette.placeholder}]}>Tap "Detect" above to pin your store</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Step 2: Photos ── */}
          {step === 2 && (
            <View style={s.stepContent}>
              <Text style={[s.stepHeading, {color: palette.foreground}]}>Store Photos</Text>
              <Text style={[s.stepSub, {color: palette.foregroundSubtle}]}>
                Add a profile photo and banner (optional but recommended)
              </Text>

              {/* Banner */}
              <Text style={[s.fieldLabel, {color: palette.foregroundSubtle}]}>Banner Image</Text>
              <Pressable
                onPress={() => pickImage('banner')}
                style={[s.bannerPicker, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                {bannerImageUri ? (
                  <Image source={{uri: bannerImageUri}} style={s.bannerImg} resizeMode="cover" />
                ) : (
                  <View style={s.pickerPlaceholder}>
                    <ImageIcon size={28} color={palette.foregroundSubtle} />
                    <Text style={{color: palette.foregroundSubtle, marginTop: 6, fontSize: 13}}>Tap to add banner</Text>
                  </View>
                )}
              </Pressable>

              {/* Profile photo */}
              <Text style={[s.fieldLabel, {color: palette.foregroundSubtle, marginTop: 20}]}>Profile Photo</Text>
              <Pressable
                onPress={() => pickImage('profile')}
                style={[s.profilePicker, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                {profilePhotoUri ? (
                  <Image source={{uri: profilePhotoUri}} style={s.profilePickerImg} resizeMode="cover" />
                ) : (
                  <Camera size={28} color={palette.foregroundSubtle} />
                )}
              </Pressable>
              <Text style={[s.photoHint, {color: palette.placeholder}]}>Recommended: square photo</Text>
            </View>
          )}

          {/* ── Step 3: Category ── */}
          {step === 3 && (
            <View style={s.stepContent}>
              <Text style={[s.stepHeading, {color: palette.foreground}]}>Store Category</Text>
              <Text style={[s.stepSub, {color: palette.foregroundSubtle}]}>What type of store is this?</Text>

              <View style={s.categoryGrid}>
                {STORE_CATEGORIES.map(cat => {
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
                      {selected && <Check size={12} color={palette.primaryForeground} />}
                      <Text
                        style={[
                          s.catChipText,
                          {color: selected ? palette.primaryForeground : palette.foreground},
                        ]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Field label="Description (optional)" palette={palette}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Brief description of your store..."
                  placeholderTextColor={palette.placeholder}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  style={[s.input, s.textarea, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>
            </View>
          )}

          {/* ── Step 4: KYC ── */}
          {step === 4 && (
            <View style={s.stepContent}>
              <Text style={[s.stepHeading, {color: palette.foreground}]}>KYC & Terms</Text>
              <Text style={[s.stepSub, {color: palette.foregroundSubtle}]}>
                Required for admin approval before your store goes live
              </Text>

              <View style={[s.noticeCard, {backgroundColor: `${palette.warning}18`, borderColor: `${palette.warning}55`}]}>
                <ShieldCheck size={18} color={palette.warning} />
                <Text style={[s.noticeText, {color: palette.foreground}]}>
                  Your profile will show Request Pending until admin approves these documents.
                </Text>
              </View>

              <Field label="GST Number (or Shop Act below)" palette={palette}>
                <TextInput
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  placeholder="GSTIN"
                  autoCapitalize="characters"
                  placeholderTextColor={palette.placeholder}
                  style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>

              <Field label="Shop Act License (or GST above)" palette={palette}>
                <TextInput
                  value={shopActLicense}
                  onChangeText={setShopActLicense}
                  placeholder="License number"
                  placeholderTextColor={palette.placeholder}
                  style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.glassFaint}]}
                />
              </Field>

              <DocButton label="PAN Card *" uri={panCardUri} palette={palette} onPress={() => pickImage('pan')} />
              <DocButton label="Aadhaar Card *" uri={aadhaarCardUri} palette={palette} onPress={() => pickImage('aadhaar')} />
              <DocButton label="Address Proof *" uri={addressProofUri} palette={palette} onPress={() => pickImage('address')} />

              <Text style={[s.fieldLabel, {color: palette.foregroundSubtle, marginTop: 12}]}>Store Photos *</Text>
              <Pressable
                onPress={() => pickImage('storePhotos')}
                style={[s.docButton, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                <Camera size={18} color={palette.primary} />
                <Text style={[s.docButtonText, {color: palette.foreground}]}>
                  {storePhotoUris.length > 0 ? `${storePhotoUris.length} photo(s) selected` : 'Upload store photos'}
                </Text>
              </Pressable>
              {storePhotoUris.length > 0 ? (
                <View style={s.storePhotoRow}>
                  {storePhotoUris.map((uri, i) => (
                    <Image key={`${uri}-${i}`} source={{uri}} style={s.storePhotoThumb} />
                  ))}
                </View>
              ) : null}

              {storeType === 'd2c' ? (
                <View style={[s.discountBox, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                  <Text style={[s.discountTitle, {color: palette.foreground}]}>Coin discount rule</Text>
                  <View style={s.discountRow}>
                    <Field label="Coins *" palette={palette}>
                      <TextInput
                        value={coinsRequired}
                        onChangeText={setCoinsRequired}
                        keyboardType="number-pad"
                        placeholder="1500"
                        placeholderTextColor={palette.placeholder}
                        style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.background}]}
                      />
                    </Field>
                    <Field label="Discount % *" palette={palette}>
                      <TextInput
                        value={discountPercent}
                        onChangeText={setDiscountPercent}
                        keyboardType="number-pad"
                        placeholder="10"
                        placeholderTextColor={palette.placeholder}
                        style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.background}]}
                      />
                    </Field>
                  </View>
                  <Field label="Minimum bill INR" palette={palette}>
                    <TextInput
                      value={minOrderInr}
                      onChangeText={setMinOrderInr}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={palette.placeholder}
                      style={[s.input, {color: palette.foreground, borderColor: palette.border, backgroundColor: palette.background}]}
                    />
                  </Field>
                </View>
              ) : (
                <View style={[s.noticeCard, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                  <Building2 size={18} color={palette.primary} />
                  <Text style={[s.noticeText, {color: palette.foreground}]}>
                    {storeType === 'b2b'
                      ? 'B2B stores receive bulk inquiry leads and do not use customer coins.'
                      : 'Online stores can connect product links without QR coin redemption.'}
                  </Text>
                </View>
              )}

              <View style={[s.toggleRow, {backgroundColor: palette.glassFaint, borderColor: palette.border}]}>
                <View style={{flex: 1, paddingRight: 12}}>
                  <Text style={[s.toggleLabel, {color: palette.foreground}]}>Accept Terms & Conditions *</Text>
                  <Text style={[s.toggleSub, {color: palette.foregroundSubtle}]}>
                    A timestamped PDF acceptance will be generated for admin legal records.
                  </Text>
                </View>
                <Switch
                  value={acceptedTerms}
                  onValueChange={setAcceptedTerms}
                  trackColor={{false: palette.glassMid, true: `${palette.primary}80`}}
                  thumbColor={acceptedTerms ? palette.primary : palette.foregroundSubtle}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom action */}
      <View style={[s.bottomBar, {borderTopColor: palette.glassFaint, backgroundColor: palette.background}]}>
        {step < STEPS.length - 1 ? (
          <Pressable
            onPress={handleNext}
            style={[s.primaryBtn, {backgroundColor: palette.primary}]}>
            <Text style={[s.primaryBtnText, {color: palette.primaryForeground}]}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[s.primaryBtn, {backgroundColor: submitting ? `${palette.primary}80` : palette.primary}]}>
            {submitting ? (
              <ActivityIndicator size="small" color={palette.primaryForeground} />
            ) : (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Store size={16} color={palette.primaryForeground} />
                <Text style={[s.primaryBtnText, {color: palette.primaryForeground}]}>
                  {existingStore ? 'Submit For Approval' : 'Create Store'}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </ThemedSafeScreen>
  );
}

function Field({label, children, palette}: {label: string; children: React.ReactNode; palette: ReturnType<typeof useTheme>['palette']}) {
  return (
    <View style={{marginBottom: 16}}>
      <Text style={[s.fieldLabel, {color: palette.foregroundSubtle}]}>{label}</Text>
      {children}
    </View>
  );
}

function DocButton({
  label,
  uri,
  palette,
  onPress,
}: {
  label: string;
  uri: string | null;
  palette: ReturnType<typeof useTheme>['palette'];
  onPress: () => void;
}) {
  return (
    <View style={{marginBottom: 12}}>
      <Text style={[s.fieldLabel, {color: palette.foregroundSubtle}]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[s.docButton, {backgroundColor: palette.glassFaint, borderColor: uri ? palette.success : palette.border}]}>
        <FileText size={18} color={uri ? palette.success : palette.primary} />
        <Text style={[s.docButtonText, {color: palette.foreground}]}>
          {uri ? 'Document selected' : 'Upload document photo'}
        </Text>
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
  headerTitle: {fontSize: 17, fontWeight: '700', letterSpacing: -0.3},
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  stepItem: {alignItems: 'center', gap: 4, flex: 1},
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {fontSize: 10, fontWeight: '600'},
  scrollContent: {paddingBottom: 32},
  stepContent: {paddingHorizontal: 16, paddingTop: 8},
  stepHeading: {fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4},
  stepSub: {fontSize: 14, lineHeight: 20, marginBottom: 24},
  fieldLabel: {fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase'},
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: {height: 88, textAlignVertical: 'top', paddingTop: 12},
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 4,
  },
  toggleLabel: {fontSize: 14, fontWeight: '700'},
  toggleSub: {fontSize: 12, marginTop: 1},
  typeGrid: {gap: 10, marginBottom: 18},
  typeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  typeTitle: {fontSize: 14, fontWeight: '900'},
  typeBody: {fontSize: 12, lineHeight: 17},
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  noticeText: {flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600'},
  docButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  docButtonText: {fontSize: 14, fontWeight: '800'},
  storePhotoRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 16},
  storePhotoThumb: {width: 62, height: 62, borderRadius: 10},
  discountBox: {borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 4, marginBottom: 16},
  discountTitle: {fontSize: 15, fontWeight: '900', marginBottom: 10},
  discountRow: {flexDirection: 'row', gap: 12},
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  locateBtnText: {fontSize: 15, fontWeight: '700'},
  coordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  coordText: {flex: 1, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'},
  coordBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6},
  mapPreview: {width: '100%', height: 180, borderRadius: 14, borderWidth: 1, marginBottom: 8},
  mapPlaceholder: {
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mapPlaceholderText: {fontSize: 14, fontWeight: '600'},
  mapPlaceholderSub: {fontSize: 12},
  bannerPicker: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImg: {width: '100%', height: '100%'},
  pickerPlaceholder: {alignItems: 'center'},
  profilePicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  profilePickerImg: {width: '100%', height: '100%', borderRadius: 50},
  photoHint: {fontSize: 12, textAlign: 'center', marginTop: 8},
  categoryGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24},
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1,
  },
  catChipText: {fontSize: 13, fontWeight: '600'},
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {fontSize: 16, fontWeight: '800'},
});
