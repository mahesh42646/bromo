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
import type {ThemePalette} from '../../config/platform-theme';
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

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    root: {flex: 1, backgroundColor: p.background},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    title: {color: p.foreground, fontWeight: '800', fontSize: 16},
    next: {fontSize: 16, fontWeight: '700'},
    thumbRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.surfaceHigh,
    },
    thumbImg: {width: 64, height: 64, borderRadius: 8},
    captionInline: {
      flex: 1,
      color: p.foreground,
      fontSize: 15,
      textAlignVertical: 'top',
      padding: 0,
    },
    rowTitle: {flexDirection: 'row', alignItems: 'center', marginLeft: 14, marginTop: 18, marginRight: 14},
    labelInline: {color: p.foreground, fontWeight: '800', marginLeft: 8, fontSize: 14},
    removeLink: {color: p.destructive, fontSize: 13, fontWeight: '700'},
    tagRow: {paddingHorizontal: 12, gap: 8, marginTop: 8},
    tagChip: {
      backgroundColor: p.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tagText: {color: p.borderFaint, fontWeight: '700', fontSize: 12},
    locationPane: {marginHorizontal: 14, marginTop: 8},
    locationInput: {
      backgroundColor: p.card,
      borderRadius: 10,
      padding: 12,
      color: p.foreground,
      marginBottom: 8,
    },
    locationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: p.surface,
      borderRadius: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: p.surfaceHigh,
    },
    locationName: {color: p.foreground, fontSize: 14, fontWeight: '600'},
    locationAddr: {color: p.foregroundMuted, fontSize: 12, marginTop: 1},
    pollBox: {paddingHorizontal: 14, gap: 8, marginTop: 8},
    pollInput: {
      backgroundColor: p.card,
      borderRadius: 10,
      padding: 12,
      color: p.foreground,
    },
    userRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, marginTop: 8},
    userChip: {
      borderWidth: 1,
      borderColor: p.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    userChipTxt: {color: p.foreground, fontSize: 13, fontWeight: '600'},
    product: {
      width: 130,
      backgroundColor: p.card,
      borderRadius: 14,
      padding: 8,
      borderWidth: 1,
      borderColor: p.border,
    },
    productImg: {width: '100%', height: 80, borderRadius: 10},
    productName: {color: p.foreground, fontWeight: '800', fontSize: 12, marginTop: 6},
    productPrice: {color: p.success, fontSize: 11, fontWeight: '700', marginTop: 2},
    stickerBtn: {marginTop: 8, backgroundColor: p.surfaceHigh, paddingVertical: 6, borderRadius: 8, alignItems: 'center'},
    stickerBtnTxt: {color: p.foreground, fontSize: 11, fontWeight: '800'},
    carouselThumb: {alignItems: 'center'},
    carouselImg: {width: 64, height: 64, borderRadius: 8},
    carouselBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: p.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    carouselBadgeTxt: {color: p.foreground, fontSize: 10, fontWeight: '800'},
    coverLabel: {color: p.accent, fontSize: 10, fontWeight: '800', marginTop: 2},
    altInput: {
      color: p.foreground,
      marginHorizontal: 14,
      marginTop: 8,
      minHeight: 60,
      backgroundColor: p.card,
      borderRadius: 12,
      padding: 12,
      textAlignVertical: 'top',
    },
    advancedTitle: {
      color: p.foregroundMuted,
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
      backgroundColor: p.surface,
      borderRadius: 10,
      gap: 10,
    },
    toggleLabel: {color: p.foreground, flex: 1, fontSize: 14, fontWeight: '600'},
  });
}

