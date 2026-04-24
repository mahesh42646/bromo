import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Video, {ViewType} from 'react-native-video';
import {
  Award,
  Calendar,
  Check,
  ChevronLeft,
  Download,
  EyeOff,
  Globe,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  MessageCircleOff,
  Save,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {packClientSnapshot, packEditMetaForUpload} from '../../create/draftSnapshot';
import type {CreateDraftState} from '../../create/CreateDraftContext';
import type {MediaAsset, Visibility} from '../../create/createTypes';
import type {FilterId, FeedCategoryPreset} from '../../create/createTypes';
import {DEFAULT_ADJUSTMENTS} from '../../create/createTypes';
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
  MAX_UPLOAD_BYTES,
  uploadMedia,
  uploadMediaAsync,
} from '../../api/postsApi';
import {createDraft} from '../../api/draftsApi';
import {searchUsers, type SuggestedUser} from '../../api/followApi';
import {listProducts, type AffiliateProduct} from '../../api/productsApi';
import {searchPlaces, type PlaceItem} from '../../api/placesApi';
import {
  CreateModeSegment,
  StudioProgress,
  StudioSection,
} from './CreateStudioUI';

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

function previewAspect(mode: CreateDraftState['mode'], crop: string): number {
  if (crop === '1:1') return 1;
  if (crop === '4:5') return 4 / 5;
  if (crop === '16:9') return 16 / 9;
  if (crop === '9:16') return 9 / 16;
  if (mode === 'reel' || mode === 'story') return 9 / 16;
  if (mode === 'post') return 1;
  return 1;
}

function makeStyles() {
  return StyleSheet.create({
    root: {flex: 1},
    headerShell: {
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 6,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {flex: 1, alignItems: 'center', paddingHorizontal: 10},
    eyebrow: {fontSize: 10, fontWeight: '900'},
    headerTitle: {fontSize: 17, fontWeight: '900', marginTop: 2},
    stepPill: {
      minWidth: 44,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepPillText: {fontSize: 12, fontWeight: '900'},
    modeSegment: {marginHorizontal: 14, marginTop: 4},
    body: {
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 18,
    },
    preview: {
      width: '100%',
      borderRadius: 18,
      overflow: 'hidden',
    },
    media: {...StyleSheet.absoluteFillObject},
    textOverlay: {position: 'absolute'},
    sticker: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
    },
    stickerTxt: {fontSize: 11, fontWeight: '800'},
    pollOverlay: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      borderRadius: 14,
      padding: 12,
      gap: 8,
    },
    pollQuestion: {fontSize: 12, fontWeight: '900'},
    pollOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 10,
    },
    pollOptionTxt: {flex: 1, fontSize: 11, fontWeight: '800'},
    captionBox: {
      flexDirection: 'row',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      gap: 12,
      alignItems: 'flex-start',
    },
    thumbImg: {width: 64, height: 64, borderRadius: 10},
    captionInline: {
      flex: 1,
      fontSize: 15,
      minHeight: 82,
      textAlignVertical: 'top',
      padding: 0,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 14,
    },
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    selectedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    selectedChipText: {fontSize: 12, fontWeight: '700', maxWidth: 180},
    hitRow: {gap: 8, paddingRight: 2},
    hitChip: {
      minWidth: 96,
      maxWidth: 164,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    hitChipTitle: {fontSize: 12, fontWeight: '800'},
    hitChipMeta: {fontSize: 11, marginTop: 3},
    sectionLabel: {fontSize: 12, fontWeight: '900'},
    pollStack: {gap: 10},
    pollInput: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    pollOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addOptionBtn: {
      minHeight: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
    },
    toggleLabel: {flex: 1, fontSize: 14, fontWeight: '700'},
    footerBar: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 10,
    },
    footerActionRow: {flexDirection: 'row', gap: 10},
    footerButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flexDirection: 'row',
      paddingHorizontal: 10,
    },
    footerPrimary: {
      minHeight: 50,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    footerButtonText: {fontSize: 12, fontWeight: '900'},
    footerPrimaryText: {fontSize: 15, fontWeight: '900'},
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
    },
    modalTitle: {fontSize: 17, fontWeight: '900'},
    modalSubtitle: {fontSize: 13, lineHeight: 19},
    modalRow: {flexDirection: 'row', gap: 10},
    modalInput: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
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
  });
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  colors,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  colors: {
    surface: string;
    foreground: string;
  };
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.toggleRow, {backgroundColor: colors.surface}]}>
      {icon}
      <Text style={[styles.toggleLabel, {color: colors.foreground}]}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} />
    </View>
  );
}

