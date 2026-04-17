import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
  Search,
  ShoppingBag,
  UserPlus,
  X,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePalette} from '../../config/platform-theme';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {getUserSuggestions, type SuggestedUser} from '../../api/followApi';
import {listProducts, type AffiliateProduct} from '../../api/productsApi';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Composer'>;

const {width: W} = Dimensions.get('window');
const MAX_PRODUCTS = 6;

function affiliateToAttachment(p: AffiliateProduct) {
  return {
    id: p._id,
    name: p.title,
    priceLabel: `${p.currency} ${p.price.toLocaleString()}`,
    imageUri: p.imageUrl,
    productUrl: p.productUrl,
  };
}

const SUGGEST_TAGS = [
  '#fyp', '#reels', '#shopping', '#local', '#creator',
  '#bromo', '#sale', '#story', '#trending', '#ootd',
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
    thumbImg: {width: 64, height: 64, borderRadius: 8},
    captionBox: {
      flexDirection: 'row',
      marginHorizontal: 14,
      marginTop: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      gap: 12,
      alignItems: 'flex-start',
    },
    captionInline: {
      flex: 1,
      color: p.foreground,
      fontSize: 15,
      textAlignVertical: 'top',
      padding: 0,
      minHeight: 72,
    },
    hashtagManualRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginTop: 10,
      gap: 8,
    },
    hashtagInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: p.foreground,
      backgroundColor: p.input ?? p.card,
      fontSize: 14,
    },
    hashtagAddBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: p.accent,
    },
    hashtagAddTxt: {color: p.accentForeground, fontWeight: '800', fontSize: 13},
    productSearchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginTop: 8,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      gap: 8,
    },
    productSearchInput: {flex: 1, paddingVertical: 8, fontSize: 14, color: p.foreground},
    productSlotRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, marginTop: 10},
    productSlot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      maxWidth: '48%',
    },
    productSlotTxt: {color: p.foreground, fontSize: 12, fontWeight: '700', flex: 1},
    productHit: {
      width: 100,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
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
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginTop: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
    },
    linkRowTxt: {flex: 1, color: p.foreground, fontSize: 14, fontWeight: '600'},
    linkRowMeta: {color: p.foregroundSubtle, fontSize: 12, fontWeight: '600'},
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
    moreChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: p.accent,
    },
    moreChipTxt: {color: p.accent, fontSize: 13, fontWeight: '800'},
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

type Styles = ReturnType<typeof makeStyles>;

