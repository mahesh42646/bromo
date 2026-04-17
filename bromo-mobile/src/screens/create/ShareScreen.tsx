import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Video, {ViewType} from 'react-native-video';
import {
  Check,
  Download,
  Eye,
  Globe,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Save,
  Send,
  Share2,
  ShoppingBag,
  Trash2,
  Users,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {packClientSnapshot, packEditMetaForUpload} from '../../create/draftSnapshot';
import type {CreateDraftState} from '../../create/CreateDraftContext';
import type {MediaAsset} from '../../create/createTypes';
import type {FeedCategoryPreset, FilterId, Visibility} from '../../create/createTypes';
import {FILTER_LAYER_STACKS} from '../../create/filterStyles';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {
  uploadMedia,
  uploadMediaAsync,
  createPost,
  getLocalFileSizeBytes,
  MAX_UPLOAD_BYTES,
} from '../../api/postsApi';
import {createDraft} from '../../api/draftsApi';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'ShareFinal'>;

const {width: W} = Dimensions.get('window');

type SharePhase = 'review' | 'posting' | 'processing' | 'done';

const FEED_CATEGORY_CHIPS: Array<{preset: FeedCategoryPreset; label: string}> = [
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

function effectiveTrimmedDurationMs(draft: CreateDraftState, asset: MediaAsset): number | undefined {
  if (asset.type !== 'video' || typeof asset.duration !== 'number' || !(asset.duration > 0)) {
    return undefined;
  }
  const i = draft.activeAssetIndex;
  const ts = draft.trimStartByAsset[i] ?? 0;
  const te = draft.trimEndByAsset[i] ?? 1;
  const span = (Math.min(1, te) - Math.max(0, ts)) * asset.duration;
  return Math.round(Math.max(0.05, span) * 1000);
}

function buildCaptionWithProducts(caption: string, hashtags: string[], products: {productUrl?: string}[]): string {
  const head = [caption.trim(), ...hashtags].filter(Boolean).join(' ').trim();
  const links = products.map(p => p.productUrl?.trim()).filter((u): u is string => !!u);
  if (!links.length) return head;
  return [head, ...links].filter(Boolean).join('\n\n');
}

function toastOk(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
}

export function ShareScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {
    draft,
    setVisibility,
    setStoryOptions,
    votePoll,
    reset,
    setFeedCategoryPreset,
    setFeedCategoryManual,
  } = useCreateDraft();

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<SharePhase>('review');
  const [uploadProgress, setUploadProgress] = useState(0);
  const previewShotRef = useRef<ViewShot>(null);
  const processingNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const asset = draft.assets[draft.activeAssetIndex] ?? draft.assets[0];
  const filter = (draft.filterByAsset[draft.activeAssetIndex] ?? 'normal') as FilterId;
  const filterStacks = FILTER_LAYER_STACKS[filter];
  const rotation = draft.rotationByAsset[draft.activeAssetIndex] ?? 0;

  const closeAll = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [navigation, reset]);

  const saveDraft = async () => {
    if (!asset) {
      Alert.alert('No media', 'Add something to save.');
      return;
    }
    setBusy(true);
    try {
      const feedCategory = slugFeedCategory(draft.feedCategoryManual, draft.feedCategoryPreset);
      const caption = buildCaptionWithProducts(draft.caption, draft.hashtags, draft.products);
      await createDraft({
        type: draft.mode === 'live' ? 'reel' : draft.mode,
        localUri: asset.uri,
        thumbnailUri: asset.uri,
        mediaType: asset.type,
        caption,
        location: draft.location?.name ?? '',
        locationMeta:
          draft.location?.lat != null && draft.location?.lng != null
            ? {name: draft.location.name, lat: draft.location.lat, lng: draft.location.lng}
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
      Alert.alert('Saved', 'Continue editing anytime from Drafts.', [{text: 'OK', onPress: closeAll}]);
    } catch (e) {
      Alert.alert('Could not save draft', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const downloadExport = async () => {
    if (!asset) return;
    try {
      const captured = await previewShotRef.current?.capture?.();
      if (captured) {
        await CameraRoll.save(captured, {type: 'photo'});
      } else {
        await CameraRoll.save(asset.uri, {type: asset.type === 'video' ? 'video' : 'photo'});
      }
      toastOk('Saved to gallery');
      if (Platform.OS === 'ios') {
        Alert.alert('Saved', 'Your preview (with on-screen filters and stickers) was saved to Photos.');
      }
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again');
    }
  };

  const publish = async () => {
    if (!asset) {
      Alert.alert('No media', 'Please add a photo or video first.');
      return;
    }
    if (asset.type === 'video') {
      const sz = await getLocalFileSizeBytes(asset.uri);
      if (sz != null && sz > MAX_UPLOAD_BYTES) {
        Alert.alert(
          'File too large',
          `Videos can be up to ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB. Pick a shorter clip or lower resolution.`,
        );
        return;
      }
    }
    setUploadProgress(0);
    setPhase('posting');
    try {
      const uploadCategory: 'reels' | 'stories' | 'posts' =
        draft.mode === 'reel' ? 'reels' : draft.mode === 'story' ? 'stories' : 'posts';
      const caption = buildCaptionWithProducts(draft.caption, draft.hashtags, draft.products) || undefined;
      const feedCategory =
        draft.mode === 'story'
          ? undefined
          : slugFeedCategory(draft.feedCategoryManual, draft.feedCategoryPreset);

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

      // Use async pipeline for video reels/stories/posts — server does HLS transcode in background
      const useAsync = asset.type === 'video' && (draft.mode === 'reel' || draft.mode === 'story' || draft.mode === 'post');

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
          },
          pct => setUploadProgress(pct),
        );
        setUploadProgress(1);
        toastOk('Upload complete — processing');
        setPhase('processing');
      } else {
        const {url, thumbnailUrl, mediaType: mediaTypeFromServer} = await uploadMedia(asset.uri, {
          type: asset.type,
          fileName: asset.fileName,
          category: uploadCategory,
        });
        const mediaType = mediaTypeFromServer ?? (asset.type === 'video' ? 'video' : 'image');
        const postType = draft.mode === 'reel' ? 'reel' : draft.mode === 'story' ? 'story' : 'post';
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
          clientEditMeta: packEditMetaForUpload(draft),
          ...(postType !== 'story' && feedCategory ? {feedCategory} : {}),
        });
        toastOk('Posted');
        setPhase('done');
      }
    } catch (err) {
      setPhase('review');
      Alert.alert('Failed to post', err instanceof Error ? err.message : 'Try again');
    }
  };

  useEffect(() => {
    if (phase === 'done' || phase === 'processing') {
      Animated.parallel([
        Animated.spring(scaleAnim, {toValue: 1, friction: 4, tension: 60, useNativeDriver: true}),
        Animated.timing(fadeAnim, {toValue: 1, duration: 400, useNativeDriver: true}),
      ]).start();
    }
  }, [phase, scaleAnim, fadeAnim]);

  useEffect(() => {
    if (phase !== 'processing') {
      if (processingNavTimer.current) {
        clearTimeout(processingNavTimer.current);
        processingNavTimer.current = null;
      }
      return;
    }
    processingNavTimer.current = setTimeout(() => {
      processingNavTimer.current = null;
      closeAll();
    }, 3000);
    return () => {
      if (processingNavTimer.current) {
        clearTimeout(processingNavTimer.current);
        processingNavTimer.current = null;
      }
    };
  }, [phase, closeAll]);

  const discard = () => {
    Alert.alert('Discard?', 'Your edits will be lost.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Discard', style: 'destructive', onPress: closeAll},
    ]);
  };

  const visibilityOptions: {key: Visibility; label: string; Icon: typeof Globe}[] =
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

  // Async processing screen — upload done, HLS transcode in background
  if (phase === 'processing') {
    return (
      <ThemedSafeScreen style={[styles.root, {backgroundColor: palette.background}]}>
        <View style={styles.doneContainer}>
          <Animated.View
            style={[
              styles.doneCircle,
              {backgroundColor: palette.muted ?? '#0f3460', transform: [{scale: scaleAnim}]},
            ]}>
            <ActivityIndicator color={palette.accent} size="large" />
          </Animated.View>
          <Animated.Text style={[styles.doneTitle, {color: palette.foreground, opacity: fadeAnim}]}>
            Posted — processing
          </Animated.Text>
          <Animated.Text
            style={[styles.doneSubtitle, {color: palette.foregroundMuted, opacity: fadeAnim, textAlign: 'center'}]}>
            Your{' '}
            {draft.mode === 'story' ? 'story' : draft.mode === 'reel' ? 'reel' : 'post'} will show up in
            feed and reels after we finish optimizing it.{'\n\n'}
            Returning home in a few seconds…
          </Animated.Text>
          <Pressable
            onPress={() => {
              if (processingNavTimer.current) {
                clearTimeout(processingNavTimer.current);
                processingNavTimer.current = null;
              }
              closeAll();
            }}
            style={{
              marginTop: 24,
              paddingHorizontal: 28,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: palette.accent,
            }}>
            <Text style={{color: '#fff', fontWeight: '600', fontSize: 15}}>Got it</Text>
          </Pressable>
        </View>
      </ThemedSafeScreen>
    );
  }

  // Success screen (sync path — image posts)
  if (phase === 'done') {
    return (
      <ThemedSafeScreen style={[styles.root, {backgroundColor: palette.background}]}>
        <View style={styles.doneContainer}>
          <Animated.View style={[styles.doneCircle, {backgroundColor: palette.accent, transform: [{scale: scaleAnim}]}]}>
            <Check size={48} color={palette.accentForeground} strokeWidth={3} />
          </Animated.View>
          <Animated.Text style={[styles.doneTitle, {color: palette.foreground, opacity: fadeAnim}]}>
            {draft.mode === 'story' ? 'Story shared!' : draft.mode === 'reel' ? 'Reel posted!' : 'Posted!'}
          </Animated.Text>
          <Animated.Text style={[styles.doneSubtitle, {color: palette.foregroundMuted, opacity: fadeAnim}]}>
            Your content is now visible to{' '}
            {draft.visibility === 'public' ? 'everyone' : draft.visibility === 'followers' ? 'your followers' : draft.visibility === 'close_friends' ? 'close friends' : 'you only'}.
          </Animated.Text>

          {/* Summary */}
          <Animated.View style={[styles.doneSummary, {backgroundColor: palette.surface, opacity: fadeAnim}]}>
            {draft.caption ? (
              <Text style={[styles.summaryText, {color: palette.foreground}]} numberOfLines={2}>{draft.caption}</Text>
            ) : null}
            {draft.hashtags.length > 0 && (
              <Text style={[styles.summaryTags, {color: palette.accent}]}>{draft.hashtags.join(' ')}</Text>
            )}
            {draft.location && (
              <View style={styles.summaryRow}>
                <MapPin size={12} color={palette.foregroundMuted} />
                <Text style={[styles.summaryMeta, {color: palette.foregroundMuted}]}>{draft.location.name}</Text>
              </View>
            )}
            {draft.tagged.length > 0 && (
              <View style={styles.summaryRow}>
                <Users size={12} color={palette.foregroundMuted} />
                <Text style={[styles.summaryMeta, {color: palette.foregroundMuted}]}>{draft.tagged.map(t => `@${t.username}`).join(', ')}</Text>
              </View>
            )}
            {draft.products.length > 0 && (
              <View style={styles.summaryRow}>
                <ShoppingBag size={12} color={palette.foregroundMuted} />
                <Text style={[styles.summaryMeta, {color: palette.foregroundMuted}]}>{draft.products.length} product(s) tagged</Text>
              </View>
            )}
            {draft.advanced.commentsOff && (
              <View style={styles.summaryRow}>
                <MessageCircle size={12} color={palette.foregroundMuted} />
                <Text style={[styles.summaryMeta, {color: palette.foregroundMuted}]}>Comments turned off</Text>
              </View>
            )}
            {draft.advanced.hideLikeCount && (
              <View style={styles.summaryRow}>
                <Eye size={12} color={palette.foregroundMuted} />
                <Text style={[styles.summaryMeta, {color: palette.foregroundMuted}]}>Like count hidden</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View style={[styles.doneActions, {opacity: fadeAnim}]}>
            <Pressable style={[styles.doneBtn, {backgroundColor: palette.accent}]} onPress={closeAll}>
              <Text style={[styles.doneBtnTxt, {color: palette.accentForeground}]}>Done</Text>
            </Pressable>
            <Pressable style={[styles.shareMoreBtn, {borderColor: palette.border}]} onPress={closeAll}>
              <Share2 size={16} color={palette.foreground} />
              <Text style={[styles.shareMoreTxt, {color: palette.foreground}]}>Share to other apps</Text>
            </Pressable>
          </Animated.View>
        </View>
      </ThemedSafeScreen>
    );
  }

  // Posting spinner
  if (phase === 'posting') {
    return (
      <ThemedSafeScreen style={[styles.root, {backgroundColor: palette.background}]}>
        <View style={styles.doneContainer}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={[styles.postingText, {color: palette.foreground}]}>Uploading your {draft.mode}…</Text>
          <View style={[styles.progressTrack, {backgroundColor: palette.surfaceHigh}]}>
            <View
              style={[
                styles.progressFill,
                {width: `${Math.round(Math.min(1, uploadProgress) * 100)}%`, backgroundColor: palette.accent},
              ]}
            />
          </View>
          <Text style={[styles.postingSub, {color: palette.foregroundMuted}]}>
            {Math.round(Math.min(1, uploadProgress) * 100)}%
          </Text>
        </View>
      </ThemedSafeScreen>
    );
  }

  // Review phase
  return (
    <ThemedSafeScreen style={[styles.root, {backgroundColor: palette.background}]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.back, {color: palette.accent}]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, {color: palette.foreground}]}>Review & Share</Text>
        <View style={{width: 48}} />
      </View>

      <ScrollView>
        {/* Preview */}
        <ViewShot ref={previewShotRef} style={[styles.preview, {height: W * 1.05, backgroundColor: palette.surface}]} options={{format: 'jpg', quality: 0.92}}>
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
            <Image source={{uri: asset.uri}} style={[styles.media, {transform: [{rotate: `${rotation}deg`}]}]} resizeMode="cover" />
          ) : null}
          {filterStacks.map((layer, idx) => (
            <View
              key={`fs_${idx}`}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {backgroundColor: layer.backgroundColor, opacity: layer.opacity}]}
            />
          ))}
          {draft.textOverlays.map(o => (
            <View key={o.id} style={[styles.txt, {left: o.x, top: o.y}]}>
              <Text style={{color: o.color, fontWeight: '900', fontSize: o.fontSize}}>{o.text}</Text>
            </View>
          ))}
          {draft.stickers.map(st => (
            <View key={st.id} style={[styles.sticker, {left: st.x, top: st.y, backgroundColor: palette.overlay}]}>
              <ShoppingBag size={10} color={palette.foreground} />
              <Text style={[styles.stickerTxt, {color: palette.foreground}]}>{st.label}</Text>
            </View>
          ))}
          {draft.poll.enabled && (
            <View style={[styles.pollOverlay, {backgroundColor: palette.overlay}]}>
              <Text style={[styles.pollQ, {color: palette.foreground}]}>{draft.poll.optionA || 'Option A'}</Text>
              <View style={styles.pollBar}>
                <Pressable style={[styles.pollSeg, {flex: 1 + draft.poll.votesA, backgroundColor: palette.accent}]} onPress={() => votePoll('a')}>
                  <Text style={[styles.pollVotes, {color: palette.accentForeground}]}>{draft.poll.votesA}</Text>
                </Pressable>
                <Pressable style={[styles.pollSegB, {flex: 1 + draft.poll.votesB, backgroundColor: palette.muted}]} onPress={() => votePoll('b')}>
                  <Text style={[styles.pollVotes, {color: palette.mutedForeground}]}>{draft.poll.votesB}</Text>
                </Pressable>
              </View>
              <Text style={[styles.pollQ, {color: palette.foreground}]}>{draft.poll.optionB || 'Option B'}</Text>
            </View>
          )}
          {draft.assets.length > 1 && (
            <View style={styles.carouselIndicator}>
              {draft.assets.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.ciDot,
                    {backgroundColor: palette.placeholder},
                    idx === draft.activeAssetIndex && {backgroundColor: palette.foreground, width: 14},
                  ]}
                />
              ))}
            </View>
          )}
        </ViewShot>

        {/* Caption & metadata */}
        <View style={styles.metaSection}>
          <Text style={[styles.caption, {color: palette.foreground}]}>{draft.caption || 'No caption'}</Text>
          {draft.hashtags.length > 0 && <Text style={[styles.tags, {color: palette.accent}]}>{draft.hashtags.join(' ')}</Text>}
          {draft.location && (
            <View style={styles.metaRow}>
              <MapPin size={14} color={palette.foregroundMuted} />
              <Text style={[styles.metaText, {color: palette.foregroundMuted}]}>{draft.location.name}</Text>
            </View>
          )}
          {draft.tagged.length > 0 && (
            <View style={styles.metaRow}>
              <Users size={14} color={palette.foregroundMuted} />
              <Text style={[styles.metaText, {color: palette.foregroundMuted}]}>{draft.tagged.map(t => `@${t.username}`).join(', ')}</Text>
            </View>
          )}
          {draft.products.length > 0 && (
            <View style={styles.metaRow}>
              <ShoppingBag size={14} color={palette.foregroundMuted} />
              <Text style={[styles.metaText, {color: palette.foregroundMuted}]}>{draft.products.map(p => p.name).join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Feed category (posts & reels) */}
        {(draft.mode === 'post' || draft.mode === 'reel') && (
          <>
            <Text style={[styles.section, {color: palette.foreground}]}>Feed category</Text>
            <Text style={{fontSize: 12, marginBottom: 8, paddingHorizontal: 16, color: palette.foregroundMuted}}>
              Default is General. Pick a topic or type a custom label.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal: 16, gap: 8, paddingBottom: 8}}>
              {FEED_CATEGORY_CHIPS.map(c => {
                const on =
                  draft.feedCategoryManual.trim() === '' && draft.feedCategoryPreset === c.preset;
                return (
                  <Pressable
                    key={c.preset}
                    onPress={() => setFeedCategoryPreset(c.preset)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: on ? palette.accent : palette.border,
                      backgroundColor: on ? palette.accent : palette.surface,
                    }}>
                    <Text style={{fontSize: 12, fontWeight: '700', color: on ? palette.accentForeground : palette.foreground}}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{paddingHorizontal: 16, marginBottom: 12}}>
              <TextInput
                value={draft.feedCategoryManual}
                onChangeText={setFeedCategoryManual}
                placeholder="Custom category (optional)"
                placeholderTextColor={palette.foregroundMuted}
                style={{
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: palette.foreground,
                  backgroundColor: palette.input,
                }}
              />
            </View>
          </>
        )}

        {/* Visibility */}
        <Text style={[styles.section, {color: palette.foreground}]}>Visibility</Text>
        {visibilityOptions.map(o => {
          const selected = draft.visibility === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setVisibility(o.key)}
              style={[
                styles.visRow,
                {borderColor: palette.surfaceHigh, backgroundColor: palette.card},
                selected && {borderColor: palette.accent},
              ]}>
              <o.Icon size={18} color={selected ? palette.accent : palette.foregroundMuted} />
              <Text style={[styles.visTxt, {color: palette.foreground}, selected && {color: palette.accent}]}>{o.label}</Text>
              {selected && <Check size={16} color={palette.accent} />}
            </Pressable>
          );
        })}

        {/* Story options */}
        {draft.mode === 'story' && (
          <>
            <Text style={[styles.section, {color: palette.foreground}]}>Story options</Text>
            <Pressable
              style={[styles.visRow, {borderColor: palette.surfaceHigh, backgroundColor: palette.card}]}
              onPress={() => setStoryOptions({storyAllowReplies: !draft.storyAllowReplies})}>
              <MessageCircle size={18} color={palette.foregroundMuted} />
              <Text style={[styles.visTxt, {color: palette.foreground}]}>Allow replies</Text>
              <Text style={[styles.onOff, {color: palette.foregroundMuted}]}>{draft.storyAllowReplies ? 'On' : 'Off'}</Text>
            </Pressable>
            <Pressable
              style={[styles.visRow, {borderColor: palette.surfaceHigh, backgroundColor: palette.card}]}
              onPress={() => setStoryOptions({storyShareOffPlatform: !draft.storyShareOffPlatform})}>
              <Share2 size={18} color={palette.foregroundMuted} />
              <Text style={[styles.visTxt, {color: palette.foreground}]}>Share to partner apps</Text>
              <Text style={[styles.onOff, {color: palette.foregroundMuted}]}>{draft.storyShareOffPlatform ? 'On' : 'Off'}</Text>
            </Pressable>
          </>
        )}

        {/* Action buttons */}
        <View style={styles.actionGrid}>
          <Pressable style={[styles.actionCard, {backgroundColor: palette.card, borderColor: palette.surfaceHigh}]} onPress={saveDraft} disabled={busy}>
            <Save size={22} color={palette.foreground} />
            <Text style={[styles.actionLabel, {color: palette.foreground}]}>Save draft</Text>
          </Pressable>
          <Pressable style={[styles.actionCard, {backgroundColor: palette.card, borderColor: palette.surfaceHigh}]} onPress={downloadExport}>
            <Download size={22} color={palette.foreground} />
            <Text style={[styles.actionLabel, {color: palette.foreground}]}>Download</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.publishBtn, {backgroundColor: palette.accent}]} onPress={publish}>
          <Send size={18} color={palette.accentForeground} />
          <Text style={[styles.publishTxt, {color: palette.accentForeground}]}>
            {draft.mode === 'story' ? 'Share story' : draft.mode === 'reel' ? 'Share reel' : 'Share post'}
          </Text>
        </Pressable>
        <Pressable style={styles.discard} onPress={discard}>
          <Trash2 size={16} color={palette.destructive} />
          <Text style={[styles.discardTxt, {color: palette.destructive}]}>Discard</Text>
        </Pressable>
        <View style={{height: 40}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8},
  back: {fontSize: 16, fontWeight: '700'},
  headerTitle: {fontSize: 17, fontWeight: '800'},
  preview: {width: '100%', marginTop: 4},
  media: {...StyleSheet.absoluteFillObject},
  txt: {position: 'absolute'},
  sticker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stickerTxt: {fontSize: 11, fontWeight: '800'},
  pollOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
  },
  pollQ: {fontWeight: '800', marginBottom: 4},
  pollBar: {flexDirection: 'row', height: 36, borderRadius: 8, overflow: 'hidden', marginVertical: 6},
  pollSeg: {justifyContent: 'center', alignItems: 'center'},
  pollSegB: {justifyContent: 'center', alignItems: 'center'},
  pollVotes: {fontWeight: '900'},
  carouselIndicator: {position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', gap: 5},
  ciDot: {width: 6, height: 6, borderRadius: 3},
  metaSection: {paddingHorizontal: 14, paddingTop: 12},
  caption: {fontSize: 15, lineHeight: 22},
  tags: {marginTop: 6, fontSize: 14},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6},
  metaText: {fontSize: 13},
  section: {fontWeight: '800', marginLeft: 14, marginTop: 20, fontSize: 15},
  visRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  visTxt: {flex: 1, fontWeight: '600', fontSize: 14},
  onOff: {fontWeight: '700', fontSize: 13},
  actionGrid: {flexDirection: 'row', gap: 10, marginHorizontal: 14, marginTop: 24},
  actionCard: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    gap: 6,
  },
  actionLabel: {fontWeight: '700', fontSize: 13},
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
  },
  publishTxt: {fontWeight: '900', fontSize: 16},
  discard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  discardTxt: {fontWeight: '800', fontSize: 14},
  // Done screen
  doneContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24},
  doneCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {fontSize: 26, fontWeight: '900', marginTop: 24},
  doneSubtitle: {fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22},
  doneSummary: {
    marginTop: 24,
    width: '100%',
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  summaryText: {fontSize: 14, lineHeight: 20},
  summaryTags: {fontSize: 13},
  summaryRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  summaryMeta: {fontSize: 12},
  doneActions: {marginTop: 32, width: '100%', gap: 12},
  doneBtn: {paddingVertical: 16, borderRadius: 14, alignItems: 'center'},
  doneBtnTxt: {fontWeight: '900', fontSize: 16},
  shareMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareMoreTxt: {fontWeight: '700', fontSize: 14},
  postingText: {fontSize: 17, fontWeight: '700', marginTop: 20},
  postingSub: {fontSize: 13, fontWeight: '600', marginTop: 8},
  progressTrack: {width: '80%', maxWidth: 320, height: 8, borderRadius: 4, marginTop: 20, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 4},
});
