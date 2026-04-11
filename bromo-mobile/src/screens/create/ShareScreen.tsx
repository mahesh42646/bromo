import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Video from 'react-native-video';
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
import {FILTER_LAYERS} from '../../create/filterStyles';
import type {Visibility} from '../../create/createTypes';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {uploadMedia, createPost} from '../../api/postsApi';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'ShareFinal'>;

const DRAFT_KEY = 'bromo_ugc_drafts_v1';
const {width: W} = Dimensions.get('window');

type SharePhase = 'review' | 'posting' | 'done';

export function ShareScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {draft, setVisibility, setStoryOptions, votePoll, reset} = useCreateDraft();

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<SharePhase>('review');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const asset = draft.assets[draft.activeAssetIndex] ?? draft.assets[0];
  const filter = draft.filterByAsset[draft.activeAssetIndex] ?? 'normal';
  const layer = FILTER_LAYERS[filter];
  const rotation = draft.rotationByAsset[draft.activeAssetIndex] ?? 0;

  const closeAll = useCallback(() => {
    reset();
    navigation.getParent()?.goBack();
  }, [navigation, reset]);

  const saveDraft = async () => {
    setBusy(true);
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push({savedAt: Date.now(), draft: {...draft}});
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(list.slice(-20)));
      Alert.alert('Saved', 'Draft saved to your device.', [{text: 'OK', onPress: closeAll}]);
    } finally {
      setBusy(false);
    }
  };

  const downloadMock = () => {
    Alert.alert('Downloaded', 'Content saved to Photos (simulated).', [{text: 'OK'}]);
  };

  const publish = async () => {
    if (!asset) {
      Alert.alert('No media', 'Please add a photo or video first.');
      return;
    }
    setPhase('posting');
    try {
      const {url} = await uploadMedia(asset.uri);
      const mediaType = asset.type === 'video' ? 'video' : 'image';
      const postType = draft.mode === 'reel' ? 'reel' : draft.mode === 'story' ? 'story' : 'post';
      await createPost({
        type: postType,
        mediaUrl: url,
        mediaType,
        caption: [draft.caption, ...draft.hashtags].filter(Boolean).join(' ') || undefined,
        location: draft.location?.name,
        music: draft.selectedAudio?.title,
        tags: draft.tagged.map(t => t.username),
      });
      setPhase('done');
    } catch (err) {
      setPhase('review');
      Alert.alert('Failed to post', err instanceof Error ? err.message : 'Try again');
    }
  };

  useEffect(() => {
    if (phase === 'done') {
      Animated.parallel([
        Animated.spring(scaleAnim, {toValue: 1, friction: 4, tension: 60, useNativeDriver: true}),
        Animated.timing(fadeAnim, {toValue: 1, duration: 400, useNativeDriver: true}),
      ]).start();
    }
  }, [phase, scaleAnim, fadeAnim]);

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

  // Success screen
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
          <Animated.View style={[styles.postingCircle, {borderColor: palette.accent}]} />
          <Text style={[styles.postingText, {color: palette.foregroundMuted}]}>Sharing your {draft.mode}...</Text>
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
        <View style={[styles.preview, {height: W * 1.05, backgroundColor: palette.surface}]}>
          {asset?.type === 'video' ? (
            <Video source={{uri: asset.uri}} style={styles.media} resizeMode="cover" repeat muted />
          ) : asset ? (
            <Image source={{uri: asset.uri}} style={[styles.media, {transform: [{rotate: `${rotation}deg`}]}]} resizeMode="cover" />
          ) : null}
          {layer.backgroundColor ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {backgroundColor: layer.backgroundColor, opacity: layer.opacity ?? 0.85}]}
            />
          ) : null}
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
          {/* Carousel indicator */}
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
        </View>

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
          <Pressable style={[styles.actionCard, {backgroundColor: palette.card, borderColor: palette.surfaceHigh}]} onPress={downloadMock}>
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
  postingCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  postingText: {fontSize: 16, fontWeight: '600', marginTop: 20},
});