export function ComposerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const s = makeStyles(palette);
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
    <ThemedSafeScreen style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={palette.foreground} />
        </Pressable>
        <Text style={s.title}>New {draft.mode}</Text>
        <Pressable onPress={goNext}>
          <Text style={[s.next, {color: palette.primary}]}>Next</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {/* Thumbnail preview */}
        {draft.assets.length > 0 && (
          <View style={s.thumbRow}>
            <Image source={{uri: draft.assets[0].uri}} style={s.thumbImg} />
            <TextInput
              value={captionLocal}
              onChangeText={setCaptionLocal}
              onBlur={syncCaption}
              placeholder="Write a caption..."
              placeholderTextColor={palette.placeholder}
              multiline
              style={s.captionInline}
            />
          </View>
        )}

        {/* Hashtags */}
        <SectionHeader icon={<Hash size={16} color={palette.foreground} />} label="Hashtags" palette={palette} s={s} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagRow}>
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
                style={[s.tagChip, active && {backgroundColor: palette.primary + '33', borderColor: palette.primary}]}>
                <Text style={[s.tagText, active && {color: palette.primary}]}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Location */}
        <Pressable onPress={() => setShowLocation(v => !v)}>
          <SectionHeader
            icon={<MapPin size={16} color={palette.foreground} />}
            label={location ? location.name : 'Add location'}
            palette={palette}
            s={s}
            right={location
              ? <Pressable onPress={() => setLocation(null)}><Text style={s.removeLink}>Remove</Text></Pressable>
              : <ChevronRight size={16} color={palette.foregroundSubtle} />
            }
          />
        </Pressable>
        {showLocation && (
          <View style={s.locationPane}>
            <TextInput
              value={locationQuery}
              onChangeText={setLocationQuery}
              placeholder="Search places..."
              placeholderTextColor={palette.placeholder}
              style={s.locationInput}
            />
            {filteredLocations.map(l => (
              <Pressable
                key={l.id}
                onPress={() => {
                  setLocation(l);
                  setShowLocation(false);
                  setLocationQuery('');
                }}
                style={[s.locationItem, location?.id === l.id && {borderColor: palette.primary}]}>
                <MapPin size={14} color={palette.foregroundMuted} />
                <View style={{flex: 1}}>
                  <Text style={s.locationName}>{l.name}</Text>
                  {l.address && <Text style={s.locationAddr}>{l.address}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Poll */}
        <SectionHeader
          icon={<BarChart2 size={16} color={palette.foreground} />}
          label="Poll"
          palette={palette}
          s={s}
          right={
            <Switch
              value={poll.enabled}
              onValueChange={v => setPoll({enabled: v})}
            />
          }
        />
        {poll.enabled && (
          <View style={s.pollBox}>
            <TextInput value={pollA} onChangeText={setPollA} style={s.pollInput} placeholder="Option A" placeholderTextColor={palette.placeholder} />
            <TextInput value={pollB} onChangeText={setPollB} style={s.pollInput} placeholder="Option B" placeholderTextColor={palette.placeholder} />
          </View>
        )}

        {/* Tag people */}
        <SectionHeader icon={<UserPlus size={16} color={palette.foreground} />} label="Tag people" palette={palette} s={s} />
        <View style={s.userRow}>
          {MOCK_USERS.map(u => {
            const on = tagged.some(t => t.id === u.id);
            return (
              <Pressable key={u.id} onPress={() => toggleUser(u)} style={[s.userChip, on && {borderColor: palette.primary, backgroundColor: palette.primary + '22'}]}>
                <Text style={[s.userChipTxt, on && {color: palette.primary}]}>@{u.username}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Products */}
        <SectionHeader icon={<ShoppingBag size={16} color={palette.foreground} />} label="Products" palette={palette} s={s} />
        <FlatList
          horizontal
          data={MOCK_PRODUCTS}
          keyExtractor={item => item.id}
          contentContainerStyle={{paddingHorizontal: 12, gap: 10, paddingBottom: 4}}
          showsHorizontalScrollIndicator={false}
          renderItem={({item}) => {
            const on = products.some(p => p.id === item.id);
            return (
              <Pressable onPress={() => attachProduct(item)} style={[s.product, on && {borderColor: palette.primary}]}>
                <Image source={{uri: item.imageUri}} style={s.productImg} />
                <Text style={s.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.productPrice}>{item.priceLabel}</Text>
                <Pressable onPress={() => stickerFromProduct(item)} style={[s.stickerBtn, on && {backgroundColor: palette.primary + '33'}]}>
                  <Text style={[s.stickerBtnTxt, on && {color: palette.primary}]}>+ Sticker</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />

        {/* Carousel order */}
        {draft.assets.length > 1 && (
          <>
            <SectionHeader icon={<ImageIcon size={16} color={palette.foreground} />} label="Carousel order" palette={palette} s={s} />
            <ScrollView horizontal style={{marginTop: 8}} contentContainerStyle={{paddingHorizontal: 12, gap: 8}}>
              {draft.assets.map((a, idx) => (
                <View key={a.uri} style={s.carouselThumb}>
                  <Image source={{uri: a.uri}} style={s.carouselImg} />
                  <View style={s.carouselBadge}>
                    <Text style={s.carouselBadgeTxt}>{idx + 1}</Text>
                  </View>
                  {idx === 0 && <Text style={s.coverLabel}>Cover</Text>}
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Alt text */}
        <Pressable onPress={() => setShowAltText(v => !v)}>
          <SectionHeader
            icon={<FileText size={16} color={palette.foreground} />}
            label="Alt text"
            palette={palette}
            s={s}
            right={<ChevronRight size={16} color={palette.foregroundSubtle} style={{transform: [{rotate: showAltText ? '90deg' : '0deg'}]}} />}
          />
        </Pressable>
        {showAltText && (
          <TextInput
            value={altTextLocal}
            onChangeText={setAltTextLocal}
            onBlur={() => setAdvanced({altText: altTextLocal})}
            placeholder="Describe this content for accessibility..."
            placeholderTextColor={palette.placeholder}
            multiline
            style={s.altInput}
          />
        )}

        {/* Advanced settings */}
        <Text style={s.advancedTitle}>Advanced settings</Text>

        <ToggleRow
          icon={<MessageCircleOff size={16} color={palette.foreground} />}
          label="Turn off comments"
          value={advanced.commentsOff}
          onToggle={v => setAdvanced({commentsOff: v})}
          s={s}
        />
        <ToggleRow
          icon={<EyeOff size={16} color={palette.foreground} />}
          label="Hide like count"
          value={advanced.hideLikeCount}
          onToggle={v => setAdvanced({hideLikeCount: v})}
          s={s}
        />
        <ToggleRow
          icon={<Award size={16} color={palette.foreground} />}
          label="Branded content / Paid partnership"
          value={advanced.brandedContent}
          onToggle={v => setAdvanced({brandedContent: v})}
          s={s}
        />
        {draft.mode === 'post' && (
          <ToggleRow
            icon={<Eye size={16} color={palette.foreground} />}
            label="Also share to your story"
            value={advanced.shareToStory}
            onToggle={v => setAdvanced({shareToStory: v})}
            s={s}
          />
        )}

        <View style={{height: 40}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function SectionHeader({icon, label, right, s}: {icon: React.ReactNode; label: string; right?: React.ReactNode; palette: ThemePalette; s: Styles}) {
  return (
    <View style={s.rowTitle}>
      {icon}
      <Text style={s.labelInline}>{label}</Text>
      {right && <View style={{marginLeft: 'auto'}}>{right}</View>}
    </View>
  );
}

function ToggleRow({icon, label, value, onToggle, s}: {icon: React.ReactNode; label: string; value: boolean; onToggle: (v: boolean) => void; s: Styles}) {
  return (
    <View style={s.toggleRow}>
      {icon}
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}
