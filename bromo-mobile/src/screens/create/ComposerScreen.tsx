import React, {useCallback, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Hash,
  MapPin,
  MessageCircleOff,
  Eye,
  EyeOff,
  Award,
  Image as ImageIcon,
  ShoppingBag,
  UserPlus,
  FileText,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {LocationTag} from '../../create/createTypes';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Composer'>;

const {width: W} = Dimensions.get('window');

const SUGGEST_TAGS = [
  '#fyp', '#reels', '#shopping', '#local', '#creator',
  '#bromo', '#sale', '#story', '#trending', '#ootd',
];

const MOCK_USERS = [
  {id: 'u1', username: 'priya_vibes'},
  {id: 'u2', username: 'tech_marathi'},
  {id: 'u3', username: 'shop_local'},
  {id: 'u4', username: 'foodie_india'},
  {id: 'u5', username: 'travel_squad'},
];

const MOCK_PRODUCTS = [
  {id: 'p1', name: 'Air Max Elite', priceLabel: '\u20B92,499', imageUri: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200'},
  {id: 'p2', name: 'Smart Watch X', priceLabel: '\u20B94,999', imageUri: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200'},
  {id: 'p3', name: 'Slim Jeans', priceLabel: '\u20B91,299', imageUri: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200'},
  {id: 'p4', name: 'Canvas Bag', priceLabel: '\u20B9799', imageUri: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200'},
];

const MOCK_LOCATIONS: LocationTag[] = [
  {id: 'loc1', name: 'Mumbai, Maharashtra', address: 'India'},
  {id: 'loc2', name: 'Pune, Maharashtra', address: 'India'},
  {id: 'loc3', name: 'Indiranagar, Bangalore', address: 'Karnataka'},
  {id: 'loc4', name: 'Connaught Place', address: 'New Delhi'},
  {id: 'loc5', name: 'Bandra West', address: 'Mumbai'},
];

export function ComposerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {
    draft,
    setCaption,
    setHashtags,
    setTagged,
    setLocation,
    setProducts,
    setPoll,
    setAdvanced,
    addSticker,
  } = useCreateDraft();

  const {tagged, products, poll, location, advanced} = draft;

  const [captionLocal, setCaptionLocal] = useState(draft.caption);
  const [pollA, setPollA] = useState(poll.optionA);
  const [pollB, setPollB] = useState(poll.optionB);
  const [showLocation, setShowLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [showAltText, setShowAltText] = useState(!!advanced.altText);
  const [altTextLocal, setAltTextLocal] = useState(advanced.altText);

  const syncCaption = useCallback(() => {
    setCaption(captionLocal);
    const tags = captionLocal.match(/#[\w]+/g) ?? [];
    setHashtags(tags);
  }, [captionLocal, setCaption, setHashtags]);

  const toggleUser = (u: (typeof MOCK_USERS)[0]) => {
    const exists = tagged.find(t => t.id === u.id);
    if (exists) setTagged(tagged.filter(t => t.id !== u.id));
    else setTagged([...tagged, {id: u.id, username: u.username}]);
  };

  const attachProduct = (p: (typeof MOCK_PRODUCTS)[0]) => {
    const list = products.some(x => x.id === p.id)
      ? products.filter(x => x.id !== p.id)
      : [...products, {id: p.id, name: p.name, priceLabel: p.priceLabel, imageUri: p.imageUri}];
    setProducts(list);
  };

  const stickerFromProduct = (p: (typeof MOCK_PRODUCTS)[0]) => {
    addSticker({
      productId: p.id,
      label: `${p.name} ${p.priceLabel}`,
      x: W * 0.15 + Math.random() * 40,
      y: 180 + Math.random() * 60,
    });
  };

  const filteredLocations = locationQuery.length > 0
    ? MOCK_LOCATIONS.filter(l =>
        l.name.toLowerCase().includes(locationQuery.toLowerCase()),
      )
    : MOCK_LOCATIONS;

  const goNext = () => {
    syncCaption();
    setPoll({optionA: pollA, optionB: pollB});
    if (altTextLocal) setAdvanced({altText: altTextLocal});
    navigation.navigate('ShareFinal');
  };

  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>New {draft.mode}</Text>
        <Pressable onPress={goNext}>
          <Text style={[styles.next, {color: palette.primary}]}>Next</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {/* Thumbnail preview */}
        {draft.assets.length > 0 && (
          <View style={styles.thumbRow}>
            <Image source={{uri: draft.assets[0].uri}} style={styles.thumbImg} />
            <TextInput
              value={captionLocal}
              onChangeText={setCaptionLocal}
              onBlur={syncCaption}
              placeholder="Write a caption..."
              placeholderTextColor="#666"
              multiline
              style={styles.captionInline}
            />
          </View>
        )}

        {/* Hashtags */}
        <SectionHeader icon={<Hash size={16} color="#fff" />} label="Hashtags" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          {SUGGEST_TAGS.map(t => {
            const active = captionLocal.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() => {
                  const next =
                    captionLocal.endsWith(' ') || captionLocal.length === 0
                      ? captionLocal + t
                      : `${captionLocal} ${t}`;
                  setCaptionLocal(next);
                  setCaption(next);
                  setHashtags(next.match(/#[\w]+/g) ?? []);
                }}
                style={[styles.tagChip, active && {backgroundColor: palette.primary + '33', borderColor: palette.primary}]}>
                <Text style={[styles.tagText, active && {color: palette.primary}]}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Location */}
        <Pressable onPress={() => setShowLocation(v => !v)}>
          <SectionHeader
            icon={<MapPin size={16} color="#fff" />}
            label={location ? location.name : 'Add location'}
            right={location
              ? <Pressable onPress={() => setLocation(null)}><Text style={styles.removeLink}>Remove</Text></Pressable>
              : <ChevronRight size={16} color="#666" />
            }
          />
        </Pressable>
        {showLocation && (
          <View style={styles.locationPane}>
            <TextInput
              value={locationQuery}
              onChangeText={setLocationQuery}
              placeholder="Search places..."
              placeholderTextColor="#666"
              style={styles.locationInput}
            />
            {filteredLocations.map(l => (
              <Pressable
                key={l.id}
                onPress={() => {
                  setLocation(l);
                  setShowLocation(false);
                  setLocationQuery('');
                }}
                style={[styles.locationItem, location?.id === l.id && {borderColor: palette.primary}]}>
                <MapPin size={14} color="#aaa" />
                <View style={{flex: 1}}>
                  <Text style={styles.locationName}>{l.name}</Text>
                  {l.address && <Text style={styles.locationAddr}>{l.address}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Poll */}
        <SectionHeader
          icon={<BarChart2 size={16} color="#fff" />}
          label="Poll"
          right={
            <Switch
              value={poll.enabled}
              onValueChange={v => setPoll({enabled: v})}
            />
          }
        />
        {poll.enabled && (
          <View style={styles.pollBox}>
            <TextInput value={pollA} onChangeText={setPollA} style={styles.pollInput} placeholder="Option A" placeholderTextColor="#666" />
            <TextInput value={pollB} onChangeText={setPollB} style={styles.pollInput} placeholder="Option B" placeholderTextColor="#666" />
          </View>
        )}

        {/* Tag people */}
        <SectionHeader icon={<UserPlus size={16} color="#fff" />} label="Tag people" />
        <View style={styles.userRow}>
          {MOCK_USERS.map(u => {
            const on = tagged.some(t => t.id === u.id);
            return (
              <Pressable key={u.id} onPress={() => toggleUser(u)} style={[styles.userChip, on && {borderColor: palette.primary, backgroundColor: palette.primary + '22'}]}>
                <Text style={[styles.userChipTxt, on && {color: palette.primary}]}>@{u.username}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Products */}
        <SectionHeader icon={<ShoppingBag size={16} color="#fff" />} label="Products" />
        <FlatList
          horizontal
          data={MOCK_PRODUCTS}
          keyExtractor={item => item.id}
          contentContainerStyle={{paddingHorizontal: 12, gap: 10, paddingBottom: 4}}
          showsHorizontalScrollIndicator={false}
          renderItem={({item}) => {
            const on = products.some(p => p.id === item.id);
            return (
              <Pressable onPress={() => attachProduct(item)} style={[styles.product, on && {borderColor: palette.primary}]}>
                <Image source={{uri: item.imageUri}} style={styles.productImg} />
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.priceLabel}</Text>
                <Pressable onPress={() => stickerFromProduct(item)} style={[styles.stickerBtn, on && {backgroundColor: palette.primary + '33'}]}>
                  <Text style={[styles.stickerBtnTxt, on && {color: palette.primary}]}>+ Sticker</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />

        {/* Carousel order */}
        {draft.assets.length > 1 && (
          <>
            <SectionHeader icon={<ImageIcon size={16} color="#fff" />} label="Carousel order" />
            <ScrollView horizontal style={{marginTop: 8}} contentContainerStyle={{paddingHorizontal: 12, gap: 8}}>
              {draft.assets.map((a, idx) => (
                <View key={a.uri} style={styles.carouselThumb}>
                  <Image source={{uri: a.uri}} style={styles.carouselImg} />
                  <View style={styles.carouselBadge}>
                    <Text style={styles.carouselBadgeTxt}>{idx + 1}</Text>
                  </View>
                  {idx === 0 && <Text style={styles.coverLabel}>Cover</Text>}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Alt text */}
        <Pressable onPress={() => setShowAltText(v => !v)}>
          <SectionHeader
            icon={<FileText size={16} color="#fff" />}
            label="Alt text"
            right={<ChevronRight size={16} color="#666" style={{transform: [{rotate: showAltText ? '90deg' : '0deg'}]}} />}
          />
        </Pressable>
        {showAltText && (
          <TextInput
            value={altTextLocal}
            onChangeText={setAltTextLocal}
            onBlur={() => setAdvanced({altText: altTextLocal})}
            placeholder="Describe this content for accessibility..."
            placeholderTextColor="#666"
            multiline
            style={styles.altInput}
          />
        )}

        {/* Advanced settings */}
        <Text style={styles.advancedTitle}>Advanced settings</Text>

        <ToggleRow
          icon={<MessageCircleOff size={16} color="#fff" />}
          label="Turn off comments"
          value={advanced.commentsOff}
          onToggle={v => setAdvanced({commentsOff: v})}
        />
        <ToggleRow
          icon={<EyeOff size={16} color="#fff" />}
          label="Hide like count"
          value={advanced.hideLikeCount}
          onToggle={v => setAdvanced({hideLikeCount: v})}
        />
        <ToggleRow
          icon={<Award size={16} color="#fff" />}
          label="Branded content / Paid partnership"
          value={advanced.brandedContent}
          onToggle={v => setAdvanced({brandedContent: v})}
        />
        {draft.mode === 'post' && (
          <ToggleRow
            icon={<Eye size={16} color="#fff" />}
            label="Also share to your story"
            value={advanced.shareToStory}
            onToggle={v => setAdvanced({shareToStory: v})}
          />
        )}

        <View style={{height: 40}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

function SectionHeader({icon, label, right}: {icon: React.ReactNode; label: string; right?: React.ReactNode}) {
  return (
    <View style={styles.rowTitle}>
      {icon}
      <Text style={styles.labelInline}>{label}</Text>
      {right && <View style={{marginLeft: 'auto'}}>{right}</View>}
    </View>
  );
}

function ToggleRow({icon, label, value, onToggle}: {icon: React.ReactNode; label: string; value: boolean; onToggle: (v: boolean) => void}) {
  return (
    <View style={styles.toggleRow}>
      {icon}
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {color: '#fff', fontWeight: '800', fontSize: 16},
  next: {fontSize: 16, fontWeight: '700'},
  thumbRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  thumbImg: {width: 64, height: 64, borderRadius: 8},
  captionInline: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    textAlignVertical: 'top',
    padding: 0,
  },
  rowTitle: {flexDirection: 'row', alignItems: 'center', marginLeft: 14, marginTop: 18, marginRight: 14},
  labelInline: {color: '#fff', fontWeight: '800', marginLeft: 8, fontSize: 14},
  removeLink: {color: '#ff4444', fontSize: 13, fontWeight: '700'},
  tagRow: {paddingHorizontal: 12, gap: 8, marginTop: 8},
  tagChip: {
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagText: {color: '#ddd', fontWeight: '700', fontSize: 12},
  locationPane: {marginHorizontal: 14, marginTop: 8},
  locationInput: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    marginBottom: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#111',
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  locationName: {color: '#fff', fontSize: 14, fontWeight: '600'},
  locationAddr: {color: '#888', fontSize: 12, marginTop: 1},
  pollBox: {paddingHorizontal: 14, gap: 8, marginTop: 8},
  pollInput: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
  },
  userRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, marginTop: 8},
  userChip: {
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  userChipTxt: {color: '#fff', fontSize: 13, fontWeight: '600'},
  product: {
    width: 130,
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  productImg: {width: '100%', height: 80, borderRadius: 10},
  productName: {color: '#fff', fontWeight: '800', fontSize: 12, marginTop: 6},
  productPrice: {color: '#34d399', fontSize: 11, fontWeight: '700', marginTop: 2},
  stickerBtn: {marginTop: 8, backgroundColor: '#222', paddingVertical: 6, borderRadius: 8, alignItems: 'center'},
  stickerBtnTxt: {color: '#fff', fontSize: 11, fontWeight: '800'},
  carouselThumb: {alignItems: 'center'},
  carouselImg: {width: 64, height: 64, borderRadius: 8},
  carouselBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselBadgeTxt: {color: '#fff', fontSize: 10, fontWeight: '800'},
  coverLabel: {color: '#0095f6', fontSize: 10, fontWeight: '800', marginTop: 2},
  altInput: {
    color: '#fff',
    marginHorizontal: 14,
    marginTop: 8,
    minHeight: 60,
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
  advancedTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 14,
    marginTop: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#111',
    borderRadius: 10,
    gap: 10,
  },
  toggleLabel: {color: '#fff', flex: 1, fontSize: 14, fontWeight: '600'},
});
