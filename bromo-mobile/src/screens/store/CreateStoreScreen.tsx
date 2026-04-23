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
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {STORE_CATEGORIES, createStore, type StoreCategory} from '../../api/storeApi';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STEPS = ['Basic Info', 'Location', 'Photos', 'Category'] as const;

export function CreateStoreScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {refreshDbUser} = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

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
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [bannerImageUri, setBannerImageUri] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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

  const pickImage = useCallback((type: 'profile' | 'banner') => {
    launchImageLibrary({mediaType: 'photo', quality: 1, selectionLimit: 1}, res => {
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      if (type === 'profile') setProfilePhotoUri(asset.uri);
      else setBannerImageUri(asset.uri);
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
    return true;
  }, [step, name, phone, city, address, lat, lng, category]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }, [step, validateStep]);

  const handleSubmit = useCallback(async () => {
    if (!validateStep()) return;
    if (!category) return;
    setSubmitting(true);
    try {
      await createStore({
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
      });
      await refreshDbUser();
      Alert.alert('Store Created!', 'Your store is now live.', [
        {text: 'Manage Store', onPress: () => navigation.replace('ManageStore')},
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  }, [validateStep, category, name, phone, city, address, lat, lng, hasDelivery, description, profilePhotoUri, bannerImageUri, refreshDbUser, navigation]);

  const mapPreviewUrl =
    lat != null && lng != null
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x180&markers=${lat},${lng},red-pushpin`
      : null;

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[s.header, {borderBottomColor: palette.glassFaint}]}>
        <Pressable onPress={() => (step > 0 ? setStep(s => s - 1) : navigation.goBack())} hitSlop={12}>
          <ChevronLeft size={22} color={palette.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, {color: palette.foreground}]}>Create Store</Text>
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
                <Text style={[s.primaryBtnText, {color: palette.primaryForeground}]}>Create Store</Text>
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