function SectionHeader({icon, label, right, s}: {icon: React.ReactNode; label: string; right?: React.ReactNode; s: Styles}) {
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
    setPoll,
    setAdvanced,
    addSticker,
    setProducts,
  } = useCreateDraft();

  const {tagged, products, poll, location, advanced} = draft;

  const [captionLocal, setCaptionLocal] = useState(draft.caption);
  const [pollA, setPollA] = useState(poll.optionA);
  const [pollB, setPollB] = useState(poll.optionB);
  const [friends, setFriends] = useState<SuggestedUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [hashtagDraft, setHashtagDraft] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productHits, setProductHits] = useState<AffiliateProduct[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const productDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {users} = await getUserSuggestions(24);
        if (!cancelled) setFriends(users);
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    productDebounceRef.current = setTimeout(async () => {
      setProductLoading(true);
      const {items} = await listProducts(productQuery.trim() || undefined, undefined, 12);
      setProductHits(items);
      setProductLoading(false);
    }, 280);
    return () => {
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    };
  }, [productQuery]);

  const syncCaption = useCallback(() => {
    setCaption(captionLocal);
    const tags = captionLocal.match(/#[\w\u0900-\u0fff]+/g) ?? [];
    setHashtags(tags);
    setAdvanced({altText: captionLocal.trim()});
  }, [captionLocal, setCaption, setHashtags, setAdvanced]);

  const toggleFriendTag = (u: SuggestedUser) => {
    const exists = tagged.find(t => t.id === u._id);
    if (exists) setTagged(tagged.filter(t => t.id !== u._id));
    else setTagged([...tagged, {id: u._id, username: u.username, avatar: u.profilePicture || undefined}]);
  };

  const stickerFromProduct = (p: (typeof products)[0]) => {
    addSticker({
      productId: p.id,
      label: `${p.name} ${p.priceLabel}`,
      x: W * 0.15 + Math.random() * 40,
      y: 180 + Math.random() * 60,
    });
  };

  const appendManualHashtag = useCallback(() => {
    let t = hashtagDraft.trim();
    if (!t) return;
    if (!t.startsWith('#')) t = `#${t.replace(/^#+/, '')}`;
    const next =
      captionLocal.endsWith(' ') || captionLocal.length === 0 ? `${captionLocal}${t}` : `${captionLocal} ${t}`;
    setCaptionLocal(next);
    setCaption(next);
    setHashtags(next.match(/#[\w\u0900-\u0fff]+/g) ?? []);
    setAdvanced({altText: next.trim()});
    setHashtagDraft('');
  }, [hashtagDraft, captionLocal, setCaption, setHashtags, setAdvanced]);

  const addProductFromCatalog = useCallback(
    (p: AffiliateProduct) => {
      if (draft.products.some(x => x.id === p._id)) return;
      if (draft.products.length >= MAX_PRODUCTS) return;
      setProducts([...draft.products, affiliateToAttachment(p)]);
    },
    [draft.products, setProducts],
  );

  const removeTaggedProduct = useCallback(
    (id: string) => setProducts(draft.products.filter(x => x.id !== id)),
    [draft.products, setProducts],
  );

  const goNext = () => {
    syncCaption();
    setPoll({optionA: pollA, optionB: pollB});
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
          <Text style={[s.next, {color: palette.accent}]}>Next</Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={draft.assets.length > 0 ? s.captionBox : [s.captionBox, {marginBottom: 4}]}>
          {draft.assets.length > 0 ? (
            <Image source={{uri: draft.assets[0].uri}} style={s.thumbImg} />
          ) : null}
          <TextInput
            value={captionLocal}
            onChangeText={setCaptionLocal}
            onBlur={syncCaption}
            placeholder="Write a caption…"
            placeholderTextColor={palette.placeholder}
            multiline
            style={s.captionInline}
          />
        </View>

        <SectionHeader icon={<Hash size={16} color={palette.foreground} />} label="Hashtags" s={s} />
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
                  setHashtags(next.match(/#[\w\u0900-\u0fff]+/g) ?? []);
                  setAdvanced({altText: next.trim()});
                }}
                style={[s.tagChip, active && {backgroundColor: palette.accent + '33', borderColor: palette.accent}]}>
                <Text style={[s.tagText, active && {color: palette.accent}]}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.hashtagManualRow}>
          <TextInput
            value={hashtagDraft}
            onChangeText={setHashtagDraft}
            onSubmitEditing={appendManualHashtag}
            placeholder="Type a hashtag (or pick below)"
            placeholderTextColor={palette.placeholder}
            style={s.hashtagInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={appendManualHashtag} style={s.hashtagAddBtn}>
            <Text style={s.hashtagAddTxt}>Add</Text>
          </Pressable>
        </View>

        <View
          style={[
            s.linkRow,
            {marginTop: 18, marginBottom: 4, borderColor: palette.border, backgroundColor: palette.card},
          ]}>
          <Pressable
            onPress={() => navigation.navigate('LocationPicker')}
            style={{flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <MapPin size={18} color={palette.accent} />
            <View style={{flex: 1}}>
              <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800'}}>Location</Text>
              <Text style={[s.linkRowTxt, {marginTop: 2}]} numberOfLines={2}>
                {location ? location.name : 'Add location'}
              </Text>
            </View>
          </Pressable>
          {location ? (
            <Pressable onPress={() => setLocation(null)} hitSlop={8}>
              <Text style={s.removeLink}>Clear</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => navigation.navigate('LocationPicker')} hitSlop={8}>
              <ChevronRight size={18} color={palette.foregroundSubtle} />
            </Pressable>
          )}
        </View>

        <SectionHeader
          icon={<BarChart2 size={16} color={palette.foreground} />}
          label="Poll"
          s={s}
          right={<Switch value={poll.enabled} onValueChange={v => setPoll({enabled: v})} />}
        />
        {poll.enabled && (
          <View style={s.pollBox}>
            <TextInput value={pollA} onChangeText={setPollA} style={s.pollInput} placeholder="Option A" placeholderTextColor={palette.placeholder} />
            <TextInput value={pollB} onChangeText={setPollB} style={s.pollInput} placeholder="Option B" placeholderTextColor={palette.placeholder} />
          </View>
        )}

        <SectionHeader
          icon={<UserPlus size={16} color={palette.foreground} />}
          label="Tag people"
          s={s}
          right={
            <Text style={{color: palette.foregroundMuted, fontSize: 11, fontWeight: '600'}}>Up to 3 suggested</Text>
          }
        />
        {friendsLoading ? (
          <ActivityIndicator color={palette.foreground} style={{marginVertical: 12}} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 12, gap: 8, paddingBottom: 8}}>
            {friends.slice(0, 3).map(u => {
              const on = tagged.some(t => t.id === u._id);
              return (
                <Pressable
                  key={u._id}
                  onPress={() => toggleFriendTag(u)}
                  style={[s.userChip, on && {borderColor: palette.accent, backgroundColor: palette.accent + '22'}]}>
                  <Text style={[s.userChipTxt, on && {color: palette.accent}]}>@{u.username}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => navigation.navigate('TagPeoplePicker')} style={s.moreChip}>
              <Text style={s.moreChipTxt}>Search…</Text>
            </Pressable>
          </ScrollView>
        )}

        <View style={s.rowTitle}>
          <ShoppingBag size={16} color={palette.foreground} />
          <Text style={s.labelInline}>Tag products</Text>
          <Pressable onPress={() => navigation.navigate('ProductPicker')} style={{marginLeft: 'auto'}}>
            <Text style={{color: palette.accent, fontWeight: '800', fontSize: 13}}>Browse all</Text>
          </Pressable>
        </View>
        <Text style={{marginHorizontal: 14, marginTop: 4, color: palette.foregroundMuted, fontSize: 12}}>
          Up to {MAX_PRODUCTS} — tap a result to tag; long-press a chip to drop a sticker on preview.
        </Text>
        <View style={s.productSlotRow}>
          {products.slice(0, 3).map(p => (
            <Pressable
              key={p.id}
              onPress={() => stickerFromProduct(p)}
              onLongPress={() => stickerFromProduct(p)}
              style={[s.productSlot, {borderColor: palette.accent + '55'}]}>
              <Text style={s.productSlotTxt} numberOfLines={2}>
                {p.name}
              </Text>
              <Pressable
                onPress={() => removeTaggedProduct(p.id)}
                hitSlop={10}
                style={{padding: 4}}>
                <X size={16} color={palette.foregroundMuted} />
              </Pressable>
            </Pressable>
          ))}
          {products.length > 3
            ? products.slice(3).map(p => (
                <View key={p.id} style={[s.productSlot, {opacity: 0.85}]}>
                  <Text style={s.productSlotTxt} numberOfLines={1}>
                    + {p.name}
                  </Text>
                  <Pressable onPress={() => removeTaggedProduct(p.id)} hitSlop={10}>
                    <X size={14} color={palette.foregroundMuted} />
                  </Pressable>
                </View>
              ))
            : null}
        </View>
        <View style={[s.productSearchBox, {borderColor: palette.border}]}>
          <Search size={16} color={palette.foregroundMuted} />
          <TextInput
            value={productQuery}
            onChangeText={setProductQuery}
            placeholder="Search catalog…"
            placeholderTextColor={palette.placeholder}
            style={s.productSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {productLoading ? (
          <ActivityIndicator color={palette.accent} style={{marginTop: 12}} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 14, gap: 10, paddingVertical: 12}}>
            {productHits.map(hit => {
              const on = products.some(x => x.id === hit._id);
              return (
                <Pressable
                  key={hit._id}
                  onPress={() => addProductFromCatalog(hit)}
                  disabled={on || products.length >= MAX_PRODUCTS}
                  style={[
                    s.productHit,
                    {
                      borderColor: on ? palette.accent : palette.border,
                      opacity: on || products.length >= MAX_PRODUCTS ? 0.45 : 1,
                    },
                  ]}>
                  {hit.imageUrl ? (
                    <Image source={{uri: hit.imageUrl}} style={{width: '100%', height: 64, borderRadius: 8}} />
                  ) : null}
                  <Text style={{color: palette.foreground, fontSize: 10, fontWeight: '800', marginTop: 6}} numberOfLines={2}>
                    {hit.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {draft.assets.length > 1 && (
          <>
            <SectionHeader icon={<ImageIcon size={16} color={palette.foreground} />} label="Carousel order" s={s} />
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
