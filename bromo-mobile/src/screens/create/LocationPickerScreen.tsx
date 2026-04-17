import React, {useCallback, useEffect, useRef, useState} from 'react';
import Geolocation from '@react-native-community/geolocation';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {ChevronLeft, MapPin, Search, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {getNearbyPlaces, searchPlaces, type PlaceItem} from '../../api/placesApi';

type Nav = NativeStackNavigationProp<CreateStackParamList>;

export function LocationPickerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {setLocation, draft} = useCreateDraft();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestLocation = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location permission',
          message: 'Find places near you to tag in your post.',
          buttonPositive: 'OK',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setLoading(false);
        return;
      }
    }
    Geolocation.getCurrentPosition(
      p => setCoords({lat: p.coords.latitude, lng: p.coords.longitude}),
      () => setLoading(false),
      {enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000},
    );
  }, []);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!coords) return;
    void (async () => {
      setLoading(true);
      const {items: near} = await getNearbyPlaces(coords.lat, coords.lng);
      setItems(near);
      setLoading(false);
    })();
  }, [coords]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = query.trim();
      setLoading(true);
      if (!q) {
        if (coords) {
          const {items: near} = await getNearbyPlaces(coords.lat, coords.lng);
          setItems(near);
        }
      } else if (coords) {
        const {items: near} = await getNearbyPlaces(coords.lat, coords.lng, q);
        setItems(near);
      } else {
        const {items: found} = await searchPlaces(q);
        setItems(found);
      }
      setLoading(false);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, coords]);

  const pick = useCallback(
    (p: PlaceItem) => {
      setLocation({
        id: p.placeId ?? `${p.lat}_${p.lng}_${p.name}`,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        placeId: p.placeId,
      });
      navigation.goBack();
    },
    [navigation, setLocation],
  );

  const clear = useCallback(() => {
    setLocation(null);
    navigation.goBack();
  }, [navigation, setLocation]);

  return (
    <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={[styles.title, {color: palette.foreground}]}>Add location</Text>
        {draft.location ? (
          <Pressable onPress={clear} hitSlop={10}>
            <Text style={[styles.clear, {color: palette.accent}]}>Remove</Text>
          </Pressable>
        ) : (
          <View style={{width: 60}} />
        )}
      </View>

      <View style={[styles.searchBox, {backgroundColor: palette.card, borderColor: palette.border}]}>
        <Search size={18} color={palette.foregroundMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search mall, street, city…"
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
          keyExtractor={(p, i) => p.placeId ?? `${p.name}_${i}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{padding: 30, alignItems: 'center'}}>
              <Text style={{color: palette.foregroundSubtle}}>
                {coords
                  ? 'No places found nearby'
                  : 'Enable location to see nearby places or search above'}
              </Text>
              {!coords && (
                <Pressable
                  onPress={() => {
                    Alert.alert('Location', 'Allow location in Settings to see nearby places.');
                  }}
                  style={{marginTop: 12}}>
                  <Text style={{color: palette.accent, fontWeight: '700'}}>Why do we need this?</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({item}) => (
            <Pressable
              onPress={() => pick(item)}
              style={({pressed}) => [
                styles.row,
                {borderBottomColor: palette.border, opacity: pressed ? 0.6 : 1},
              ]}>
              <MapPin size={18} color={palette.accent} />
              <View style={{flex: 1}}>
                <Text style={[styles.rowTitle, {color: palette.foreground}]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.address ? (
                  <Text style={[styles.rowSub, {color: palette.foregroundSubtle}]} numberOfLines={1}>
                    {item.address}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
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
  clear: {fontSize: 14, fontWeight: '700'},
  searchBox: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  input: {flex: 1, paddingVertical: 8, fontSize: 14},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: {fontSize: 14, fontWeight: '700'},
  rowSub: {fontSize: 12, marginTop: 2},
});
