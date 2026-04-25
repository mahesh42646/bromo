import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  View,
  useWindowDimensions,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Video, {ViewType} from 'react-native-video';
import {
  Award,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Globe,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  MessageCircleOff,
  Music2,
  Save,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Type,
  Users,
  X,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {packClientSnapshot, packEditMetaForUpload} from '../../create/draftSnapshot';
import type {CreateDraftState} from '../../create/CreateDraftContext';
import type {MediaAsset, Visibility} from '../../create/createTypes';
import type {FilterId, FeedCategoryPreset} from '../../create/createTypes';
import {
  DEFAULT_ADJUSTMENTS,
  aspectRatioFromCrop,
  normalizeCropForMode,
} from '../../create/createTypes';
import {FILTER_LAYER_STACKS} from '../../create/filterStyles';
import {
  adjustOverlayStyle,
  saturationOverlayStyle,
  vignetteOverlayStyle,
  warmthOverlayStyle,
} from '../../create/editAdjustUtils';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {
  createPost,
  getLocalFileSizeBytes,
  getPost,
  MAX_UPLOAD_BYTES,
  updatePost,
  uploadMedia,
  uploadMediaAsync,
} from '../../api/postsApi';
import {hydrateDraftFromPost} from '../../create/hydrateDraftFromPost';
import {createDraft} from '../../api/draftsApi';
import {searchUsers, type SuggestedUser} from '../../api/followApi';
import {listProducts, type AffiliateProduct} from '../../api/productsApi';
import {searchPlaces, type PlaceItem} from '../../api/placesApi';
import type {ThemePalette} from '../../config/platform-theme';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'ShareFinal'>;

const FEED_CATEGORY_CHIPS: Array<{
  preset: FeedCategoryPreset;
  label: string;
}> = [
  {preset: 'general', label: 'General'},
  {preset: 'politics', label: 'Politics'},
  {preset: 'sports', label: 'Sports'},
  {preset: 'shopping', label: 'Shopping'},
  {preset: 'tech', label: 'Tech'},
];

type SheetKey =
  | 'location'
  | 'people'
  | 'products'
  | 'music'
  | 'poll'
  | 'visibility'
  | 'category'
  | 'advanced'
  | 'story'
  | 'preview';

const AUDIO_CATALOG_FALLBACK = [
  {id: 'a1', title: 'Original audio', artist: 'BROMO Sound'},
  {id: 'a2', title: 'City Nights', artist: 'Lo-Fi Pack'},
  {id: 'a3', title: 'Drill Beat', artist: 'Trending'},
  {id: 'a4', title: 'Acoustic Warm', artist: 'UGC Lite'},
  {id: 'a5', title: 'Trap Vibes', artist: 'Hip Hop'},
  {id: 'a6', title: 'Chill Wave', artist: 'Ambient'},
];

function slugFeedCategory(manual: string, preset: string): string {
  const t = manual
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  return t || preset;
}

function effectiveTrimmedDurationMs(
  draft: CreateDraftState,
  asset: MediaAsset,
): number | undefined {
  if (
    asset.type !== 'video' ||
    typeof asset.duration !== 'number' ||
    !(asset.duration > 0)
  ) {
    return undefined;
  }
  const i = draft.activeAssetIndex;
  const ts = draft.trimStartByAsset[i] ?? 0;
  const te = draft.trimEndByAsset[i] ?? 1;
  const span = (Math.min(1, te) - Math.max(0, ts)) * asset.duration;
  return Math.round(Math.max(0.05, span) * 1000);
}

function buildCaptionWithProducts(
  caption: string,
  hashtags: string[],
  products: {productUrl?: string}[],
): string {
  const head = [caption.trim(), ...hashtags].filter(Boolean).join(' ').trim();
  const links = products
    .map(p => p.productUrl?.trim())
    .filter((u): u is string => Boolean(u));
  if (!links.length) return head;
  return [head, ...links].filter(Boolean).join('\n\n');
}

function toastOk(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
}

function affiliateToAttachment(p: AffiliateProduct) {
  return {
    id: p._id,
    name: p.title,
    priceLabel: `${p.currency} ${p.price.toLocaleString()}`,
    imageUri: p.imageUrl,
    productUrl: p.productUrl,
  };
}

function toDateInputs(value: string | null): {date: string; time: string} {
  const base = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const year = base.getFullYear();
  const month = `${base.getMonth() + 1}`.padStart(2, '0');
  const day = `${base.getDate()}`.padStart(2, '0');
  const hours = `${base.getHours()}`.padStart(2, '0');
  const minutes = `${base.getMinutes()}`.padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

function buildScheduledIso(dateInput: string, timeInput: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeInput.trim());
  if (!dateMatch || !timeMatch) return null;
  const next = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
  if (Number.isNaN(next.getTime())) return null;
  return next.toISOString();
}

/** Generic Instagram-style bottom sheet. */
function ActionSheet({
  visible,
  title,
  subtitle,
  onClose,
  palette,
  children,
  height = 460,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  palette: ThemePalette;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={sheetStyles.root}>
        <Pressable style={sheetStyles.backdrop} onPress={onClose} />
        <View
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: palette.card,
              borderTopColor: palette.hairline,
              maxHeight: '90%',
              minHeight: height,
            },
          ]}>
          <View
            style={[
              sheetStyles.handle,
              {backgroundColor: palette.borderHeavy},
            ]}
          />
          <View style={sheetStyles.headerRow}>
            <View style={{flex: 1}}>
              <Text style={[sheetStyles.title, {color: palette.foreground}]}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    sheetStyles.subtitle,
                    {color: palette.foregroundSubtle},
                  ]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              style={[
                sheetStyles.closeBtn,
                {backgroundColor: palette.surface},
              ]}
              hitSlop={10}>
              <X size={18} color={palette.foregroundMuted} />
            </Pressable>
          </View>
          <View style={sheetStyles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  root: {flex: 1},
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  title: {fontSize: 16, fontWeight: '900'},
  subtitle: {fontSize: 12, fontWeight: '600', marginTop: 2},
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {flex: 1, paddingHorizontal: 18, paddingTop: 6},
});

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    root: {flex: 1, backgroundColor: p.background},

    /* Header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 8,
      gap: 10,
      backgroundColor: p.background,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surface,
    },
    headerTitle: {
      flex: 1,
      color: p.foreground,
      fontSize: 17,
      fontWeight: '900',
      textAlign: 'center',
    },
    shareBtn: {
      paddingHorizontal: 16,
      height: 38,
      minWidth: 76,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.accent,
    },
    shareBtnText: {color: p.accentForeground, fontSize: 14, fontWeight: '900'},

    /* Body scroll */
    body: {flex: 1},
    bodyContent: {paddingBottom: 24},

    /* Compose row */
    composeRow: {
      flexDirection: 'row',
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.hairline,
    },
    composeThumbWrap: {
      width: 64,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: p.surface,
    },
    composeThumb: {width: '100%', height: '100%'},
    composeInputWrap: {
      flex: 1,
      paddingTop: 2,
    },
    captionInput: {
      color: p.foreground,
      fontSize: 15,
      paddingVertical: 4,
      minHeight: 56,
      textAlignVertical: 'top',
    },
    composeMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      gap: 10,
    },
    composeMetaText: {
      fontSize: 11,
      color: p.foregroundSubtle,
      fontWeight: '700',
    },

    /* Action list rows */
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 52,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.hairline,
    },
    actionRowIcon: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionRowLabel: {
      flex: 1,
      color: p.foreground,
      fontSize: 15,
      fontWeight: '600',
    },
    actionRowValue: {
      fontSize: 13,
      color: p.foregroundMuted,
      fontWeight: '700',
      maxWidth: 160,
    },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 6,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.6,
      color: p.foregroundSubtle,
    },

    /* Footer / bottom CTA */
    footerBar: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.hairline,
      backgroundColor: p.card,
      gap: 10,
    },
    footerActionRow: {flexDirection: 'row', gap: 10},
    footerSmallBtn: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      flexDirection: 'row',
    },
    footerSmallText: {color: p.foreground, fontSize: 12, fontWeight: '900'},
    primaryShareBtn: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: p.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryShareText: {
      color: p.accentForeground,
      fontSize: 15,
      fontWeight: '900',
    },

    /* Sheet helpers */
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.input,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 14,
      color: p.foreground,
    },
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    chipSelected: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: p.accent,
      backgroundColor: `${p.accent}1f`,
    },
    chipSelectedText: {
      fontSize: 12,
      fontWeight: '700',
      color: p.accent,
      maxWidth: 180,
    },
    sheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.hairline,
    },
    sheetItemTitle: {
      flex: 1,
      color: p.foreground,
      fontSize: 14,
      fontWeight: '700',
    },
    sheetItemMeta: {
      color: p.foregroundMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    sheetEmpty: {
      color: p.foregroundSubtle,
      fontSize: 13,
      paddingVertical: 16,
      textAlign: 'center',
    },

    /* Poll sheet */
    pollInput: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      borderColor: p.border,
      backgroundColor: p.input,
      color: p.foreground,
    },
    pollAddBtn: {
      minHeight: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
    },
    pollAddBtnText: {color: p.foreground, fontWeight: '800', fontSize: 12},

    /* Visibility / advanced */
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
    },
    optionLabel: {
      flex: 1,
      color: p.foreground,
      fontSize: 14,
      fontWeight: '700',
    },

    /* Category chips */
    categoryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    categoryChipText: {fontSize: 12, fontWeight: '800'},

    /* Schedule modal */
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 20,
      padding: 18,
      gap: 12,
      borderWidth: 1,
      backgroundColor: p.card,
      borderColor: p.border,
    },
    modalTitle: {fontSize: 17, fontWeight: '900', color: p.foreground},
    modalSubtitle: {fontSize: 13, lineHeight: 19, color: p.foregroundMuted},
    modalRow: {flexDirection: 'row', gap: 10},
    modalInput: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      fontSize: 14,
      backgroundColor: p.input,
      borderColor: p.border,
      color: p.foreground,
    },
    modalActions: {flexDirection: 'row', gap: 10, marginTop: 4},

    /* Loader */
    loaderBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.56)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    loaderTitle: {color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 14},
    loaderSubtitle: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 6,
    },

    /* Preview sheet */
    previewSheetWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 4,
    },
    previewSheetBox: {
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: p.borderHeavy,
      backgroundColor: '#000',
    },
  });
}

