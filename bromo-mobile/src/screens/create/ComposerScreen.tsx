import React, {useCallback, useEffect, useState} from 'react';
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
  ShoppingBag,
  UserPlus,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePalette} from '../../config/platform-theme';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {getUserSuggestions, type SuggestedUser} from '../../api/followApi';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Composer'>;

const {width: W} = Dimensions.get('window');

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
  } = useCreateDraft();

  const {tagged, products, poll, location, advanced} = draft;

  const [captionLocal, setCaptionLocal] = useState(draft.caption);
  const [pollA, setPollA] = useState(poll.optionA);
  const [pollB, setPollB] = useState(poll.optionB);
  const [friends, setFriends] = useState<SuggestedUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

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
        {draft.assets.length > 0 && (
          <View style={s.thumbRow}>
            <Image source={{uri: draft.assets[0].uri}} style={s.thumbImg} />
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
        )}

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

        <View style={s.rowTitle}>
          <MapPin size={16} color={palette.foreground} />
          <Pressable style={{flex: 1}} onPress={() => navigation.navigate('LocationPicker')}>
            <Text style={s.labelInline}>{location ? location.name : 'Add location'}</Text>
          </Pressable>
          {location ? (
            <Pressable onPress={() => setLocation(null)}>
              <Text style={s.removeLink}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => navigation.navigate('LocationPicker')}>
              <ChevronRight size={16} color={palette.foregroundSubtle} />
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

        <SectionHeader icon={<UserPlus size={16} color={palette.foreground} />} label="Tag people" s={s} />
        {friendsLoading ? (
          <ActivityIndicator color={palette.foreground} style={{marginVertical: 12}} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 12, gap: 8, paddingBottom: 8}}>
            {friends.slice(0, 12).map(u => {
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

        <Pressable onPress={() => navigation.navigate('ProductPicker')}>
          <SectionHeader
            icon={<ShoppingBag size={16} color={palette.foreground} />}
            label={products.length ? `Products (${products.length}/6)` : 'Tag products'}
            s={s}
            right={<ChevronRight size={16} color={palette.foregroundSubtle} />}
          />
        </Pressable>
        {products.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 12, gap: 10, paddingBottom: 8}}>
            {products.map(p => (
              <Pressable
                key={p.id}
                onPress={() => stickerFromProduct(p)}
                style={{
                  width: 120,
                  backgroundColor: palette.card,
                  borderRadius: 14,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}>
                {p.imageUri ? <Image source={{uri: p.imageUri}} style={{width: '100%', height: 72, borderRadius: 10}} /> : null}
                <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 11, marginTop: 6}} numberOfLines={2}>
                  {p.name}
                </Text>
                <Text style={{color: palette.success, fontSize: 10, fontWeight: '700', marginTop: 2}}>{p.priceLabel}</Text>
              </Pressable>
            ))}
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