export function ShareScreen() {
  const navigation = useNavigation<Nav>();
  const {width: viewportW} = useWindowDimensions();
  const {palette} = useTheme();
  const styles = makeStyles();
  const {
    draft,
    reset,
    setMode,
    setCaption,
    setHashtags,
    setTagged,
    setLocation,
    setProducts,
    setPoll,
    setVisibility,
    setAdvanced,
    setFeedCategoryPreset,
    setFeedCategoryManual,
    setStoryOptions,
  } = useCreateDraft();

  const previewShotRef = useRef<ViewShot>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({
    location: null,
    people: null,
    product: null,
  });

  const asset = draft.assets[draft.activeAssetIndex] ?? draft.assets[0];
  const rotation = draft.rotationByAsset[draft.activeAssetIndex] ?? 0;
  const crop = draft.cropByAsset[draft.activeAssetIndex] ?? 'original';
  const aspect = previewAspect(draft.mode, crop);
  const previewHeight = Math.min(Math.max(320, (viewportW - 28) / aspect), 560);
  const filter = (draft.filterByAsset[draft.activeAssetIndex] ?? 'normal') as FilterId;
  const filterStacks = FILTER_LAYER_STACKS[filter];
  const adjustments =
    draft.adjustByAsset[draft.activeAssetIndex] ?? {...DEFAULT_ADJUSTMENTS};
  const adjustOverlay = adjustOverlayStyle(adjustments);
  const warmOv = warmthOverlayStyle(adjustments);
  const satOv = saturationOverlayStyle(adjustments);
  const vigOv = vignetteOverlayStyle(adjustments);

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

  useEffect(() => {
    setCaptionLocal(draft.caption);
  }, [draft.caption]);

  useEffect(() => {
    setScheduleDraft(toDateInputs(draft.advanced.scheduledAt));
  }, [draft.advanced.scheduledAt]);

  useEffect(() => {
    const timers = debounceRefs.current;
    if (timers.location) {
      clearTimeout(timers.location);
    }
    timers.location = setTimeout(async () => {
      const query = locationQuery.trim();
      if (!query) {
        setLocationHits([]);
        return;
      }
      const {items} = await searchPlaces(query);
      setLocationHits(items);
    }, 260);
    return () => {
      if (timers.location) {
        clearTimeout(timers.location);
      }
    };
  }, [locationQuery]);

  useEffect(() => {
    const timers = debounceRefs.current;
    if (timers.people) {
      clearTimeout(timers.people);
    }
    timers.people = setTimeout(async () => {
      const query = peopleQuery.trim();
      if (!query) {
        setPeopleHits([]);
        return;
      }
      try {
        const {users} = await searchUsers(query);
        setPeopleHits(users.slice(0, 8));
      } catch {
        setPeopleHits([]);
      }
    }, 260);
    return () => {
      if (timers.people) {
        clearTimeout(timers.people);
      }
    };
  }, [peopleQuery]);

  useEffect(() => {
    const timers = debounceRefs.current;
    if (timers.product) {
      clearTimeout(timers.product);
    }
    timers.product = setTimeout(async () => {
      const query = productQuery.trim();
      if (!query) {
        setProductHits([]);
        return;
      }
      const {items} = await listProducts(query, undefined, 10);
      setProductHits(items);
    }, 260);
    return () => {
      if (timers.product) {
        clearTimeout(timers.product);
      }
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

  const closeAll = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [navigation, reset]);

  const saveDraftNow = useCallback(async () => {
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
  }, [asset, closeAll, draft]);

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
      if (asset.type === 'video') {
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
        const uploadCategory: 'reels' | 'stories' | 'posts' =
          draft.mode === 'reel'
            ? 'reels'
            : draft.mode === 'story'
            ? 'stories'
            : 'posts';
        const caption =
          buildCaptionWithProducts(
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
    [asset, closeAll, draft],
  );

  const visibilityOptions: {
    key: Visibility;
    label: string;
    Icon: typeof Globe;
  }[] =
    draft.mode === 'story'
      ? [
          {key: 'public', label: 'Your story (followers)', Icon: Users},
          {key: 'close_friends', label: 'Close Friends', Icon: Heart},
        ]
      : [
          {key: 'public', label: 'Anyone', Icon: Globe},
          {key: 'followers', label: 'Followers only', Icon: Users},
          {key: 'private', label: 'Only me', Icon: Lock},
        ];

  const discard = useCallback(() => {
    Alert.alert('Discard?', 'Your edits will be lost.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: closeAll},
    ]);
  }, [closeAll]);

  const selectedPollOptions = draft.poll.options.length
    ? draft.poll.options
    : ['Yes', 'No'];
  const selectedPollVotes =
    draft.poll.votes.length === selectedPollOptions.length
      ? draft.poll.votes
      : selectedPollOptions.map((_, index) => draft.poll.votes[index] ?? 0);

  return (
    <ThemedSafeScreen
      style={[styles.root, {backgroundColor: palette.background}]}>
      <View
        style={[
          styles.headerShell,
          {backgroundColor: palette.card, borderBottomColor: palette.hairline},
        ]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.iconButton, {backgroundColor: palette.surface}]}>
            <ChevronLeft size={22} color={palette.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.eyebrow, {color: palette.foregroundSubtle}]}>
              BROMO CREATOR
            </Text>
            <Text
              style={[styles.headerTitle, {color: palette.foreground}]}>
              Details & share
            </Text>
          </View>
          <View
            style={[
              styles.stepPill,
              {backgroundColor: palette.surface, borderColor: palette.border},
            ]}>
            <Text
              style={[styles.stepPillText, {color: palette.foregroundMuted}]}>
              2/2
            </Text>
          </View>
        </View>
        <CreateModeSegment
          palette={palette}
          mode={draft.mode}
          onChange={setMode}
          style={styles.modeSegment}
        />
        <StudioProgress palette={palette} activeIndex={1} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}>
        <ViewShot
          ref={previewShotRef}
          style={[
            styles.preview,
            {height: previewHeight, backgroundColor: palette.surface},
          ]}
          options={{format: 'jpg', quality: 0.92}}>
          {asset?.type === 'video' ? (
            <Video
              source={{uri: asset.uri}}
              style={styles.media}
              resizeMode="cover"
              repeat
              muted
              viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
              shutterColor="transparent"
            />
          ) : asset ? (
            <Image
              source={{uri: asset.uri}}
              style={[styles.media, {transform: [{rotate: `${rotation}deg`}]}]}
              resizeMode="cover"
            />
          ) : null}
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
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, adjustOverlay]} />
          {warmOv ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, warmOv]} /> : null}
          {satOv ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, satOv]} /> : null}
          {vigOv ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, vigOv]} /> : null}
          {draft.textOverlays.map(o => (
            <View key={o.id} style={[styles.textOverlay, {left: o.x, top: o.y}]}>
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
              style={[
                styles.sticker,
                {left: sticker.x, top: sticker.y, backgroundColor: palette.overlay},
              ]}>
              <ShoppingBag size={10} color={palette.foreground} />
              <Text style={[styles.stickerTxt, {color: palette.foreground}]}>
                {sticker.label}
              </Text>
            </View>
          ))}
          {draft.poll.enabled && selectedPollOptions.length >= 2 ? (
            <View
              style={[
                styles.pollOverlay,
                {backgroundColor: palette.overlay},
              ]}>
              {draft.poll.question ? (
                <Text
                  style={[styles.pollQuestion, {color: palette.foreground}]}>
                  {draft.poll.question}
                </Text>
              ) : null}
              {selectedPollOptions.slice(0, 4).map((option, index) => (
                <View
                  key={`${option}_${index}`}
                  style={[
                    styles.pollOption,
                    {
                      backgroundColor:
                        index === 0 ? palette.accent : palette.surface,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.pollOptionTxt,
                      {
                        color:
                          index === 0
                            ? palette.accentForeground
                            : palette.foreground,
                      },
                    ]}>
                    {option}
                  </Text>
                  <Text
                    style={{
                      color:
                        index === 0
                          ? palette.accentForeground
                          : palette.foregroundMuted,
                      fontSize: 10,
                      fontWeight: '900',
                    }}>
                    {selectedPollVotes[index] ?? 0}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </ViewShot>

        <StudioSection palette={palette} title="Caption">
          <View
            style={[
              styles.captionBox,
              {borderColor: palette.border, backgroundColor: palette.surface},
            ]}>
            {asset ? (
              asset.type === 'image' ? (
                <Image source={{uri: asset.uri}} style={styles.thumbImg} />
              ) : (
                <View
                  style={[
                    styles.thumbImg,
                    {
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: palette.input,
                    },
                  ]}>
                  <Send size={16} color={palette.foregroundMuted} />
                </View>
              )
            ) : null}
            <TextInput
              value={captionLocal}
              onChangeText={next => {
                setCaptionLocal(next);
                syncCaption(next);
              }}
              placeholder="Write a caption"
              placeholderTextColor={palette.placeholder}
              multiline
              style={[styles.captionInline, {color: palette.foreground}]}
            />
          </View>
        </StudioSection>

        <StudioSection palette={palette} title="Location">
          <View
            style={[
              styles.searchBox,
              {backgroundColor: palette.input, borderColor: palette.border},
            ]}>
            <Search size={16} color={palette.foregroundMuted} />
            <TextInput
              value={locationQuery}
              onChangeText={setLocationQuery}
              placeholder={draft.location?.name ?? 'Search location'}
              placeholderTextColor={palette.placeholder}
              style={[styles.searchInput, {color: palette.foreground}]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {draft.location ? (
            <View style={[styles.chipRow, {marginTop: 10}]}>
              <Pressable
                style={[
                  styles.selectedChip,
                  {borderColor: palette.accent, backgroundColor: `${palette.accent}22`},
                ]}
                onPress={() => setLocation(null)}>
                <MapPin size={14} color={palette.accent} />
                <Text
                  style={[styles.selectedChipText, {color: palette.accent}]}
                  numberOfLines={1}>
                  {draft.location.name}
                </Text>
                <X size={14} color={palette.accent} />
              </Pressable>
            </View>
          ) : null}
          {locationHits.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.hitRow, {marginTop: 10}]}>
              {locationHits.map(place => (
                <Pressable
                  key={place.placeId ?? `${place.name}_${place.address ?? ''}`}
                  onPress={() => {
                    setLocation({
                      id: place.placeId ?? `${place.name}_${place.lat}_${place.lng}`,
                      name: place.name,
                      address: place.address,
                      lat: place.lat,
                      lng: place.lng,
                      placeId: place.placeId,
                    });
                    setLocationQuery('');
                    setLocationHits([]);
                  }}
                  style={[
                    styles.hitChip,
                    {borderColor: palette.border, backgroundColor: palette.surface},
                  ]}>
                  <Text
                    style={[styles.hitChipTitle, {color: palette.foreground}]}
                    numberOfLines={1}>
                    {place.name}
                  </Text>
                  {place.address ? (
                    <Text
                      style={[styles.hitChipMeta, {color: palette.foregroundMuted}]}
                      numberOfLines={2}>
                      {place.address}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </StudioSection>

        <StudioSection palette={palette} title="Poll">
          <View style={styles.pollStack}>
            <ToggleRow
              icon={<MessageCircle size={16} color={palette.foreground} />}
              label="Enable poll"
              value={draft.poll.enabled}
              onToggle={value =>
                setPoll({
                  enabled: value,
                  options: selectedPollOptions.length >= 2
                    ? selectedPollOptions
                    : ['Yes', 'No'],
                })
              }
              colors={{surface: palette.surface, foreground: palette.foreground}}
              styles={styles}
            />
            {draft.poll.enabled ? (
              <>
                <TextInput
                  value={draft.poll.question}
                  onChangeText={question => setPoll({question})}
                  placeholder="Poll question"
                  placeholderTextColor={palette.placeholder}
                  style={[
                    styles.pollInput,
                    {
                      backgroundColor: palette.input,
                      borderColor: palette.border,
                      color: palette.foreground,
                    },
                  ]}
                />
                {selectedPollOptions.map((option, index) => (
                  <View key={`poll_option_${index}`} style={styles.pollOptionRow}>
                    <TextInput
                      value={option}
                      onChangeText={text => {
                        const nextOptions = [...selectedPollOptions];
                        nextOptions[index] = text;
                        setPoll({options: nextOptions});
                      }}
                      placeholder={`Answer ${index + 1}`}
                      placeholderTextColor={palette.placeholder}
                      style={[
                        styles.pollInput,
                        {
                          flex: 1,
                          backgroundColor: palette.input,
                          borderColor: palette.border,
                          color: palette.foreground,
                        },
                      ]}
                    />
                    {selectedPollOptions.length > 2 ? (
                      <Pressable
                        onPress={() => {
                          const nextOptions = selectedPollOptions.filter((_, i) => i !== index);
                          const nextVotes = selectedPollVotes.filter((_, i) => i !== index);
                          setPoll({options: nextOptions, votes: nextVotes});
                        }}
                        style={[
                          styles.iconButton,
                          {backgroundColor: palette.surface},
                        ]}>
                        <X size={16} color={palette.foregroundMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {selectedPollOptions.length < 4 ? (
                  <Pressable
                    onPress={() =>
                      setPoll({
                        options: [...selectedPollOptions, `Option ${selectedPollOptions.length + 1}`],
                      })
                    }
                    style={[
                      styles.addOptionBtn,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.surface,
                      },
                    ]}>
                    <Text style={[styles.sectionLabel, {color: palette.foreground}]}>
                      Add answer
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        </StudioSection>

        <StudioSection palette={palette} title="Tag People">
          <View
            style={[
              styles.searchBox,
              {backgroundColor: palette.input, borderColor: palette.border},
            ]}>
            <Search size={16} color={palette.foregroundMuted} />
            <TextInput
              value={peopleQuery}
              onChangeText={setPeopleQuery}
              placeholder="Search people"
              placeholderTextColor={palette.placeholder}
              style={[styles.searchInput, {color: palette.foreground}]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {draft.tagged.length ? (
            <View style={[styles.chipRow, {marginTop: 10}]}>
              {draft.tagged.map(person => (
                <Pressable
                  key={person.id}
                  onPress={() =>
                    setTagged(draft.tagged.filter(item => item.id !== person.id))
                  }
                  style={[
                    styles.selectedChip,
                    {borderColor: palette.accent, backgroundColor: `${palette.accent}22`},
                  ]}>
                  <Users size={14} color={palette.accent} />
                  <Text
                    style={[styles.selectedChipText, {color: palette.accent}]}>
                    @{person.username}
                  </Text>
                  <X size={14} color={palette.accent} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {peopleHits.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.hitRow, {marginTop: 10}]}>
              {peopleHits.map(person => {
                const active = draft.tagged.some(item => item.id === person._id);
                return (
                  <Pressable
                    key={person._id}
                    onPress={() => {
                      if (active) {
                        setTagged(draft.tagged.filter(item => item.id !== person._id));
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
                    style={[
                      styles.hitChip,
                      {
                        borderColor: active ? palette.accent : palette.border,
                        backgroundColor: active
                          ? `${palette.accent}22`
                          : palette.surface,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.hitChipTitle,
                        {color: active ? palette.accent : palette.foreground},
                      ]}>
                      @{person.username}
                    </Text>
                    <Text
                      style={[
                        styles.hitChipMeta,
                        {color: active ? palette.accent : palette.foregroundMuted},
                      ]}>
                      {active ? 'Selected' : 'Tap to tag'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </StudioSection>

        <StudioSection palette={palette} title="Tag Products">
          <View
            style={[
              styles.searchBox,
              {backgroundColor: palette.input, borderColor: palette.border},
            ]}>
            <Search size={16} color={palette.foregroundMuted} />
            <TextInput
              value={productQuery}
              onChangeText={setProductQuery}
              placeholder="Search products"
              placeholderTextColor={palette.placeholder}
              style={[styles.searchInput, {color: palette.foreground}]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {draft.products.length ? (
            <View style={[styles.chipRow, {marginTop: 10}]}>
              {draft.products.map(product => (
                <Pressable
                  key={product.id}
                  onPress={() =>
                    setProducts(draft.products.filter(item => item.id !== product.id))
                  }
                  style={[
                    styles.selectedChip,
                    {borderColor: palette.accent, backgroundColor: `${palette.accent}22`},
                  ]}>
                  <ShoppingBag size={14} color={palette.accent} />
                  <Text
                    style={[styles.selectedChipText, {color: palette.accent}]}
                    numberOfLines={1}>
                    {product.name}
                  </Text>
                  <X size={14} color={palette.accent} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {productHits.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.hitRow, {marginTop: 10}]}>
              {productHits.map(product => {
                const active = draft.products.some(item => item.id === product._id);
                return (
                  <Pressable
                    key={product._id}
                    onPress={() => {
                      if (active) {
                        setProducts(
                          draft.products.filter(item => item.id !== product._id),
                        );
                      } else {
                        setProducts([...draft.products, affiliateToAttachment(product)]);
                      }
                    }}
                    style={[
                      styles.hitChip,
                      {
                        borderColor: active ? palette.accent : palette.border,
                        backgroundColor: active
                          ? `${palette.accent}22`
                          : palette.surface,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.hitChipTitle,
                        {color: active ? palette.accent : palette.foreground},
                      ]}
                      numberOfLines={2}>
                      {product.title}
                    </Text>
                    <Text
                      style={[
                        styles.hitChipMeta,
                        {color: active ? palette.accent : palette.foregroundMuted},
                      ]}
                      numberOfLines={1}>
                      {active ? 'Selected' : `${product.currency} ${product.price}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </StudioSection>

        {(draft.mode === 'post' || draft.mode === 'reel') && (
          <StudioSection palette={palette} title="Feed Category">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hitRow}>
              {FEED_CATEGORY_CHIPS.map(category => {
                const active =
                  draft.feedCategoryManual.trim() === '' &&
                  draft.feedCategoryPreset === category.preset;
                return (
                  <Pressable
                    key={category.preset}
                    onPress={() => setFeedCategoryPreset(category.preset)}
                    style={[
                      styles.selectedChip,
                      {
                        borderColor: active ? palette.accent : palette.border,
                        backgroundColor: active
                          ? palette.accent
                          : palette.surface,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.selectedChipText,
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
            </ScrollView>
            <TextInput
              value={draft.feedCategoryManual}
              onChangeText={setFeedCategoryManual}
              placeholder="Custom category"
              placeholderTextColor={palette.placeholder}
              style={[
                styles.pollInput,
                {
                  marginTop: 10,
                  backgroundColor: palette.input,
                  borderColor: palette.border,
                  color: palette.foreground,
                },
              ]}
            />
          </StudioSection>
        )}

        <StudioSection palette={palette} title="Visibility">
          <View style={{gap: 8}}>
            {visibilityOptions.map(option => {
              const selected = draft.visibility === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setVisibility(option.key)}
                  style={[
                    styles.toggleRow,
                    {
                      backgroundColor: palette.surface,
                      borderWidth: 1,
                      borderColor: selected ? palette.accent : palette.border,
                    },
                  ]}>
                  <option.Icon
                    size={16}
                    color={selected ? palette.accent : palette.foregroundMuted}
                  />
                  <Text
                    style={[
                      styles.toggleLabel,
                      {color: selected ? palette.accent : palette.foreground},
                    ]}>
                    {option.label}
                  </Text>
                  {selected ? <Check size={16} color={palette.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </StudioSection>

        <StudioSection palette={palette} title="Advanced Settings">
          <View style={{gap: 8}}>
            <ToggleRow
              icon={<MessageCircleOff size={16} color={palette.foreground} />}
              label="Turn off comments"
              value={draft.advanced.commentsOff}
              onToggle={value => setAdvanced({commentsOff: value})}
              colors={{surface: palette.surface, foreground: palette.foreground}}
              styles={styles}
            />
            <ToggleRow
              icon={<EyeOff size={16} color={palette.foreground} />}
              label="Hide like count"
              value={draft.advanced.hideLikeCount}
              onToggle={value => setAdvanced({hideLikeCount: value})}
              colors={{surface: palette.surface, foreground: palette.foreground}}
              styles={styles}
            />
            <ToggleRow
              icon={<Award size={16} color={palette.foreground} />}
              label="Branded content"
              value={draft.advanced.brandedContent}
              onToggle={value => setAdvanced({brandedContent: value})}
              colors={{surface: palette.surface, foreground: palette.foreground}}
              styles={styles}
            />
            {draft.mode === 'post' ? (
              <ToggleRow
                icon={<Share2 size={16} color={palette.foreground} />}
                label="Also share to your story"
                value={draft.advanced.shareToStory}
                onToggle={value => setAdvanced({shareToStory: value})}
                colors={{surface: palette.surface, foreground: palette.foreground}}
                styles={styles}
              />
            ) : null}
          </View>
        </StudioSection>

        {draft.mode === 'story' ? (
          <StudioSection palette={palette} title="Story Options">
            <View style={{gap: 8}}>
              <ToggleRow
                icon={<MessageCircle size={16} color={palette.foreground} />}
                label="Allow replies"
                value={draft.storyAllowReplies}
                onToggle={value => setStoryOptions({storyAllowReplies: value})}
                colors={{surface: palette.surface, foreground: palette.foreground}}
                styles={styles}
              />
              <ToggleRow
                icon={<Share2 size={16} color={palette.foreground} />}
                label="Share to partner apps"
                value={draft.storyShareOffPlatform}
                onToggle={value =>
                  setStoryOptions({storyShareOffPlatform: value})
                }
                colors={{surface: palette.surface, foreground: palette.foreground}}
                styles={styles}
              />
            </View>
          </StudioSection>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footerBar,
          {backgroundColor: palette.card, borderTopColor: palette.hairline},
        ]}>
        <View style={styles.footerActionRow}>
          <Pressable
            style={[
              styles.footerButton,
              {backgroundColor: palette.surface, borderColor: palette.border},
            ]}
            onPress={discard}>
            <Trash2 size={16} color={palette.destructive} />
            <Text style={[styles.footerButtonText, {color: palette.destructive}]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerButton,
              {backgroundColor: palette.surface, borderColor: palette.border},
            ]}
            onPress={saveDraftNow}
            disabled={busy !== null}>
            <Save size={16} color={palette.foreground} />
            <Text style={[styles.footerButtonText, {color: palette.foreground}]}>
              Draft
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerButton,
              {backgroundColor: palette.surface, borderColor: palette.border},
            ]}
            onPress={downloadExport}>
            <Download size={16} color={palette.foreground} />
            <Text style={[styles.footerButtonText, {color: palette.foreground}]}>
              Download
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerButton,
              {backgroundColor: palette.surface, borderColor: palette.border},
            ]}
            onPress={() => setScheduleOpen(true)}
            disabled={busy !== null}>
            <Calendar size={16} color={palette.foreground} />
            <Text style={[styles.footerButtonText, {color: palette.foreground}]}>
              Schedule
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.footerPrimary, {backgroundColor: palette.accent}]}
          onPress={() => publish(null)}
          disabled={busy !== null}>
          <Send size={18} color={palette.accentForeground} />
          <Text
            style={[styles.footerPrimaryText, {color: palette.accentForeground}]}>
            {draft.mode === 'story'
              ? 'Share story'
              : draft.mode === 'reel'
              ? 'Share reel'
              : 'Share post'}
          </Text>
        </Pressable>
      </View>

      <Modal visible={scheduleOpen} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {backgroundColor: palette.card, borderColor: palette.border},
            ]}>
            <Text style={[styles.modalTitle, {color: palette.foreground}]}>
              Schedule post
            </Text>
            <Text
              style={[styles.modalSubtitle, {color: palette.foregroundMuted}]}>
              Choose when this content should publish. Use local device date and
              time.
            </Text>
            <View style={styles.modalRow}>
              <TextInput
                value={scheduleDraft.date}
                onChangeText={date => setScheduleDraft(current => ({...current, date}))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.placeholder}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    color: palette.foreground,
                  },
                ]}
              />
              <TextInput
                value={scheduleDraft.time}
                onChangeText={time => setScheduleDraft(current => ({...current, time}))}
                placeholder="HH:mm"
                placeholderTextColor={palette.placeholder}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: palette.input,
                    borderColor: palette.border,
                    color: palette.foreground,
                  },
                ]}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.footerButton,
                  {backgroundColor: palette.surface, borderColor: palette.border},
                ]}
                onPress={() => setScheduleOpen(false)}>
                <Text style={[styles.footerButtonText, {color: palette.foreground}]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.footerPrimary, {flex: 1, backgroundColor: palette.accent}]}
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
                <Text
                  style={[
                    styles.footerPrimaryText,
                    {color: palette.accentForeground},
                  ]}>
                  Schedule
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={busy !== null} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.loaderBackdrop}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loaderTitle}>
            {busy === 'draft'
              ? 'Saving draft...'
              : busy === 'schedule'
              ? 'Scheduling...'
              : 'Posting...'}
          </Text>
          <Text style={styles.loaderSubtitle}>
            {busy === 'publish' || busy === 'schedule'
              ? `Uploading ${Math.round(uploadProgress * 100)}%`
              : 'Keeping your edits safe'}
          </Text>
        </View>
      </Modal>
    </ThemedSafeScreen>
  );
}
