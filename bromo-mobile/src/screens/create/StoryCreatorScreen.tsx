/**
 * StoryCreatorScreen — Instagram-like full-screen story creation experience.
 *
 * Flow:
 *  select  → canvas (edit overlays) → posting → done
 *
 * Supported story types:
 *  - Image story   (from gallery or camera)
 *  - Video story   (from gallery or camera)
 *  - Color-bg story (solid/gradient color background; no media required)
 *
 * Overlays:
 *  - Text   (tap Aa → type → pick color → Done → draggable label on canvas)
 *  - Emoji  (open emoji picker → tap emoji → placed on canvas)
 *  - Music  (open music picker → select track → badge on canvas)
 *
 * Sharing:
 *  - "Your Story"   → visibility public  (followers can see)
 *  - "Close Friends"→ visibility close_friends
 */

import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import Video from 'react-native-video';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Check,
  Music2,
  SmilePlus,
  Type,
  X,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {uploadMedia, createPost} from '../../api/postsApi';
import type {StoryOverlay, StoryMeta} from '../../api/postsApi';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList>;

const {width: W, height: H} = Dimensions.get('window');

// ── Color backgrounds ────────────────────────────────────────────────────────
const BG_COLORS = [
  {id: 'navy',   color: '#1a1a2e'},
  {id: 'red',    color: '#e94560'},
  {id: 'sky',    color: '#4facfe'},
  {id: 'mint',   color: '#43e97b'},
  {id: 'pink',   color: '#fa709a'},
  {id: 'orange', color: '#f7971e'},
  {id: 'purple', color: '#764ba2'},
  {id: 'slate',  color: '#2c3e50'},
  {id: 'gold',   color: '#f6d365'},
  {id: 'teal',   color: '#0abde3'},
];

// ── Text overlay colors ────────────────────────────────────────────────────
const TEXT_COLORS = ['#ffffff', '#000000', '#e94560', '#f7971e', '#43e97b', '#4facfe', '#fa709a', '#f6d365'];

// ── Emoji catalog (flattened) ─────────────────────────────────────────────
const EMOJI_SECTIONS = [
  {label: '😊 Faces', emojis: ['😀','😂','😍','🥰','😎','🤩','😢','😡','🥺','😴','🤗','😏','🥳','😇','🤔','😱']},
  {label: '❤️ Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💖','💗','💓','💞','💝','💘','♥️','🫀']},
  {label: '🙌 Gestures', emojis: ['👍','👎','✌️','🤞','🙏','👏','🤙','💪','🫶','👋','🤝','✊','🖐','👌','🤌','🫰']},
  {label: '🔥 Hype', emojis: ['🔥','✨','💫','⚡','🌟','🎉','🎊','🎯','💥','🚀','🌈','☀️','🍀','👑','💎','🏆']},
];

// ── Static audio catalog ───────────────────────────────────────────────────
const AUDIO_CATALOG = [
  {id: 'orig', title: 'Original audio', artist: 'Your video'},
  {id: 'city', title: 'City Nights', artist: 'Lo-Fi Pack'},
  {id: 'drill', title: 'Drill Beat', artist: 'Trending'},
  {id: 'acou', title: 'Acoustic Warm', artist: 'UGC Lite'},
  {id: 'trap', title: 'Trap Vibes', artist: 'Hip Hop'},
  {id: 'chill', title: 'Chill Wave', artist: 'Ambient'},
  {id: 'boom', title: 'BOOM', artist: 'EDM Pack'},
  {id: 'soul', title: 'Soul Keys', artist: 'R&B Vibes'},
];

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'select' | 'canvas' | 'text_edit' | 'emoji_picker' | 'music_picker' | 'posting' | 'done';

type MediaState = {
  uri: string;
  type: 'image' | 'video';
};

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function mapPickerAsset(a: Asset): MediaState | null {
  if (!a.uri) return null;
  const type = a.type === 'video' ? 'video' : 'image';
  return {uri: a.uri, type};
}