export function ShareScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<CreateStackParamList, 'ShareFinal'>>();
  const editPostId = route.params?.editPostId?.trim();
  const {width: viewportW} = useWindowDimensions();
  const {palette} = useTheme();
  const styles = makeStyles(palette);
  const {
    draft,
    reset,
    setCaption,
    setHashtags,
    setTagged,
    setLocation,
    setProducts,
    setPoll,
    setSelectedAudio,
    setVisibility,
    setAdvanced,
    setFeedCategoryPreset,
    setFeedCategoryManual,
    setStoryOptions,
    replaceDraft,
  } = useCreateDraft();

  const [editHydrating, setEditHydrating] = useState(Boolean(editPostId));

  const previewShotRef = useRef<ViewShot>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({
    location: null,
    people: null,
    product: null,
  });

  const asset = draft.assets[draft.activeAssetIndex] ?? draft.assets[0];
  const rotation = draft.rotationByAsset[draft.activeAssetIndex] ?? 0;
  const crop = normalizeCropForMode(
    draft.cropByAsset[draft.activeAssetIndex],
    draft.mode,
  );
  const filter = (draft.filterByAsset[draft.activeAssetIndex] ?? 'normal') as FilterId;
  const filterStacks = FILTER_LAYER_STACKS[filter];
  const adjustments =
    draft.adjustByAsset[draft.activeAssetIndex] ?? {...DEFAULT_ADJUSTMENTS};
  const adjustOverlay = adjustOverlayStyle(adjustments);
  const warmOv = warmthOverlayStyle(adjustments);
  const satOv = saturationOverlayStyle(adjustments);
  const vigOv = vignetteOverlayStyle(adjustments);

  const [activeSheet, setActiveSheet] = useState<SheetKey | null>(null);
  const [captionLocal, setCaptionLocal] = useState(draft.caption);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationHits, setLocationHits] = useState<PlaceItem[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleHits, setPeopleHits] = useState<SuggestedUser[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productHits, setProductHits] = useState<AffiliateProduct[]>([]);
  const [busy, setBusy] = useState<'draft' | 'publish' | 'schedule' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(() =>
    toDateInputs(draft.advanced.scheduledAt),
  );
  const [pollLocal, setPollLocal] = useState(() => ({
    question: draft.poll.question,
    options:
      draft.poll.options.length >= 2
        ? [...draft.poll.options]
        : ['Yes', 'No'],
    enabled: draft.poll.enabled,
  }));

  useEffect(() => {
    if (!editPostId) return;
    let alive = true;
    (async () => {
      try {
        const {post} = await getPost(editPostId);
        if (!alive) return;
        const next = hydrateDraftFromPost(post);
        replaceDraft(next);
        setCaptionLocal(next.caption);
        setPollLocal({
          question: next.poll.question,
          options:
            next.poll.options.length >= 2 ? [...next.poll.options] : ['Yes', 'No'],
          enabled: next.poll.enabled,
        });
        setEditHydrating(false);
      } catch {
        if (!alive) return;
        setEditHydrating(false);
        Alert.alert('Could not load post', 'Try again.', [
          {text: 'OK', onPress: () => navigation.goBack()},
        ]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editPostId, navigation, replaceDraft]);

  useEffect(() => {
    if (draft.mode !== 'story') return;
    setCaptionLocal('');
    setCaption('');
    setHashtags([]);
  }, [draft.mode, setCaption, setHashtags]);

  useEffect(() => {
    setCaptionLocal(draft.caption);
  }, [draft.caption]);

  useEffect(() => {
    setScheduleDraft(toDateInputs(draft.advanced.scheduledAt));
  }, [draft.advanced.scheduledAt]);

  useEffect(() => {
    const timers = debounceRefs.current;
    if (timers.location) clearTimeout(timers.location);
    timers.location = setTimeout(async () => {
      const query = locationQuery.trim();
      if (!query) {
        setLocationHits([]);
        return;
      }
      try {
        const {items} = await searchPlaces(query);
        setLocationHits(items);
      } catch {
        setLocationHits([]);
      }
    }, 260);
    return () => {
      if (timers.location) clearTimeout(timers.location);
    };
  }, [locationQuery]);

  useEffect(() => {
    const timers = debounceRefs.current;
    if (timers.people) clearTimeout(timers.people);
    timers.people = setTimeout(async () => {
      const query = peopleQuery.trim();
      if (!query) {
        setPeopleHits([]);
        return;
      }
      try {
        const {users} = await searchUsers(query);
        setPeopleHits(users.slice(0, 12));
      } catch {
        setPeopleHits([]);
      }
    }, 260);
    return () => {
      if (timers.people) clearTimeout(timers.people);
    };
  }, [peopleQuery]);

  useEffect(() => {
    const timers = debounceRefs.current;
    if (timers.product) clearTimeout(timers.product);
    timers.product = setTimeout(async () => {
      const query = productQuery.trim();
      if (!query) {
        setProductHits([]);
        return;
      }
      try {
        const {items} = await listProducts(query, undefined, 12);
        setProductHits(items);
      } catch {
        setProductHits([]);
      }
    }, 260);
    return () => {
      if (timers.product) clearTimeout(timers.product);
    };
  }, [productQuery]);

  const syncCaption = useCallback(
    (next: string) => {
      setCaption(next);
      setHashtags(next.match(/#[\w\u0900-\u0fff]+/g) ?? []);
      setAdvanced({altText: next.trim()});
    },
    [setAdvanced, setCaption, setHashtags],
  );

  const closeSheet = useCallback(() => setActiveSheet(null), []);
  const openSheet = useCallback((key: SheetKey) => setActiveSheet(key), []);

  const closeAll = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [navigation, reset]);

  const aspect = aspectRatioFromCrop(crop);
  const previewBoxW = Math.min(viewportW * 0.75, 320);
  const previewBoxH = previewBoxW / aspect;

  const saveDraftNow = useCallback(async () => {
    if (editPostId) {
      Alert.alert('Drafts', 'Save as draft is only for new posts.');
      return;
    }
    if (!asset) {
      Alert.alert('No media', 'Add something to save.');
      return;
    }
    setBusy('draft');
    try {
      const feedCategory = slugFeedCategory(
        draft.feedCategoryManual,
        draft.feedCategoryPreset,
      );
      const caption = buildCaptionWithProducts(
        draft.caption,
        draft.hashtags,
        draft.products,
      );
      await createDraft({
        type: draft.mode === 'live' ? 'reel' : draft.mode,
        localUri: asset.uri,
        thumbnailUri: asset.uri,
        mediaType: asset.type,
        caption,
        location: draft.location?.name ?? '',
        locationMeta:
          draft.location?.lat != null && draft.location?.lng != null
            ? {
                name: draft.location.name,
                lat: draft.location.lat,
                lng: draft.location.lng,
              }
            : undefined,
        tags: draft.hashtags,
        taggedUserIds: draft.tagged.map(t => t.id),
        productIds: draft.products.map(p => p.id),
        music: draft.selectedAudio?.title ?? '',
        feedCategory,
        filters: packClientSnapshot(draft),
        settings: {
          commentsOff: draft.advanced.commentsOff,
          hideLikes: draft.advanced.hideLikeCount,
          allowRemix: true,
          closeFriendsOnly: draft.visibility === 'close_friends',
        },
        durationMs: effectiveTrimmedDurationMs(draft, asset),
      });
      toastOk('Draft saved');
      Alert.alert('Saved', 'Your draft is ready whenever you come back.', [
        {text: 'OK', onPress: closeAll},
      ]);
    } catch (e) {
      Alert.alert(
        'Could not save draft',
        e instanceof Error ? e.message : 'Try again',
      );
    } finally {
      setBusy(null);
    }
  }, [asset, closeAll, draft, editPostId]);

  const downloadExport = useCallback(async () => {
    if (!asset) return;
    try {
      const captured = await previewShotRef.current?.capture?.();
      if (captured) {
        await CameraRoll.save(captured, {type: 'photo'});
      } else {
        await CameraRoll.save(asset.uri, {
          type: asset.type === 'video' ? 'video' : 'photo',
        });
      }
      toastOk('Saved to gallery');
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Try again',
      );
    }
  }, [asset]);

  const publish = useCallback(
    async (scheduledAt?: string | null) => {
      if (!asset) {
        Alert.alert('No media', 'Please add a photo or video first.');
        return;
      }
      const isRemoteAsset =
        asset.uri.startsWith('http://') || asset.uri.startsWith('https://');
      if (asset.type === 'video' && !isRemoteAsset) {
        const sz = await getLocalFileSizeBytes(asset.uri);
        if (sz != null && sz > MAX_UPLOAD_BYTES) {
          Alert.alert(
            'File too large',
            `Videos can be up to ${Math.round(
              MAX_UPLOAD_BYTES / (1024 * 1024),
            )} MB. Pick a shorter clip or lower resolution.`,
          );
          return;
        }
      }

      const scheduleIso = scheduledAt ?? draft.advanced.scheduledAt;
      if (editPostId && scheduleIso) {
        Alert.alert('Schedule', 'Editing does not support scheduling.');
        return;
      }
      if (scheduleIso) {
        const when = new Date(scheduleIso);
        if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
          Alert.alert(
            'Invalid schedule',
            'Choose a future date and time for scheduled publishing.',
          );
          return;
        }
      }

      setBusy(scheduleIso ? 'schedule' : 'publish');
      setUploadProgress(0);
      try {
        if (editPostId) {
          const locationMeta = draft.location?.name
            ? {
                name: draft.location.name,
                lat: draft.location.lat,
                lng: draft.location.lng,
                address: draft.location.address,
                placeId: draft.location.placeId,
              }
            : undefined;
          const settings = {
            commentsOff: draft.advanced.commentsOff,
            hideLikes: draft.advanced.hideLikeCount,
            allowRemix: true,
            closeFriendsOnly: draft.visibility === 'close_friends',
          };
          const captionBuilt =
            draft.mode === 'story'
              ? ''
              : buildCaptionWithProducts(
                  draft.caption,
                  draft.hashtags,
                  draft.products,
                ) || '';
          const feedCategoryForPatch =
            draft.mode === 'story'
              ? undefined
              : draft.visibility === 'followers'
              ? 'followers'
              : slugFeedCategory(
                  draft.feedCategoryManual,
                  draft.feedCategoryPreset,
                );
          const pollBody =
            draft.mode === 'post' || draft.mode === 'reel'
              ? draft.poll.enabled &&
                draft.poll.options.filter(Boolean).length >= 2
                ? {
                    question: draft.poll.question.trim(),
                    options: draft.poll.options
                      .map(o => o.trim())
                      .filter(Boolean)
                      .slice(0, 4),
                  }
                : null
              : undefined;
          let clientEditMeta: Record<string, unknown> | undefined;
          try {
            clientEditMeta = JSON.parse(
              packEditMetaForUpload(draft),
            ) as Record<string, unknown>;
          } catch {
            clientEditMeta = undefined;
          }
          await updatePost(editPostId, {
            caption: captionBuilt,
            location: draft.location?.name ?? '',
            locationMeta: locationMeta ?? null,
            music: draft.selectedAudio?.title ?? '',
            tags: draft.tagged.map(t => t.username),
            taggedUserIds: draft.tagged.map(t => t.id).filter(Boolean),
            productIds: draft.products.map(p => p.id).filter(Boolean),
            settings,
            ...(typeof feedCategoryForPatch === 'string' &&
            feedCategoryForPatch.length > 0
              ? {feedCategory: feedCategoryForPatch}
              : {}),
            ...(pollBody !== undefined ? {poll: pollBody} : {}),
            ...(clientEditMeta && Object.keys(clientEditMeta).length > 0
              ? {clientEditMeta}
              : {}),
          });
          toastOk('Saved');
          Alert.alert('Saved', 'Your changes are live.', [
            {text: 'OK', onPress: closeAll},
          ]);
          return;
        }
        const uploadCategory: 'reels' | 'stories' | 'posts' =
          draft.mode === 'reel'
            ? 'reels'
            : draft.mode === 'story'
            ? 'stories'
            : 'posts';
        const caption =
          draft.mode === 'story'
            ? ''
            : buildCaptionWithProducts(
                draft.caption,
                draft.hashtags,
                draft.products,
              ) || undefined;
        const feedCategory =
          draft.mode === 'story'
            ? undefined
            : slugFeedCategory(
                draft.feedCategoryManual,
                draft.feedCategoryPreset,
              );

        const locationMeta = draft.location?.name
          ? {
              name: draft.location.name,
              lat: draft.location.lat,
              lng: draft.location.lng,
              address: draft.location.address,
              placeId: draft.location.placeId,
            }
          : undefined;

        const settings = {
          commentsOff: draft.advanced.commentsOff,
          hideLikes: draft.advanced.hideLikeCount,
          allowRemix: true,
          closeFriendsOnly: draft.visibility === 'close_friends',
        };

        const taggedUserIds = draft.tagged.map(t => t.id).filter(Boolean);
        const productIds = draft.products.map(p => p.id).filter(Boolean);
        const pollPayload =
          draft.poll.enabled && draft.poll.options.filter(Boolean).length >= 2
            ? {
                question: draft.poll.question.trim(),
                options: draft.poll.options
                  .map(o => o.trim())
                  .filter(Boolean)
                  .slice(0, 4),
              }
            : undefined;
        const durationMs = effectiveTrimmedDurationMs(draft, asset);
        const clientEditMeta = packEditMetaForUpload(draft);
        const useAsync =
          asset.type === 'video' &&
          (draft.mode === 'reel' ||
            draft.mode === 'story' ||
            draft.mode === 'post');

        if (useAsync) {
          await uploadMediaAsync(
            asset.uri,
            {
              type: asset.type,
              fileName: asset.fileName,
              category: uploadCategory,
              caption,
              location: draft.location?.name,
              music: draft.selectedAudio?.title,
              tags: draft.tagged.map(t => t.username),
              feedCategory,
              taggedUserIds,
              productIds,
              locationMeta: locationMeta ?? null,
              settings,
              durationMs,
              clientEditMeta,
              scheduledFor: scheduleIso ?? undefined,
            },
            pct => setUploadProgress(pct),
          );
        } else {
          const {
            url,
            thumbnailUrl,
            mediaType: mediaTypeFromServer,
          } = await uploadMedia(asset.uri, {
            type: asset.type,
            fileName: asset.fileName,
            category: uploadCategory,
          });
          const mediaType =
            mediaTypeFromServer ?? (asset.type === 'video' ? 'video' : 'image');
          const postType =
            draft.mode === 'reel'
              ? 'reel'
              : draft.mode === 'story'
              ? 'story'
              : 'post';
          await createPost({
            type: postType,
            mediaUrl: url,
            thumbnailUrl,
            mediaType,
            caption,
            location: draft.location?.name,
            locationMeta: locationMeta ?? undefined,
            music: draft.selectedAudio?.title,
            tags: draft.tagged.map(t => t.username),
            taggedUserIds,
            productIds,
            settings,
            durationMs,
            clientEditMeta,
            poll: pollPayload,
            ...(postType !== 'story' && feedCategory ? {feedCategory} : {}),
            scheduledFor: scheduleIso ?? undefined,
          });
        }

        toastOk(scheduleIso ? 'Scheduled' : 'Posted');
        Alert.alert(
          scheduleIso ? 'Scheduled' : 'Done',
          scheduleIso
            ? 'Your content is scheduled and will publish automatically.'
            : useAsync
            ? 'Upload finished. We are processing it in the background now.'
            : 'Your content is live.',
          [{text: 'OK', onPress: closeAll}],
        );
      } catch (err) {
        Alert.alert(
          scheduleIso ? 'Failed to schedule' : 'Failed to post',
          err instanceof Error ? err.message : 'Try again',
        );
      } finally {
        setBusy(null);
      }
    },
    [asset, closeAll, draft, editPostId],
  );

  const visibilityOptions: {
    key: Visibility;
    label: string;
    Icon: typeof Globe;
  }[] = useMemo(
    () =>
      draft.mode === 'story'
        ? [
            {key: 'public', label: 'Your story (followers)', Icon: Users},
            {key: 'close_friends', label: 'Close Friends', Icon: Heart},
          ]
        : [
            {key: 'public', label: 'Anyone', Icon: Globe},
            {key: 'followers', label: 'Followers only', Icon: Users},
            {key: 'private', label: 'Only me', Icon: Lock},
          ],
    [draft.mode],
  );

  const visibilityLabel = useMemo(
    () =>
      visibilityOptions.find(item => item.key === draft.visibility)?.label ??
      'Anyone',
    [visibilityOptions, draft.visibility],
  );

  const discard = useCallback(() => {
    Alert.alert('Discard?', 'Your edits will be lost.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: closeAll},
    ]);
  }, [closeAll]);

  const taggedSummary = useMemo(() => {
    if (!draft.tagged.length) return undefined;
    const first = draft.tagged[0].username;
    return draft.tagged.length > 1
      ? `${first} +${draft.tagged.length - 1}`
      : first;
  }, [draft.tagged]);

  const productSummary = useMemo(() => {
    if (!draft.products.length) return undefined;
    return draft.products.length === 1
      ? draft.products[0].name
      : `${draft.products.length} products`;
  }, [draft.products]);

  const categorySummary = useMemo(() => {
    if (draft.feedCategoryManual.trim())
      return `#${draft.feedCategoryManual.trim()}`;
    return (
      FEED_CATEGORY_CHIPS.find(c => c.preset === draft.feedCategoryPreset)
        ?.label ?? 'General'
    );
  }, [draft.feedCategoryManual, draft.feedCategoryPreset]);

  const advancedActiveCount =
    (draft.advanced.commentsOff ? 1 : 0) +
    (draft.advanced.hideLikeCount ? 1 : 0) +
    (draft.advanced.brandedContent ? 1 : 0) +
    (draft.advanced.shareToStory ? 1 : 0);

  /** Apply local poll edits back to context. */
  const commitPoll = useCallback(() => {
    const cleaned = pollLocal.options
      .map(o => o.trim())
      .filter(Boolean)
      .slice(0, 4);
    setPoll({
      enabled: pollLocal.enabled && cleaned.length >= 2,
      question: pollLocal.question.trim(),
      options: cleaned.length >= 2 ? cleaned : ['Yes', 'No'],
    });
    setActiveSheet(null);
  }, [pollLocal, setPoll]);

  if (!asset) {
    if (editPostId && editHydrating) {
      return (
        <ThemedSafeScreen style={styles.root}>
          <View style={[styles.header, {justifyContent: 'center'}]}>
            <Text style={styles.headerTitle}>Loading…</Text>
          </View>
          <View
            style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        </ThemedSafeScreen>
      );
    }
    return (
      <ThemedSafeScreen style={styles.root}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            hitSlop={12}>
            <ChevronLeft size={26} color={palette.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>New post</Text>
          <View style={{width: 38}} />
        </View>
        <View
          style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <Text style={{color: palette.foreground}}>No media selected.</Text>
        </View>
      </ThemedSafeScreen>
    );
  }

  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editPostId
            ? 'Edit'
            : `New ${
                draft.mode === 'story'
                  ? 'story'
                  : draft.mode === 'reel'
                  ? 'reel'
                  : 'post'
              }`}
        </Text>
        <Pressable
          style={styles.shareBtn}
          onPress={() => publish(null)}
          disabled={busy !== null}>
          <Text style={styles.shareBtnText}>
            {editPostId ? 'Save changes' : 'Share'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled">
        {/* Compose row: small thumb + caption (stories: no caption) */}
        <View style={styles.composeRow}>
          <Pressable
            onPress={() => openSheet('preview')}
            style={[styles.composeThumbWrap, {height: 64 / Math.max(0.4, aspect)}]}>
            {asset.type === 'video' ? (
              <Video
                source={{uri: asset.uri}}
                style={styles.composeThumb}
                resizeMode="cover"
                paused
                muted
                viewType={
                  Platform.OS === 'android' ? ViewType.TEXTURE : undefined
                }
                shutterColor="transparent"
              />
            ) : (
              <Image
                source={{uri: asset.uri}}
                style={[
                  styles.composeThumb,
                  {transform: [{rotate: `${rotation}deg`}]},
                ]}
                resizeMode="cover"
              />
            )}
          </Pressable>
          {draft.mode === 'story' ? (
            <View style={[styles.composeInputWrap, {justifyContent: 'center'}]}>
              <View style={styles.composeMetaRow}>
                <Text style={styles.composeMetaText}>
                  {asset.type === 'video' ? 'Video' : 'Photo'}
                  {draft.assets.length > 1
                    ? ` · ${draft.assets.length} items`
                    : ''}
                </Text>
                <Text style={styles.composeMetaText}>· Tap thumb to preview</Text>
              </View>
            </View>
          ) : (
            <View style={styles.composeInputWrap}>
              <TextInput
                value={captionLocal}
                onChangeText={next => {
                  setCaptionLocal(next);
                  syncCaption(next);
                }}
                placeholder="Write a caption..."
                placeholderTextColor={palette.placeholder}
                multiline
                style={[styles.captionInput, {borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10}]}
           
              />
              <View style={styles.composeMetaRow}>
                <Text style={styles.composeMetaText}>
                  {asset.type === 'video' ? 'Video' : 'Photo'}
                  {draft.assets.length > 1
                    ? ` · ${draft.assets.length} items`
                    : ''}
                </Text>
                <Text style={styles.composeMetaText}>· Tap thumb to preview</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action rows */}
        <ActionListRow
          icon={<Tag size={18} color={palette.foreground} />}
          label="Tag people"
          value={taggedSummary}
          onPress={() => openSheet('people')}
          styles={styles}
          palette={palette}
        />
        <ActionListRow
          icon={<MapPin size={18} color={palette.foreground} />}
          label="Add location"
          value={draft.location?.name}
          onPress={() => openSheet('location')}
          styles={styles}
          palette={palette}
        />
        <ActionListRow
          icon={<Music2 size={18} color={palette.foreground} />}
          label="Add music"
          value={draft.selectedAudio?.title}
          onPress={() => openSheet('music')}
          styles={styles}
          palette={palette}
        />
        <ActionListRow
          icon={<ShoppingBag size={18} color={palette.foreground} />}
          label="Tag products"
          value={productSummary}
          onPress={() => openSheet('products')}
          styles={styles}
          palette={palette}
        />
        {(draft.mode === 'post' || draft.mode === 'reel') && (
          <ActionListRow
            icon={<MessageCircle size={18} color={palette.foreground} />}
            label="Add poll"
            value={
              draft.poll.enabled && draft.poll.options.length >= 2
                ? draft.poll.question || 'Active'
                : undefined
            }
            onPress={() => {
              setPollLocal({
                question: draft.poll.question,
                options:
                  draft.poll.options.length >= 2
                    ? [...draft.poll.options]
                    : ['Yes', 'No'],
                enabled: draft.poll.enabled,
              });
              openSheet('poll');
            }}
            styles={styles}
            palette={palette}
          />
        )}

        {(draft.mode === 'post' || draft.mode === 'reel') && (
          <ActionListRow
            icon={<Sparkles size={18} color={palette.foreground} />}
            label="Feed category"
            value={categorySummary}
            onPress={() => openSheet('category')}
            styles={styles}
            palette={palette}
          />
        )}

        <Text style={styles.sectionHeader}>Audience &amp; settings</Text>

        <ActionListRow
          icon={<Globe size={18} color={palette.foreground} />}
          label="Audience"
          value={visibilityLabel}
          onPress={() => openSheet('visibility')}
          styles={styles}
          palette={palette}
        />
        <ActionListRow
          icon={<EyeOff size={18} color={palette.foreground} />}
          label="Advanced settings"
          value={advancedActiveCount ? `${advancedActiveCount} on` : undefined}
          onPress={() => openSheet('advanced')}
          styles={styles}
          palette={palette}
        />
        {draft.mode === 'story' ? (
          <ActionListRow
            icon={<Share2 size={18} color={palette.foreground} />}
            label="Story options"
            value={
              draft.storyAllowReplies || draft.storyShareOffPlatform
                ? 'Custom'
                : 'Defaults'
            }
            onPress={() => openSheet('story')}
            styles={styles}
            palette={palette}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footerBar}>
        <View style={styles.footerActionRow}>
          <Pressable style={styles.footerSmallBtn} onPress={discard}>
            <Trash2 size={14} color={palette.destructive} />
            <Text style={[styles.footerSmallText, {color: palette.destructive}]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={styles.footerSmallBtn}
            onPress={saveDraftNow}
            disabled={busy !== null}>
            <Save size={14} color={palette.foreground} />
            <Text style={styles.footerSmallText}>Draft</Text>
          </Pressable>
          <Pressable style={styles.footerSmallBtn} onPress={downloadExport}>
            <Download size={14} color={palette.foreground} />
            <Text style={styles.footerSmallText}>Save</Text>
          </Pressable>
          <Pressable
            style={styles.footerSmallBtn}
            onPress={() => setScheduleOpen(true)}
            disabled={busy !== null || Boolean(editPostId)}>
            <Calendar size={14} color={palette.foreground} />
            <Text style={styles.footerSmallText}>Schedule</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.primaryShareBtn}
          onPress={() => publish(null)}
          disabled={busy !== null}>
          <Send size={18} color={palette.accentForeground} />
          <Text style={styles.primaryShareText}>
            {editPostId
              ? 'Save changes'
              : draft.mode === 'story'
              ? 'Share story'
              : draft.mode === 'reel'
              ? 'Share reel'
              : 'Share post'}
          </Text>
        </Pressable>
      </View>

      {/* === Sub-sheets === */}

      {/* Preview (live preview matching what will be uploaded) */}
      <ActionSheet
        visible={activeSheet === 'preview'}
        onClose={closeSheet}
        title="Preview"
        subtitle="This is how your post will appear"
        palette={palette}
        height={previewBoxH + 100}>
        <View style={styles.previewSheetWrap}>
          <ViewShot
            ref={previewShotRef}
            style={[
              styles.previewSheetBox,
              {width: previewBoxW, height: previewBoxH},
            ]}
            options={{format: 'jpg', quality: 0.92}}>
            {asset.type === 'video' ? (
              <Video
                source={{uri: asset.uri}}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
                repeat
                muted
                viewType={
                  Platform.OS === 'android' ? ViewType.TEXTURE : undefined
                }
                shutterColor="transparent"
              />
            ) : (
              <Image
                source={{uri: asset.uri}}
                style={[
                  StyleSheet.absoluteFillObject,
                  {transform: [{rotate: `${rotation}deg`}]},
                ]}
                resizeMode="cover"
              />
            )}
            {filterStacks.map((layer, idx) => (
              <View
                key={`layer_${idx}`}
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: layer.backgroundColor,
                    opacity: layer.opacity,
                  },
                ]}
              />
            ))}
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, adjustOverlay]}
            />
            {warmOv ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, warmOv]}
              />
            ) : null}
            {satOv ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, satOv]}
              />
            ) : null}
            {vigOv ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, vigOv]}
              />
            ) : null}
            {draft.textOverlays.map(o => (
              <View
                key={o.id}
                style={{position: 'absolute', left: o.x, top: o.y}}>
                <Text
                  style={{
                    color: o.color,
                    fontSize: o.fontSize,
                    fontWeight: o.fontStyle === 'bold' ? '900' : '600',
                    fontStyle: o.fontStyle === 'italic' ? 'italic' : 'normal',
                  }}>
                  {o.text}
                </Text>
              </View>
            ))}
            {draft.stickers.map(sticker => (
              <View
                key={sticker.id}
                style={{
                  position: 'absolute',
                  left: sticker.x,
                  top: sticker.y,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                }}>
                <ShoppingBag size={10} color="#fff" />
                <Text
                  style={{color: '#fff', fontSize: 11, fontWeight: '800'}}>
                  {sticker.label}
                </Text>
              </View>
            ))}
          </ViewShot>
        </View>
      </ActionSheet>

      {/* People */}
      <ActionSheet
        visible={activeSheet === 'people'}
        onClose={closeSheet}
        title="Tag people"
        subtitle="Mentioned users get a notification"
        palette={palette}>
        <View style={styles.searchBox}>
          <Search size={16} color={palette.foregroundMuted} />
          <TextInput
            value={peopleQuery}
            onChangeText={setPeopleQuery}
            placeholder="Search people"
            placeholderTextColor={palette.placeholder}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {draft.tagged.length ? (
          <View style={[styles.chipRow, {marginBottom: 10}]}>
            {draft.tagged.map(person => (
              <Pressable
                key={person.id}
                onPress={() =>
                  setTagged(draft.tagged.filter(item => item.id !== person.id))
                }
                style={styles.chipSelected}>
                <Users size={12} color={palette.accent} />
                <Text style={styles.chipSelectedText}>@{person.username}</Text>
                <X size={12} color={palette.accent} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {peopleHits.length ? (
            peopleHits.map(person => {
              const active = draft.tagged.some(item => item.id === person._id);
              return (
                <Pressable
                  key={person._id}
                  onPress={() => {
                    if (active) {
                      setTagged(
                        draft.tagged.filter(item => item.id !== person._id),
                      );
                    } else {
                      setTagged([
                        ...draft.tagged,
                        {
                          id: person._id,
                          username: person.username,
                          avatar: person.profilePicture || undefined,
                        },
                      ]);
                    }
                  }}
                  style={styles.sheetItem}>
                  <View style={styles.actionRowIcon}>
                    <Users size={18} color={palette.foregroundMuted} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.sheetItemTitle}>
                      @{person.username}
                    </Text>
                    {person.displayName ? (
                      <Text style={styles.sheetItemMeta}>
                        {person.displayName}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <Check size={18} color={palette.accent} />
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.sheetEmpty}>
              {peopleQuery
                ? 'No people match that search'
                : 'Search to find people you know'}
            </Text>
          )}
        </ScrollView>
      </ActionSheet>

      {/* Location */}
      <ActionSheet
        visible={activeSheet === 'location'}
        onClose={closeSheet}
        title="Add location"
        palette={palette}>
        <View style={styles.searchBox}>
          <Search size={16} color={palette.foregroundMuted} />
          <TextInput
            value={locationQuery}
            onChangeText={setLocationQuery}
            placeholder={draft.location?.name ?? 'Search a place'}
            placeholderTextColor={palette.placeholder}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {draft.location ? (
            <Pressable
              onPress={() => setLocation(null)}
              hitSlop={8}
              style={{padding: 4}}>
              <X size={16} color={palette.foregroundMuted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {draft.location ? (
            <View style={styles.sheetItem}>
              <View style={styles.actionRowIcon}>
                <MapPin size={18} color={palette.accent} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.sheetItemTitle}>{draft.location.name}</Text>
                {draft.location.address ? (
                  <Text style={styles.sheetItemMeta}>
                    {draft.location.address}
                  </Text>
                ) : null}
              </View>
              <Check size={18} color={palette.accent} />
            </View>
          ) : null}
          {locationHits.length ? (
            locationHits.map((place, idx) => {
              const placeKey = place.placeId ?? `${place.name}_${idx}`;
              return (
              <Pressable
                key={placeKey}
                style={styles.sheetItem}
                onPress={() => {
                  setLocation({
                    id: placeKey,
                    name: place.name,
                    address: place.address,
                    lat: place.lat,
                    lng: place.lng,
                    placeId: place.placeId,
                  });
                  closeSheet();
                }}>
                <View style={styles.actionRowIcon}>
                  <MapPin size={18} color={palette.foregroundMuted} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.sheetItemTitle}>{place.name}</Text>
                  {place.address ? (
                    <Text style={styles.sheetItemMeta}>{place.address}</Text>
                  ) : null}
                </View>
              </Pressable>
              );
            })
          ) : (
            <Text style={styles.sheetEmpty}>
              {locationQuery
                ? 'No places found yet'
                : 'Type a place to start searching'}
            </Text>
          )}
        </ScrollView>
      </ActionSheet>

      {/* Music */}
      <ActionSheet
        visible={activeSheet === 'music'}
        onClose={closeSheet}
        title="Add music"
        subtitle={
          draft.selectedAudio
            ? `Now: ${draft.selectedAudio.title}`
            : 'Pick a track or keep original'
        }
        palette={palette}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => {
              setSelectedAudio(null);
              closeSheet();
            }}
            style={styles.sheetItem}>
            <View style={styles.actionRowIcon}>
              <Music2 size={18} color={palette.foregroundMuted} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.sheetItemTitle}>Original audio</Text>
              <Text style={styles.sheetItemMeta}>Use the clip&rsquo;s own sound</Text>
            </View>
            {!draft.selectedAudio ? (
              <Check size={18} color={palette.accent} />
            ) : null}
          </Pressable>
          {AUDIO_CATALOG_FALLBACK.map(track => {
            const active = draft.selectedAudio?.id === track.id;
            return (
              <Pressable
                key={track.id}
                style={styles.sheetItem}
                onPress={() => {
                  setSelectedAudio(track);
                  closeSheet();
                }}>
                <View style={styles.actionRowIcon}>
                  <Music2 size={18} color={palette.foregroundMuted} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.sheetItemTitle}>{track.title}</Text>
                  <Text style={styles.sheetItemMeta}>{track.artist}</Text>
                </View>
                {active ? <Check size={18} color={palette.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </ActionSheet>

      {/* Products */}
      <ActionSheet
        visible={activeSheet === 'products'}
        onClose={closeSheet}
        title="Tag products"
        subtitle="Tagged products show as small stickers"
        palette={palette}>
        <View style={styles.searchBox}>
          <Search size={16} color={palette.foregroundMuted} />
          <TextInput
            value={productQuery}
            onChangeText={setProductQuery}
            placeholder="Search products"
            placeholderTextColor={palette.placeholder}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {draft.products.length ? (
          <View style={[styles.chipRow, {marginBottom: 10}]}>
            {draft.products.map(product => (
              <Pressable
                key={product.id}
                onPress={() =>
                  setProducts(
                    draft.products.filter(item => item.id !== product.id),
                  )
                }
                style={styles.chipSelected}>
                <ShoppingBag size={12} color={palette.accent} />
                <Text
                  numberOfLines={1}
                  style={styles.chipSelectedText}>
                  {product.name}
                </Text>
                <X size={12} color={palette.accent} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {productHits.length ? (
            productHits.map(product => {
              const active = draft.products.some(
                item => item.id === product._id,
              );
              return (
                <Pressable
                  key={product._id}
                  onPress={() => {
                    if (active) {
                      setProducts(
                        draft.products.filter(item => item.id !== product._id),
                      );
                    } else {
                      setProducts([
                        ...draft.products,
                        affiliateToAttachment(product),
                      ]);
                    }
                  }}
                  style={styles.sheetItem}>
                  <View style={styles.actionRowIcon}>
                    <ShoppingBag size={18} color={palette.foregroundMuted} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.sheetItemTitle} numberOfLines={2}>
                      {product.title}
                    </Text>
                    <Text style={styles.sheetItemMeta} numberOfLines={1}>
                      {product.currency} {product.price}
                    </Text>
                  </View>
                  {active ? (
                    <Check size={18} color={palette.accent} />
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.sheetEmpty}>
              {productQuery
                ? 'No products match yet'
                : 'Search to tag products'}
            </Text>
          )}
        </ScrollView>
      </ActionSheet>

      {/* Poll */}
      <ActionSheet
        visible={activeSheet === 'poll'}
        onClose={() => {
          commitPoll();
        }}
        title="Add poll"
        subtitle="Poll appears in the caption · 1 vote per user"
        palette={palette}
        height={420}>
        <View style={{gap: 10}}>
          <View style={styles.optionRow}>
            <Type size={16} color={palette.foreground} />
            <Text style={styles.optionLabel}>Enable poll</Text>
            <Switch
              value={pollLocal.enabled}
              onValueChange={enabled =>
                setPollLocal(prev => ({...prev, enabled}))
              }
            />
          </View>
          <TextInput
            value={pollLocal.question}
            onChangeText={question =>
              setPollLocal(prev => ({...prev, question}))
            }
            placeholder="Ask a question"
            placeholderTextColor={palette.placeholder}
            style={styles.pollInput}
          />
          {pollLocal.options.map((opt, idx) => (
            <View
              key={`opt_${idx}`}
              style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <TextInput
                value={opt}
                onChangeText={next =>
                  setPollLocal(prev => ({
                    ...prev,
                    options: prev.options.map((o, i) => (i === idx ? next : o)),
                  }))
                }
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor={palette.placeholder}
                style={[styles.pollInput, {flex: 1}]}
                maxLength={48}
              />
              {pollLocal.options.length > 2 ? (
                <Pressable
                  onPress={() =>
                    setPollLocal(prev => ({
                      ...prev,
                      options: prev.options.filter((_, i) => i !== idx),
                    }))
                  }
                  hitSlop={8}
                  style={{padding: 8}}>
                  <X size={18} color={palette.foregroundMuted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {pollLocal.options.length < 4 ? (
            <Pressable
              style={styles.pollAddBtn}
              onPress={() =>
                setPollLocal(prev => ({
                  ...prev,
                  options: [...prev.options, ''],
                }))
              }>
              <Text style={styles.pollAddBtnText}>+ Add option</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.primaryShareBtn, {marginTop: 8}]}
            onPress={commitPoll}>
            <Text style={styles.primaryShareText}>Save poll</Text>
          </Pressable>
        </View>
      </ActionSheet>

      {/* Visibility */}
      <ActionSheet
        visible={activeSheet === 'visibility'}
        onClose={closeSheet}
        title="Audience"
        palette={palette}
        height={300}>
        <View style={{gap: 8}}>
          {visibilityOptions.map(option => {
            const selected = draft.visibility === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  setVisibility(option.key);
                  closeSheet();
                }}
                style={[
                  styles.optionRow,
                  selected && {borderColor: palette.accent},
                ]}>
                <option.Icon
                  size={18}
                  color={selected ? palette.accent : palette.foregroundMuted}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    {color: selected ? palette.accent : palette.foreground},
                  ]}>
                  {option.label}
                </Text>
                {selected ? (
                  <Check size={18} color={palette.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ActionSheet>

      {/* Feed Category */}
      <ActionSheet
        visible={activeSheet === 'category'}
        onClose={closeSheet}
        title="Feed category"
        subtitle="Helps your post reach the right feed"
        palette={palette}
        height={320}>
        <View style={[styles.categoryRow, {marginBottom: 14}]}>
          {FEED_CATEGORY_CHIPS.map(category => {
            const active =
              draft.feedCategoryManual.trim() === '' &&
              draft.feedCategoryPreset === category.preset;
            return (
              <Pressable
                key={category.preset}
                onPress={() => setFeedCategoryPreset(category.preset)}
                style={[
                  styles.categoryChip,
                  {
                    borderColor: active ? palette.accent : palette.border,
                    backgroundColor: active ? palette.accent : palette.surface,
                  },
                ]}>
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: active
                        ? palette.accentForeground
                        : palette.foreground,
                    },
                  ]}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={draft.feedCategoryManual}
          onChangeText={setFeedCategoryManual}
          placeholder="Custom category (e.g. fitness)"
          placeholderTextColor={palette.placeholder}
          style={styles.pollInput}
        />
      </ActionSheet>

      {/* Advanced */}
      <ActionSheet
        visible={activeSheet === 'advanced'}
        onClose={closeSheet}
        title="Advanced settings"
        palette={palette}
        height={420}>
        <View style={{gap: 8}}>
          <ToggleRow
            icon={<MessageCircleOff size={16} color={palette.foreground} />}
            label="Turn off comments"
            value={draft.advanced.commentsOff}
            onToggle={value => setAdvanced({commentsOff: value})}
            styles={styles}
            palette={palette}
          />
          <ToggleRow
            icon={<EyeOff size={16} color={palette.foreground} />}
            label="Hide like count"
            value={draft.advanced.hideLikeCount}
            onToggle={value => setAdvanced({hideLikeCount: value})}
            styles={styles}
            palette={palette}
          />
          <ToggleRow
            icon={<Award size={16} color={palette.foreground} />}
            label="Branded content"
            value={draft.advanced.brandedContent}
            onToggle={value => setAdvanced({brandedContent: value})}
            styles={styles}
            palette={palette}
          />
          {draft.mode === 'post' ? (
            <ToggleRow
              icon={<Share2 size={16} color={palette.foreground} />}
              label="Also share to your story"
              value={draft.advanced.shareToStory}
              onToggle={value => setAdvanced({shareToStory: value})}
              styles={styles}
              palette={palette}
            />
          ) : null}
        </View>
      </ActionSheet>

      {/* Story options */}
      {draft.mode === 'story' ? (
        <ActionSheet
          visible={activeSheet === 'story'}
          onClose={closeSheet}
          title="Story options"
          palette={palette}
          height={300}>
          <View style={{gap: 8}}>
            <ToggleRow
              icon={<MessageCircle size={16} color={palette.foreground} />}
              label="Allow replies"
              value={draft.storyAllowReplies}
              onToggle={value => setStoryOptions({storyAllowReplies: value})}
              styles={styles}
              palette={palette}
            />
            <ToggleRow
              icon={<Share2 size={16} color={palette.foreground} />}
              label="Share to partner apps"
              value={draft.storyShareOffPlatform}
              onToggle={value =>
                setStoryOptions({storyShareOffPlatform: value})
              }
              styles={styles}
              palette={palette}
            />
          </View>
        </ActionSheet>
      ) : null}

      {/* Schedule */}
      <Modal
        visible={scheduleOpen}
        transparent
        animationType="fade"
        statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schedule post</Text>
            <Text style={styles.modalSubtitle}>
              Choose when this content should publish. Use local device date and
              time.
            </Text>
            <View style={styles.modalRow}>
              <TextInput
                value={scheduleDraft.date}
                onChangeText={date =>
                  setScheduleDraft(current => ({...current, date}))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.placeholder}
                style={styles.modalInput}
              />
              <TextInput
                value={scheduleDraft.time}
                onChangeText={time =>
                  setScheduleDraft(current => ({...current, time}))
                }
                placeholder="HH:mm"
                placeholderTextColor={palette.placeholder}
                style={styles.modalInput}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.footerSmallBtn}
                onPress={() => setScheduleOpen(false)}>
                <Text style={styles.footerSmallText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryShareBtn, {flex: 1}]}
                onPress={() => {
                  const iso = buildScheduledIso(
                    scheduleDraft.date,
                    scheduleDraft.time,
                  );
                  if (!iso) {
                    Alert.alert(
                      'Invalid date or time',
                      'Use YYYY-MM-DD and HH:mm format.',
                    );
                    return;
                  }
                  setAdvanced({scheduledAt: iso});
                  setScheduleOpen(false);
                  publish(iso).catch(() => null);
                }}>
                <Text style={styles.primaryShareText}>Schedule</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loader */}
      <Modal
        visible={busy !== null}
        transparent
        animationType="fade"
        statusBarTranslucent>
        <View style={styles.loaderBackdrop}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loaderTitle}>
            {busy === 'draft'
              ? 'Saving draft...'
              : busy === 'schedule'
              ? 'Scheduling...'
              : editPostId
              ? 'Saving...'
              : 'Posting...'}
          </Text>
          <Text style={styles.loaderSubtitle}>
            {busy === 'publish' || busy === 'schedule'
              ? editPostId
                ? 'Updating your post'
                : `Uploading ${Math.round(uploadProgress * 100)}%`
              : 'Keeping your edits safe'}
          </Text>
        </View>
      </Modal>
    </ThemedSafeScreen>
  );
}

function ActionListRow({
  icon,
  label,
  value,
  onPress,
  styles,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: ThemePalette;
}) {
  return (
   <View style={styles.actionRow}>
     <View style={styles.actionRowIcon}>{icon}</View>
    <Pressable
      style={({pressed}) => [
       
        pressed && {backgroundColor: palette.surface},  ]}   onPress={onPress}>
      
      <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '600'}}>{label}</Text>
      {value ? (
        <Text
          style={[ {color: palette.accent, fontSize: 13, fontWeight: '600'}]}
          numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      
    </Pressable>
    {/* <ChevronRight size={18} color={palette.foregroundSubtle} /> */}
    {/* <Text style={{color: palette.foregroundSubtle, fontSize: 18, fontWeight: '700', alignSelf: 'flex-end'}}><ChevronRight size={18} color={palette.foregroundSubtle} /></Text> */}
   </View>

  );
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  styles,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  styles: ReturnType<typeof makeStyles>;
  palette: ThemePalette;
}) {
  return (
    <View style={styles.optionRow}>
      {icon}
      <Text style={styles.optionLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        thumbColor={value ? palette.accent : undefined}
      />
    </View>
  );
}