// ── Component ──────────────────────────────────────────────────────────────
export function StoryCreatorScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();

  const [phase, setPhase] = useState<Phase>('select');
  const [media, setMedia] = useState<MediaState | null>(null);
  const [bgColor, setBgColor] = useState<string | null>(null);

  // Overlays on the canvas
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);

  // Text editing state
  const [draftText, setDraftText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const textInputRef = useRef<TextInput>(null);

  // Selected music
  const [selectedMusic, setSelectedMusic] = useState<{id: string; title: string; artist: string} | null>(null);

  const closeAll = useCallback(() => {
    navigation.getParent()?.goBack();
  }, [navigation]);

  // ── Media selection helpers ───────────────────────────────────────────────
  const openCamera = () => {
    launchCamera(
      {mediaType: 'mixed', videoQuality: 'high', durationLimit: 60, saveToPhotos: true},
      res => {
        if (res.didCancel || res.errorCode) return;
        const m = mapPickerAsset(res.assets?.[0] ?? ({} as Asset));
        if (m) { setMedia(m); setBgColor(null); setPhase('canvas'); }
      },
    );
  };

  const openGallery = () => {
    launchImageLibrary(
      {mediaType: 'mixed', selectionLimit: 1},
      res => {
        if (res.didCancel || res.errorCode) return;
        const m = mapPickerAsset(res.assets?.[0] ?? ({} as Asset));
        if (m) { setMedia(m); setBgColor(null); setPhase('canvas'); }
      },
    );
  };

  const pickColor = (color: string) => {
    setMedia(null);
    setBgColor(color);
    setPhase('canvas');
  };

  // ── Overlay tools ─────────────────────────────────────────────────────────
  const addTextOverlay = () => {
    if (!draftText.trim()) return;
    const o: StoryOverlay = {
      id: uid(),
      type: 'text',
      content: draftText.trim(),
      x: 0.15 + Math.random() * 0.5,
      y: 0.3 + Math.random() * 0.3,
      color: textColor,
      fontSize: 26,
    };
    setOverlays(prev => [...prev, o]);
    setDraftText('');
    Keyboard.dismiss();
    setPhase('canvas');
  };

  const addEmojiOverlay = (emoji: string) => {
    const o: StoryOverlay = {
      id: uid(),
      type: 'emoji',
      content: emoji,
      x: 0.1 + Math.random() * 0.7,
      y: 0.2 + Math.random() * 0.5,
      fontSize: 40,
    };
    setOverlays(prev => [...prev, o]);
    setPhase('canvas');
  };

  const selectMusic = (track: {id: string; title: string; artist: string}) => {
    setSelectedMusic(track);
    // Remove any existing music badge, then add new one
    const badge: StoryOverlay = {
      id: uid(),
      type: 'music',
      content: `${track.title} • ${track.artist}`,
      x: 0.08,
      y: 0.75,
    };
    setOverlays(prev => [...prev.filter(o => o.type !== 'music'), badge]);
    setPhase('canvas');
  };

  const removeOverlay = (id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const publish = async (closeFriends: boolean) => {
    const isColorBg = !media && bgColor;
    if (!media && !isColorBg) {
      Alert.alert('No content', 'Please select a photo, video, or background color.');
      return;
    }

    setPhase('posting');

    try {
      const storyMeta: StoryMeta = {
        ...(bgColor ? {bgColor} : {}),
        ...(overlays.length > 0 ? {overlays} : {}),
      };

      let mediaUrl = 'color-bg';
      let thumbnailUrl: string | undefined;
      let mediaType: 'image' | 'video' = 'image';

      if (media) {
        const uploaded = await uploadMedia(media.uri, {
          type: media.type,
          category: 'stories',
        });
        mediaUrl = uploaded.url;
        thumbnailUrl = uploaded.thumbnailUrl;
        mediaType = uploaded.mediaType ?? (media.type === 'video' ? 'video' : 'image');
      }

      await createPost({
        type: 'story',
        mediaUrl,
        thumbnailUrl,
        mediaType,
        music: selectedMusic?.title,
        storyMeta,
      });

      setPhase('done');
    } catch (err) {
      setPhase('canvas');
      Alert.alert('Failed to share', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderCanvas = () => (
    <View style={{...StyleSheet.absoluteFillObject}}>
      {/* Background: color or media */}
      {bgColor && !media ? (
        <View style={[StyleSheet.absoluteFill, {backgroundColor: bgColor}]} />
      ) : media?.type === 'video' ? (
        <Video
          source={{uri: media.uri}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          muted
        />
      ) : media ? (
        <Image source={{uri: media.uri}} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      {/* Overlays */}
      {overlays.map(o => (
        <TouchableOpacity
          key={o.id}
          onLongPress={() => removeOverlay(o.id)}
          activeOpacity={0.85}
          style={{
            position: 'absolute',
            left: o.x * W,
            top: o.y * (H * 0.78), // canvas height approx
          }}>
          {o.type === 'music' ? (
            <View style={styles.musicBadge}>
              <Text style={{fontSize: 15}}>🎵</Text>
              <Text style={styles.musicBadgeText}>{o.content}</Text>
            </View>
          ) : (
            <Text
              style={{
                color: o.color ?? '#fff',
                fontSize: o.fontSize ?? 26,
                fontWeight: '800',
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: {width: 0, height: 1},
                textShadowRadius: 4,
              }}>
              {o.content}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Phase: posting ────────────────────────────────────────────────────────
  if (phase === 'posting') {
    return (
      <View style={[styles.root, {backgroundColor: '#000'}]}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.postingText}>Sharing your story…</Text>
      </View>
    );
  }

  // ── Phase: done ───────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <View style={[styles.root, {backgroundColor: '#000'}]}>
        <View style={[styles.doneCircle, {backgroundColor: palette.accent}]}>
          <Check size={40} color="#fff" strokeWidth={3} />
        </View>
        <Text style={styles.doneTitle}>Story shared!</Text>
        <Text style={styles.doneSub}>Your story is now live for 24 hours.</Text>
        <Pressable
          style={[styles.doneBtn, {backgroundColor: palette.accent}]}
          onPress={closeAll}>
          <Text style={styles.doneBtnTxt}>Done</Text>
        </Pressable>
      </View>
    );
  }

  // ── Phase: text_edit ─────────────────────────────────────────────────────
  if (phase === 'text_edit') {
    return (
      <View style={[styles.root, {backgroundColor: 'rgba(0,0,0,0.92)'}]}>
        {/* Canvas behind text editor */}
        {renderCanvas()}
        {/* Dim overlay */}
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.55)'}]} />

        {/* Text input centered */}
        <View style={styles.textEditContainer}>
          <TextInput
            ref={textInputRef}
            value={draftText}
            onChangeText={setDraftText}
            placeholder="Type something…"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={[styles.textInput, {color: textColor}]}
            autoFocus
            multiline
            maxLength={150}
          />
          {/* Color picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.colorRow}
            contentContainerStyle={{gap: 10, paddingHorizontal: 4}}>
            {TEXT_COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => setTextColor(c)}
                style={[
                  styles.colorDot,
                  {backgroundColor: c},
                  textColor === c && styles.colorDotActive,
                ]}
              />
            ))}
          </ScrollView>
        </View>

        {/* Done button */}
        <Pressable
          onPress={addTextOverlay}
          style={[styles.textDoneBtn, {backgroundColor: palette.accent}]}>
          <Text style={styles.textDoneTxt}>Done</Text>
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={() => { Keyboard.dismiss(); setPhase('canvas'); }}
          style={styles.textCancelBtn}
          hitSlop={12}>
          <X size={20} color="#fff" />
        </Pressable>
      </View>
    );
  }

  // ── Phase: emoji_picker ───────────────────────────────────────────────────
  if (phase === 'emoji_picker') {
    return (
      <View style={[styles.root, {backgroundColor: '#000'}]}>
        {renderCanvas()}
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.45)'}]} />

        {/* Bottom sheet */}
        <View style={styles.sheetWrap}>
          <View style={[styles.sheet, {backgroundColor: palette.surface}]}>
            <View style={styles.sheetHandle} />
            <ScrollView style={{maxHeight: H * 0.55}} showsVerticalScrollIndicator={false}>
              {EMOJI_SECTIONS.map(sec => (
                <View key={sec.label} style={{marginBottom: 16}}>
                  <Text style={[styles.emojiSecLabel, {color: palette.foregroundMuted}]}>
                    {sec.label}
                  </Text>
                  <View style={styles.emojiGrid}>
                    {sec.emojis.map(e => (
                      <Pressable key={e} onPress={() => addEmojiOverlay(e)} style={styles.emojiCell}>
                        <Text style={styles.emoji}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Close */}
        <Pressable onPress={() => setPhase('canvas')} style={styles.sheetClose} hitSlop={12}>
          <X size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  // ── Phase: music_picker ───────────────────────────────────────────────────
  if (phase === 'music_picker') {
    return (
      <View style={[styles.root, {backgroundColor: '#000'}]}>
        {renderCanvas()}
        <View style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.45)'}]} />

        {/* Bottom sheet */}
        <View style={styles.sheetWrap}>
          <View style={[styles.sheet, {backgroundColor: palette.surface}]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, {color: palette.foreground}]}>Add Music</Text>
            <ScrollView style={{maxHeight: H * 0.5}} showsVerticalScrollIndicator={false}>
              {AUDIO_CATALOG.map(track => {
                const active = selectedMusic?.id === track.id;
                return (
                  <Pressable
                    key={track.id}
                    onPress={() => selectMusic(track)}
                    style={[
                      styles.trackRow,
                      {borderColor: palette.surfaceHigh},
                      active && {borderColor: palette.accent, backgroundColor: `${palette.accent}18`},
                    ]}>
                    <View style={[styles.trackIcon, {backgroundColor: active ? palette.accent : palette.card}]}>
                      <Music2 size={16} color={active ? '#fff' : palette.foreground} />
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.trackTitle, {color: palette.foreground}]}>{track.title}</Text>
                      <Text style={[styles.trackArtist, {color: palette.foregroundMuted}]}>{track.artist}</Text>
                    </View>
                    {active && <Check size={16} color={palette.accent} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <Pressable onPress={() => setPhase('canvas')} style={styles.sheetClose} hitSlop={12}>
          <X size={22} color="#fff" />
        </Pressable>
      </View>
    );
  }

  // ── Phase: canvas ─────────────────────────────────────────────────────────
  if (phase === 'canvas') {
    return (
      <View style={[styles.root, {backgroundColor: '#000'}]}>
        {renderCanvas()}

        {/* Top bar */}
        <View style={styles.canvasTopBar}>
          <Pressable
            onPress={() => {
              Alert.alert('Discard story?', 'Your edits will be lost.', [
                {text: 'Keep editing', style: 'cancel'},
                {text: 'Discard', style: 'destructive', onPress: () => {
                  setMedia(null);
                  setBgColor(null);
                  setOverlays([]);
                  setSelectedMusic(null);
                  setPhase('select');
                }},
              ]);
            }}
            hitSlop={12}>
            <X size={26} color="#fff" />
          </Pressable>

          {/* Right side tools */}
          <View style={styles.canvasTools}>
            {/* Text tool */}
            <Pressable
              onPress={() => { setDraftText(''); setPhase('text_edit'); }}
              style={styles.toolBtn}
              hitSlop={8}>
              <Type size={22} color="#fff" strokeWidth={2.5} />
              <Text style={styles.toolLabel}>Aa</Text>
            </Pressable>

            {/* Emoji / Sticker tool */}
            <Pressable
              onPress={() => setPhase('emoji_picker')}
              style={styles.toolBtn}
              hitSlop={8}>
              <SmilePlus size={22} color="#fff" />
            </Pressable>

            {/* Music tool */}
            <Pressable
              onPress={() => setPhase('music_picker')}
              style={[styles.toolBtn, selectedMusic && styles.toolBtnActive]}
              hitSlop={8}>
              <Music2 size={22} color={selectedMusic ? '#fff' : '#fff'} />
              {selectedMusic && (
                <View style={styles.toolActiveDot} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Hint label */}
        {overlays.length === 0 && (
          <View pointerEvents="none" style={styles.hintWrap}>
            <Text style={styles.hint}>Long-press any overlay to remove it</Text>
          </View>
        )}

        {/* Bottom: action buttons */}
        <View style={styles.canvasBottom}>
          <Pressable
            style={[styles.closeBtn, {borderColor: '#fff'}]}
            onPress={() => publish(true)}>
            <Text style={styles.closeBtnTxt}>Close Friends</Text>
          </Pressable>

          <Pressable
            style={[styles.storyBtn, {backgroundColor: palette.accent}]}
            onPress={() => publish(false)}>
            <Text style={styles.storyBtnTxt}>Your Story</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Phase: select ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, {backgroundColor: '#000'}]}>
      <StatusBar barStyle="light-content" />

      {/* Close */}
      <Pressable onPress={closeAll} style={styles.selectClose} hitSlop={12}>
        <X size={28} color="#fff" />
      </Pressable>

      {/* Header */}
      <View style={styles.selectHeader}>
        <Text style={styles.selectTitle}>New Story</Text>
      </View>

      {/* Color backgrounds */}
      <Text style={styles.sectionLabel}>Background color</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.colorScroll}
        contentContainerStyle={{gap: 12, paddingHorizontal: 20}}>
        {BG_COLORS.map(bg => (
          <Pressable
            key={bg.id}
            onPress={() => pickColor(bg.color)}
            style={[styles.bgColorSwatch, {backgroundColor: bg.color}]}
          />
        ))}
      </ScrollView>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Camera + Gallery cards */}
      <View style={styles.mediaCards}>
        {/* Camera */}
        <Pressable onPress={openCamera} style={[styles.mediaCard, {backgroundColor: '#1a1a2e'}]}>
          <Text style={styles.mediaCardIcon}>📷</Text>
          <Text style={styles.mediaCardTitle}>Camera</Text>
          <Text style={styles.mediaCardSub}>Take a photo or video</Text>
        </Pressable>

        {/* Gallery */}
        <Pressable onPress={openGallery} style={[styles.mediaCard, {backgroundColor: '#0f3460'}]}>
          <Text style={styles.mediaCardIcon}>🖼️</Text>
          <Text style={styles.mediaCardTitle}>Gallery</Text>
          <Text style={styles.mediaCardSub}>Choose from your photos</Text>
        </Pressable>
      </View>

      {/* Tip */}
      <Text style={styles.tip}>Your story disappears after 24 hours</Text>
    </View>
  );
}


// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Select phase ──────────────────────────────────────────────────────────
  selectClose: {
    position: 'absolute',
    top: 54,
    left: 16,
    zIndex: 10,
  },
  selectHeader: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
  },
  selectTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionLabel: {
    position: 'absolute',
    top: H * 0.16,
    alignSelf: 'flex-start',
    left: 20,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  colorScroll: {
    position: 'absolute',
    top: H * 0.19,
    height: 64,
  },
  bgColorSwatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dividerRow: {
    position: 'absolute',
    top: H * 0.315,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: W,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaCards: {
    position: 'absolute',
    top: H * 0.35,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    width: W,
  },
  mediaCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mediaCardIcon: {fontSize: 36},
  mediaCardTitle: {color: '#fff', fontSize: 15, fontWeight: '800'},
  mediaCardSub: {color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center'},
  tip: {
    position: 'absolute',
    bottom: 48,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },

  // ── Canvas phase ──────────────────────────────────────────────────────────
  canvasTopBar: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  canvasTools: {
    gap: 20,
    alignItems: 'center',
  },
  toolBtn: {
    alignItems: 'center',
    gap: 2,
    padding: 4,
  },
  toolBtnActive: {
    opacity: 1,
  },
  toolLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  toolActiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e94560',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  hintWrap: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  canvasBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  closeBtnTxt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  storyBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  storyBtnTxt: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },

  // ── Text edit phase ───────────────────────────────────────────────────────
  textEditContainer: {
    position: 'absolute',
    top: H * 0.25,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 16,
  },
  textInput: {
    width: '100%',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 60,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  colorRow: {
    maxHeight: 48,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#fff',
    transform: [{scale: 1.2}],
  },
  textDoneBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  textDoneTxt: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  textCancelBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
  },

  // ── Sheet (emoji + music) ─────────────────────────────────────────────────
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  sheetClose: {
    position: 'absolute',
    top: 52,
    left: 16,
  },
  emojiSecLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emojiCell: {
    width: (W - 32 - 6 * 7) / 8,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  emoji: {fontSize: 24},
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  trackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: {fontSize: 14, fontWeight: '700'},
  trackArtist: {fontSize: 12, marginTop: 2},

  // ── Music badge (canvas overlay) ─────────────────────────────────────────
  musicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  musicBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Done screen ───────────────────────────────────────────────────────────
  postingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
  },
  doneCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  doneSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 32,
  },
  doneBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 28,
  },
  doneBtnTxt: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
});
