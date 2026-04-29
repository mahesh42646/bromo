import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ThemedSafeScreen } from '../../components/ui/ThemedSafeScreen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import Video, { ViewType } from 'react-native-video';
import {
  ArrowRight,
  ChevronLeft,
  CircleOff,
  Contrast,
  Crop,
  Droplets,
  Gauge,
  Minus,
  Music2,
  Pause,
  Play,
  RotateCw,
  Smile,
  Sparkles,
  Sun,
  Thermometer,
  Type,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCreateDraft } from '../../create/CreateDraftContext';
import {
  FILTER_IDS,
  TEXT_COLORS,
  allowedCropsForMode,
  aspectRatioFromCrop,
  normalizeCropForMode,
  type FilterId,
} from '../../create/createTypes';
import { DEFAULT_ADJUSTMENTS } from '../../create/createTypes';
import {
  adjustOverlayStyle,
  saturationOverlayStyle,
  vignetteOverlayStyle,
  warmthOverlayStyle,
} from '../../create/editAdjustUtils';
import { FILTER_LABELS, FILTER_LAYER_STACKS } from '../../create/filterStyles';
import type { CreateStackParamList } from '../../navigation/CreateStackNavigator';
import type { ThemePalette } from '../../config/platform-theme';
import { EditorTimeline } from './EditorTimeline';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'MediaEditor'>;

const AUDIO_CATALOG = [
  { id: 'a1', title: 'Original audio', artist: 'BROMO Sound' },
  { id: 'a2', title: 'City Nights', artist: 'Lo-Fi Pack' },
  { id: 'a3', title: 'Drill Beat', artist: 'Trending' },
  { id: 'a4', title: 'Acoustic Warm', artist: 'UGC Lite' },
  { id: 'a5', title: 'Trap Vibes', artist: 'Hip Hop' },
  { id: 'a6', title: 'Chill Wave', artist: 'Ambient' },
];

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3];

const QUICK_STICKERS: Array<{ id: string; label: string }> = [
  { id: 'fire', label: '🔥 Fire' },
  { id: 'love', label: '❤️ Love' },
  { id: 'wow', label: '✨ Wow' },
  { id: 'haha', label: '😂 Haha' },
  { id: 'cool', label: '😎 Cool' },
  { id: 'star', label: '⭐ Star' },
  { id: 'goat', label: '🐐 GOAT' },
  { id: 'shop', label: '🛍️ Shop' },
];

type EditorTool =
  | 'text'
  | 'sticker'
  | 'audio'
  | 'effects'
  | 'adjust'
  | 'crop'
  | 'speed';

const EDITOR_TOOLS: Array<{
  id: EditorTool;
  label: string;
  Icon: typeof Crop;
}> = [
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'sticker', label: 'Sticker', Icon: Smile },
  { id: 'audio', label: 'Audio', Icon: Music2 },
  { id: 'effects', label: 'Effects', Icon: Wand2 },
  { id: 'adjust', label: 'Adjust', Icon: Sun },
  { id: 'crop', label: 'Crop', Icon: Crop },
  { id: 'speed', label: 'Speed', Icon: Gauge },
];

const ADJUST_KEYS = [
  { key: 'brightness', label: 'Brightness', Icon: Sun },
  { key: 'contrast', label: 'Contrast', Icon: Contrast },
  { key: 'saturation', label: 'Saturation', Icon: Droplets },
  { key: 'warmth', label: 'Warmth', Icon: Thermometer },
  { key: 'sharpen', label: 'Sharpen', Icon: Sparkles },
  { key: 'vignette', label: 'Vignette', Icon: CircleOff },
  { key: 'fade', label: 'Fade', Icon: Minus },
] as const;

function renderFilterStacks(filterId: FilterId) {
  const stacks = FILTER_LAYER_STACKS[filterId];
  return stacks.map((layer, idx) => (
    <View
      key={`${filterId}_${idx}`}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: layer.backgroundColor, opacity: layer.opacity },
      ]}
    />
  ));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmtTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec >= 0 ? sec : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const overlayUi = StyleSheet.create({
  overlayText: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeOverlay: {
    marginLeft: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function DraggableTextOverlay({
  overlay,
  palette,
  bounds,
  onUpdate,
  onRemove,
}: {
  overlay: {
    id: string;
    text: string;
    x: number;
    y: number;
    color: string;
    fontSize: number;
    fontStyle: 'normal' | 'bold' | 'italic';
  };
  palette: ThemePalette;
  bounds: { width: number; height: number };
  onUpdate: (id: string, patch: { x: number; y: number }) => void;
  onRemove: (id: string) => void;
}) {
  const baseRef = useRef({ x: overlay.x, y: overlay.y });
  baseRef.current = { x: overlay.x, y: overlay.y };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          baseRef.current = { x: overlay.x, y: overlay.y };
        },
        onPanResponderMove: (_, gesture) => {
          const nextX = clamp(
            baseRef.current.x + gesture.dx,
            10,
            Math.max(10, bounds.width - 72),
          );
          const nextY = clamp(
            baseRef.current.y + gesture.dy,
            10,
            Math.max(10, bounds.height - 72),
          );
          onUpdate(overlay.id, { x: nextX, y: nextY });
        },
      }),
    [bounds.height, bounds.width, onUpdate, overlay.id, overlay.x, overlay.y],
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={[overlayUi.overlayText, { left: overlay.x, top: overlay.y }]}>
      <Text
        style={{
          color: overlay.color,
          fontSize: overlay.fontSize,
          fontWeight: overlay.fontStyle === 'bold' ? '900' : '400',
          fontStyle: overlay.fontStyle === 'italic' ? 'italic' : 'normal',
        }}>
        {overlay.text}
      </Text>
      <Pressable
        style={[overlayUi.removeOverlay, { backgroundColor: palette.overlay }]}
        onPress={() => onRemove(overlay.id)}>
        <X size={12} color={palette.foreground} />
      </Pressable>
    </View>
  );
}

function TrimmingVideo({
  uri,
  palette,
  trimStart,
  trimEnd,
  playbackSpeed,
  paused,
  muted = false,
  resizeMode = 'cover',
  onDuration,
  onTimeUpdate,
  onHydrated,
}: {
  uri: string;
  palette: ThemePalette;
  trimStart: number;
  trimEnd: number;
  playbackSpeed: number;
  paused?: boolean;
  muted?: boolean;
  resizeMode?: 'cover' | 'contain';
  onDuration?: (seconds: number) => void;
  onTimeUpdate?: (seconds: number) => void;
  /** Fires once when the first frame is ready (or on Android when load completes). */
  onHydrated?: () => void;
}) {
  const videoRef = useRef<React.ElementRef<typeof Video>>(null);
  const [dur, setDur] = useState(0);
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setDur(0);
    setReady(false);
    hydratedRef.current = false;
  }, [uri]);

  const markHydrated = useCallback(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setReady(true);
    onHydrated?.();
  }, [onHydrated]);

  const tStart = trimStart * dur;
  const tEnd = trimEnd * dur;

  useEffect(() => {
    if (dur <= 0) return;
    videoRef.current?.seek(tStart);
  }, [trimStart, trimEnd, dur, tStart]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {!ready && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.background,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            },
          ]}>
          <ActivityIndicator color={palette.foregroundMuted} />
        </View>
      )}
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        repeat={false}
        muted={muted}
        paused={paused}
        rate={playbackSpeed}
        playInBackground={false}
        viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
        shutterColor="transparent"
        bufferConfig={{
          minBufferMs: 250,
          maxBufferMs: 8000,
          bufferForPlaybackMs: 100,
          bufferForPlaybackAfterRebufferMs: 400,
        }}
        onLoad={e => {
          const d = e.duration ?? 0;
          setDur(d);
          onDuration?.(d);
          if (d > 0) {
            videoRef.current?.seek(trimStart * d);
          }
          if (Platform.OS === 'android') {
            markHydrated();
          }
        }}
        onReadyForDisplay={() => markHydrated()}
        progressUpdateInterval={120}
        onProgress={p => {
          onTimeUpdate?.(p.currentTime);
          if (dur <= 0 || tEnd <= tStart) return;
          if (p.currentTime >= tEnd - 0.06) {
            videoRef.current?.seek(tStart);
          }
        }}
      />
    </View>
  );
}

type ToolSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  palette: ThemePalette;
  children: React.ReactNode;
  height?: number;
};

function ToolSheet({
  visible,
  title,
  subtitle,
  onClose,
  palette,
  children,
  height = 320,
}: ToolSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={sheetStyles.root}>
        <Pressable style={sheetStyles.backdrop} onPress={onClose} />
        <View
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: palette.card,
              borderTopColor: palette.hairline,
              height,
            },
          ]}>
          <View
            style={[
              sheetStyles.handle,
              { backgroundColor: palette.borderHeavy },
            ]}
          />
          <View style={sheetStyles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[sheetStyles.title, { color: palette.foreground }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    sheetStyles.subtitle,
                    { color: palette.foregroundSubtle },
                  ]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[
                sheetStyles.closeBtn,
                { backgroundColor: palette.surface },
              ]}>
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
  root: { flex: 1 },
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
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 4 },
});

export function MediaEditorScreen() {
  const navigation = useNavigation<Nav>();
  const { width: viewportW, height: viewportH } = useWindowDimensions();
  const { palette } = useTheme();
  const styles = makeStyles(palette);
  const {
    draft,
    reorderAssets,
    setActiveAssetIndex,
    setFilterForActive,
    setAdjustForActive,
    rotateActive,
    setCropForActive,
    setTrimForActive,
    setPlaybackSpeed,
    setSelectedAudio,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    addSticker,
    endMediaImportOverlay,
  } = useCreateDraft();

  const assets = draft.assets;
  const i = draft.activeAssetIndex;
  const cur = assets[i];
  const filter = draft.filterByAsset[i] ?? 'normal';
  const adjustments = draft.adjustByAsset[i] ?? { ...DEFAULT_ADJUSTMENTS };
  const rotation = draft.rotationByAsset[i] ?? 0;
  const effectiveCrop = normalizeCropForMode(draft.cropByAsset[i], draft.mode);
  const trimStart = draft.trimStartByAsset[i] ?? 0;
  const trimEnd = draft.trimEndByAsset[i] ?? 1;

  const previewGateDoneRef = useRef(false);
  useEffect(() => {
    previewGateDoneRef.current = false;
  }, [cur?.uri]);

  const markPreviewGateDone = useCallback(() => {
    if (previewGateDoneRef.current) return;
    previewGateDoneRef.current = true;
    endMediaImportOverlay();
  }, [endMediaImportOverlay]);

  useEffect(() => {
    if (!cur) {
      endMediaImportOverlay();
    }
  }, [cur, endMediaImportOverlay]);

  useEffect(() => {
    return () => {
      endMediaImportOverlay();
    };
  }, [endMediaImportOverlay]);

  useEffect(() => {
    if (!cur?.uri) return;
    const t = setTimeout(() => {
      endMediaImportOverlay();
    }, 120_000);
    return () => clearTimeout(t);
  }, [cur?.uri, endMediaImportOverlay]);

  const [activeTool, setActiveTool] = useState<EditorTool | null>(null);
  const [activeAdjustKey, setActiveAdjustKey] =
    useState<(typeof ADJUST_KEYS)[number]['key']>('brightness');
  const [textDraft, setTextDraft] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textSize, setTextSize] = useState(18);
  const [videoDurationSec, setVideoDurationSec] = useState(() =>
    cur?.type === 'video' && typeof cur.duration === 'number'
      ? cur.duration
      : 0,
  );
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewTimeSec, setPreviewTimeSec] = useState(0);
  const activeAdjustDef =
    ADJUST_KEYS.find(item => item.key === activeAdjustKey) ?? ADJUST_KEYS[0];

  const closeTool = useCallback(() => setActiveTool(null), []);

  const carouselRef = useRef<FlatList>(null);

  useEffect(() => {
    if (
      cur?.type === 'video' &&
      typeof cur.duration === 'number' &&
      cur.duration > 0
    ) {
      setVideoDurationSec(cur.duration);
    } else if (cur?.type === 'video') {
      setVideoDurationSec(0);
    }
  }, [cur?.uri, cur?.type, cur?.duration]);

  const aspectRatio = aspectRatioFromCrop(effectiveCrop);
  const previewResize: 'cover' | 'contain' = 'cover';

  const cropChoices = useMemo(
    () => allowedCropsForMode(draft.mode).map(id => ({ id, label: id })),
    [draft.mode],
  );

  const editorDockTools = useMemo(
    () =>
      draft.mode === 'live'
        ? EDITOR_TOOLS.filter(t => t.id !== 'crop')
        : EDITOR_TOOLS,
    [draft.mode],
  );

  useEffect(() => {
    if (draft.mode === 'live' && activeTool === 'crop') setActiveTool(null);
  }, [draft.mode, activeTool]);
  // Allow stage to grow but never overflow vertically.
  const stageMaxH = Math.max(280, viewportH * 0.56);
  const stageMaxW = Math.max(220, Math.min(viewportW - 24, 480));
  const previewW = Math.max(180, Math.min(stageMaxW, stageMaxH * aspectRatio));
  const previewHeight = previewW / aspectRatio;

  const adjustOverlay = adjustOverlayStyle(adjustments);
  const warmOv = warmthOverlayStyle(adjustments);
  const satOv = saturationOverlayStyle(adjustments);
  const vigOv = vignetteOverlayStyle(adjustments);

  const onTrimChange = useCallback(
    (range: [number, number]) => {
      setTrimForActive(range[0], range[1]);
      if (videoDurationSec > 0) {
        setPreviewTimeSec(Math.max(0, range[0]) * videoDurationSec);
      }
    },
    [setTrimForActive, videoDurationSec],
  );

  const swipeToAsset = useCallback(
    (idx: number) => {
      setActiveAssetIndex(idx);
      carouselRef.current?.scrollToIndex({ index: idx, animated: true });
    },
    [setActiveAssetIndex],
  );

  const moveActiveAsset = useCallback(
    (direction: -1 | 1) => {
      const next = Math.max(0, Math.min(assets.length - 1, i + direction));
      if (next === i) return;
      reorderAssets(i, next);
      requestAnimationFrame(() => {
        carouselRef.current?.scrollToIndex({index: next, animated: true});
      });
    },
    [assets.length, i, reorderAssets],
  );

  const addOverlayText = useCallback(() => {
    const text = textDraft.trim();
    if (!text) return;
    addTextOverlay({
      text,
      x: 24,
      y: 120 + draft.textOverlays.length * 32,
      color: textColor,
      fontSize: textSize,
      fontStyle: 'bold',
    });
    setTextDraft('');
    setActiveTool(null);
  }, [
    addTextOverlay,
    draft.textOverlays.length,
    textColor,
    textDraft,
    textSize,
  ]);

  const onPickSticker = useCallback(
    (sticker: { id: string; label: string }) => {
      addSticker({
        productId: sticker.id,
        label: sticker.label,
        x: 24,
        y: 80,
      });
      setActiveTool(null);
    },
    [addSticker],
  );

  if (!cur) {
    return (
      <ThemedSafeScreen style={styles.dark}>
        <Text style={styles.white}>No media</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </ThemedSafeScreen>
    );
  }

  const renderPreviewCanvas = (
    item: typeof cur,
    isActive: boolean,
    extras: {
      f: FilterId;
      r: number;
      adjOverlay: ReturnType<typeof adjustOverlayStyle>;
      wOv: ReturnType<typeof warmthOverlayStyle>;
      sOv: ReturnType<typeof saturationOverlayStyle>;
      vOv: ReturnType<typeof vignetteOverlayStyle>;
      ts: number;
      te: number;
    },
  ) => (
    <View
      style={[styles.previewFrame, { width: previewW, height: previewHeight }]}>
      <View
        style={[styles.media, { transform: [{ rotate: `${extras.r}deg` }] }]}>
        {item.type === 'video' ? (
          <TrimmingVideo
            uri={item.uri}
            palette={palette}
            trimStart={extras.ts}
            trimEnd={extras.te}
            playbackSpeed={draft.playbackSpeed}
            paused={isActive ? previewPaused : true}
            muted={isActive ? previewMuted : true}
            resizeMode={previewResize}
            onDuration={isActive ? setVideoDurationSec : undefined}
            onTimeUpdate={isActive ? setPreviewTimeSec : undefined}
            onHydrated={isActive ? markPreviewGateDone : undefined}
          />
        ) : (
          <Image
            source={{ uri: item.uri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={previewResize}
            onLoadEnd={isActive ? markPreviewGateDone : undefined}
            onError={isActive ? markPreviewGateDone : undefined}
          />
        )}
        {renderFilterStacks(extras.f)}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, extras.adjOverlay]}
        />
        {extras.wOv ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, extras.wOv]}
          />
        ) : null}
        {extras.sOv ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, extras.sOv]}
          />
        ) : null}
        {extras.vOv ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, extras.vOv]}
          />
        ) : null}
        {draft.textOverlays.map(o => (
          <DraggableTextOverlay
            key={o.id}
            overlay={o}
            palette={palette}
            bounds={{ width: previewW, height: previewHeight }}
            onUpdate={updateTextOverlay}
            onRemove={removeTextOverlay}
          />
        ))}
        {draft.stickers.map(sticker => (
          <View
            key={sticker.id}
            style={[
              styles.stagedSticker,
              {
                left: sticker.x,
                top: sticker.y,
                backgroundColor: 'rgba(0,0,0,0.55)',
              },
            ]}>
            <Text style={styles.stagedStickerText}>{sticker.label}</Text>
          </View>
        ))}
      </View>
      {item.type === 'video' && isActive ? (
        <Pressable
          onPress={() => setPreviewMuted(v => !v)}
          style={styles.muteButton}
          hitSlop={8}>
          {previewMuted ? (
            <VolumeX size={16} color="#fff" />
          ) : (
            <Volume2 size={16} color="#fff" />
          )}
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <ThemedSafeScreen style={styles.dark}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          hitSlop={12}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Edit
        </Text>
        <Pressable
          onPress={() => navigation.navigate('ShareFinal')}
          style={[styles.headerNextBtn, { backgroundColor: palette.accent }]}>
          <ArrowRight size={20} color={palette.accentForeground} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        {assets.length > 1 ? (
          <>
            <FlatList
              ref={carouselRef}
              data={assets}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, idx) => `asset_${idx}`}
              getItemLayout={(_, index) => ({
                length: viewportW,
                offset: viewportW * index,
                index,
              })}
              onMomentumScrollEnd={e => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / viewportW,
                );
                setActiveAssetIndex(idx);
              }}
              renderItem={({ item, index }) => {
                const f = (draft.filterByAsset[index] ?? 'normal') as FilterId;
                const r = draft.rotationByAsset[index] ?? 0;
                const adj = draft.adjustByAsset[index] ?? {
                  ...DEFAULT_ADJUSTMENTS,
                };
                const ts = draft.trimStartByAsset[index] ?? 0;
                const te = draft.trimEndByAsset[index] ?? 1;
                const ao = adjustOverlayStyle(adj);
                const wO = warmthOverlayStyle(adj);
                const sO = saturationOverlayStyle(adj);
                const vO = vignetteOverlayStyle(adj);
                return (
                  <View
                    style={[
                      styles.carouselPage,
                      { width: viewportW, height: previewHeight },
                    ]}>
                    {renderPreviewCanvas(item, index === i, {
                      f,
                      r,
                      adjOverlay: ao,
                      wOv: wO,
                      sOv: sO,
                      vOv: vO,
                      ts,
                      te,
                    })}
                  </View>
                );
              }}
            />
            <View style={styles.dots}>
              {assets.map((_, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => swipeToAsset(idx)}
                  hitSlop={8}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: palette.borderMid },
                      idx === i && {
                        backgroundColor: palette.foreground,
                        width: 14,
                      },
                    ]}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.orderPanel}>
              <Pressable
                disabled={i === 0}
                onPress={() => moveActiveAsset(-1)}
                style={[styles.orderButton, i === 0 && styles.orderButtonDisabled]}>
                <ChevronLeft size={16} color={palette.foreground} />
                <Text style={styles.orderButtonText}>Move left</Text>
              </Pressable>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{i + 1}</Text>
                <Text style={styles.orderBadgeSub}>of {assets.length}</Text>
              </View>
              <Pressable
                disabled={i === assets.length - 1}
                onPress={() => moveActiveAsset(1)}
                style={[styles.orderButton, i === assets.length - 1 && styles.orderButtonDisabled]}>
                <Text style={styles.orderButtonText}>Move right</Text>
                <ArrowRight size={16} color={palette.foreground} />
              </Pressable>
            </View>
          </>
        ) : (
          renderPreviewCanvas(cur, true, {
            f: filter as FilterId,
            r: rotation,
            adjOverlay: adjustOverlay,
            wOv: warmOv,
            sOv: satOv,
            vOv: vigOv,
            ts: trimStart,
            te: trimEnd,
          })
        )}
      </View>

      {cur.type === 'video' ? (
        <View
          style={[
            styles.playbackBar,
            { borderTopColor: palette.hairline },
          ]}>
          <Pressable
            onPress={() => setPreviewPaused(p => !p)}
            style={[
              styles.playBtn,
              { backgroundColor: palette.surfaceHigh },
            ]}
            hitSlop={6}>
            {previewPaused ? (
              <Play size={16} color={palette.foreground} />
            ) : (
              <Pause size={16} color={palette.foreground} />
            )}
          </Pressable>
          <Text style={[styles.timeText, { color: palette.foreground }]}>
            {fmtTime(previewTimeSec)}{' '}
            <Text style={{ color: palette.foregroundSubtle }}>
              / {fmtTime(videoDurationSec)}
            </Text>
          </Text>
          <View style={{ flex: 1 }} />
          <Text
            style={{
              color: palette.foregroundSubtle,
              fontSize: 11,
              fontWeight: '900',
              marginRight: 10,
            }}>
            {draft.playbackSpeed}x
          </Text>
          <Pressable
            onPress={() => setPreviewMuted(v => !v)}
            style={[
              styles.iconChip,
              { backgroundColor: palette.surfaceHigh },
            ]}
            hitSlop={8}>
            {previewMuted ? (
              <VolumeX size={15} color={palette.foreground} />
            ) : (
              <Volume2 size={15} color={palette.foreground} />
            )}
          </Pressable>
        </View>
      ) : null}

      {cur.type === 'video' && videoDurationSec > 0 ? (
        <View style={[styles.timelineWrap, { borderTopColor: palette.hairline }]}>
          <EditorTimeline
            palette={palette}
            durationSec={videoDurationSec}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimChange={onTrimChange}
            zoom={timelineZoom}
            onZoomChange={setTimelineZoom}
          />
        </View>
      ) : null}

      <View
        style={[
          styles.toolDock,
          {
            backgroundColor: palette.card,
            borderTopColor: palette.hairline,
          },
        ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolRow}>
          {editorDockTools.map(({ id, label, Icon }) => (
            <Pressable
              key={id}
              onPress={() => setActiveTool(id)}
              style={styles.toolItem}
              hitSlop={6}>
              <View
                style={[
                  styles.toolIconWrap,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}>
                <Icon size={20} color={palette.foreground} />
              </View>
              <Text
                style={[styles.toolLabel, { color: palette.foregroundMuted }]}>
                {label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={rotateActive}
            style={styles.toolItem}
            hitSlop={6}>
            <View
              style={[
                styles.toolIconWrap,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}>
              <RotateCw size={20} color={palette.foreground} />
            </View>
            <Text
              style={[styles.toolLabel, { color: palette.foregroundMuted }]}>
              Rotate
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Effects (filters) sheet */}
      <ToolSheet
        visible={activeTool === 'effects'}
        onClose={closeTool}
        title="Effects"
        subtitle="Tap a filter to apply it instantly"
        palette={palette}
        height={260}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {FILTER_IDS.map(fid => (
            <Pressable
              key={fid}
              onPress={() => setFilterForActive(fid as FilterId)}
              style={[
                styles.filterChip,
                filter === fid && { borderColor: palette.accent },
              ]}>
              <View style={styles.filterThumb}>
                {cur.type === 'video' ? (
                  <Video
                    source={{ uri: cur.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    paused
                    muted
                    repeat={false}
                    viewType={
                      Platform.OS === 'android' ? ViewType.TEXTURE : undefined
                    }
                    shutterColor="transparent"
                  />
                ) : (
                  <Image
                    source={{ uri: cur.uri }}
                    style={styles.filterImg}
                  />
                )}
                {renderFilterStacks(fid as FilterId)}
              </View>
              <Text
                style={[
                  styles.filterName,
                  { color: palette.foregroundMuted },
                  filter === fid && { color: palette.accent },
                ]}
                numberOfLines={1}>
                {FILTER_LABELS[fid]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </ToolSheet>

      {/* Adjust sheet */}
      <ToolSheet
        visible={activeTool === 'adjust'}
        onClose={closeTool}
        title="Adjust"
        subtitle={`${activeAdjustDef.label}: ${Math.round(
          adjustments[
            activeAdjustDef.key as keyof typeof adjustments
          ] * 100,
        )}`}
        palette={palette}
        height={310}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hitRow}>
          {ADJUST_KEYS.map(({ key, label, Icon }) => {
            const active = activeAdjustKey === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveAdjustKey(key)}
                style={[
                  styles.adjustChip,
                  {
                    borderColor: active ? palette.accent : palette.border,
                    backgroundColor: active
                      ? palette.accent
                      : palette.surface,
                  },
                ]}>
                <Icon
                  size={14}
                  color={
                    active ? palette.accentForeground : palette.foregroundMuted
                  }
                />
                <Text
                  style={[
                    styles.adjustChipText,
                    {
                      color: active
                        ? palette.accentForeground
                        : palette.foreground,
                    },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.adjustSliderWrap}>
          <Slider
            minimumValue={-1}
            maximumValue={1}
            step={0.01}
            value={
              adjustments[activeAdjustDef.key as keyof typeof adjustments]
            }
            onValueChange={v =>
              setAdjustForActive({ [activeAdjustDef.key]: v })
            }
            minimumTrackTintColor={palette.accent}
            maximumTrackTintColor={palette.foregroundFaint}
            thumbTintColor={palette.foreground}
          />
          <Pressable
            onPress={() =>
              setAdjustForActive({ [activeAdjustDef.key]: 0 })
            }
            style={[
              styles.resetBtn,
              { borderColor: palette.border },
            ]}>
            <Text
              style={[styles.resetBtnText, { color: palette.foreground }]}>
              Reset
            </Text>
          </Pressable>
        </View>
      </ToolSheet>

      {/* Crop sheet */}
      <ToolSheet
        visible={activeTool === 'crop'}
        onClose={closeTool}
        title="Crop"
        subtitle="Pick a frame ratio for your media"
        palette={palette}
        height={210}>
        <View style={styles.cropRow}>
          {cropChoices.map(c => (
            <Pressable
              key={c.id}
              onPress={() => setCropForActive(c.id)}
              style={[
                styles.cropChip,
                {
                  borderColor:
                    effectiveCrop === c.id ? palette.accent : palette.border,
                  backgroundColor:
                    effectiveCrop === c.id ? palette.accent : palette.surface,
                },
              ]}>
              <Text
                style={[
                  styles.cropLabel,
                  { color: palette.foreground },
                  effectiveCrop === c.id && { color: palette.accentForeground },
                ]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ToolSheet>

      {/* Speed sheet */}
      <ToolSheet
        visible={activeTool === 'speed'}
        onClose={closeTool}
        title="Speed"
        subtitle="Adjust playback rate"
        palette={palette}
        height={200}>
        <View style={styles.cropRow}>
          {SPEED_OPTIONS.map(s => (
            <Pressable
              key={s}
              onPress={() => setPlaybackSpeed(s)}
              style={[
                styles.cropChip,
                {
                  borderColor:
                    draft.playbackSpeed === s
                      ? palette.accent
                      : palette.border,
                  backgroundColor:
                    draft.playbackSpeed === s
                      ? palette.accent
                      : palette.surface,
                },
              ]}>
              <Text
                style={[
                  styles.cropLabel,
                  { color: palette.foreground },
                  draft.playbackSpeed === s && {
                    color: palette.accentForeground,
                  },
                ]}>
                {s}x
              </Text>
            </Pressable>
          ))}
        </View>
      </ToolSheet>

      {/* Audio sheet */}
      <ToolSheet
        visible={activeTool === 'audio'}
        onClose={closeTool}
        title="Audio"
        subtitle="Pick a track or keep original"
        palette={palette}
        height={290}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.audioRow}>
          <Pressable
            onPress={() => setSelectedAudio(null)}
            style={[
              styles.audioCard,
              {
                backgroundColor: palette.surface,
                borderColor: !draft.selectedAudio
                  ? palette.accent
                  : palette.border,
              },
            ]}>
            <Music2 size={16} color={palette.foreground} />
            <Text
              style={[styles.audioTitle, { color: palette.foreground }]}>
              No music
            </Text>
            <Text
              style={[
                styles.audioArtist,
                { color: palette.foregroundSubtle },
              ]}>
              Original
            </Text>
          </Pressable>
          {AUDIO_CATALOG.map(track => (
            <Pressable
              key={track.id}
              onPress={() => setSelectedAudio(track)}
              style={[
                styles.audioCard,
                {
                  backgroundColor: palette.surface,
                  borderColor:
                    draft.selectedAudio?.id === track.id
                      ? palette.accent
                      : palette.border,
                },
              ]}>
              <Music2 size={16} color={palette.foreground} />
              <Text
                style={[styles.audioTitle, { color: palette.foreground }]}
                numberOfLines={1}>
                {track.title}
              </Text>
              <Text
                style={[
                  styles.audioArtist,
                  { color: palette.foregroundSubtle },
                ]}
                numberOfLines={1}>
                {track.artist}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </ToolSheet>

      {/* Text sheet */}
      <ToolSheet
        visible={activeTool === 'text'}
        onClose={closeTool}
        title="Text"
        subtitle="Add overlay text. Drag in preview."
        palette={palette}
        height={340}>
        <View
          style={[
            styles.textBox,
            {
              backgroundColor: palette.input,
              borderColor: palette.border,
            },
          ]}>
          <TextInput
            value={textDraft}
            onChangeText={setTextDraft}
            placeholder="Type something"
            placeholderTextColor={palette.placeholder}
            style={[styles.textInput, { color: textColor }]}
            autoFocus
          />
          <Pressable
            onPress={addOverlayText}
            style={[
              styles.addTextBtn,
              { backgroundColor: palette.accent },
            ]}>
            <Text
              style={{
                color: palette.accentForeground,
                fontWeight: '900',
              }}>
              Add
            </Text>
          </Pressable>
        </View>
        <Text
          style={[
            styles.miniLabel,
            { color: palette.foregroundSubtle },
          ]}>
          Color
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorRow}>
          {TEXT_COLORS.map(c => (
            <Pressable
              key={c}
              onPress={() => setTextColor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                textColor === c && {
                  borderWidth: 3,
                  borderColor: palette.accent,
                },
              ]}
            />
          ))}
        </ScrollView>
        <Text
          style={[
            styles.miniLabel,
            { color: palette.foregroundSubtle },
          ]}>
          Size
        </Text>
        <Slider
          minimumValue={12}
          maximumValue={48}
          step={2}
          value={textSize}
          onValueChange={setTextSize}
          minimumTrackTintColor={palette.accent}
          maximumTrackTintColor={palette.foregroundFaint}
          thumbTintColor={palette.foreground}
        />
      </ToolSheet>

      {/* Sticker sheet */}
      <ToolSheet
        visible={activeTool === 'sticker'}
        onClose={closeTool}
        title="Sticker"
        subtitle="Tap a sticker to drop it on your media"
        palette={palette}
        height={300}>
        <View style={styles.stickerGrid}>
          {QUICK_STICKERS.map(sticker => (
            <Pressable
              key={sticker.id}
              onPress={() => onPickSticker(sticker)}
              style={[
                styles.stickerCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}>
              <Text
                style={[
                  styles.stickerCardText,
                  { color: palette.foreground },
                ]}>
                {sticker.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ToolSheet>
    </ThemedSafeScreen>
  );
}

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    dark: { flex: 1, backgroundColor: p.background },
    white: { color: p.foreground },
    link: { color: p.accent, marginTop: 12 },

    /* Header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 8,
      gap: 12,
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
    headerNextBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Stage */
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: p.background,
    },
    carouselPage: { alignItems: 'center', justifyContent: 'center' },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    orderPanel: {
      marginTop: 10,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 4,
    },
    orderButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 19,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.borderMid,
    },
    orderButtonDisabled: {opacity: 0.35},
    orderButtonText: {color: p.foreground, fontSize: 12, fontWeight: '800'},
    orderBadge: {
      minWidth: 58,
      minHeight: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.borderHeavy,
    },
    orderBadgeText: {color: p.foreground, fontSize: 15, fontWeight: '900'},
    orderBadgeSub: {color: p.muted, fontSize: 10, fontWeight: '800'},
    previewFrame: {
      backgroundColor: '#000',
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: p.borderHeavy,
    },
    media: { flex: 1, overflow: 'hidden' },
    muteButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.35)',
      zIndex: 8,
    },
    stagedSticker: {
      position: 'absolute',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
    },
    stagedStickerText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },

    /* Playback bar */
    playbackBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    playBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconChip: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeText: {
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },

    /* Timeline wrap */
    timelineWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 4,
    },

    /* Tool dock (bottom) */
    toolDock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingVertical: 10,
    },
    toolRow: {
      paddingHorizontal: 14,
      gap: 16,
      alignItems: 'center',
    },
    toolItem: {
      width: 64,
      alignItems: 'center',
      gap: 6,
    },
    toolIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    toolLabel: {
      fontSize: 11,
      fontWeight: '700',
    },

    /* Sheet content shared */
    hitRow: {
      gap: 8,
      paddingRight: 8,
      alignItems: 'center',
    },

    /* Filters */
    filterRow: { gap: 12, paddingRight: 4, paddingTop: 4 },
    filterChip: {
      width: 78,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 14,
      paddingBottom: 6,
      paddingTop: 4,
    },
    filterThumb: {
      width: 68,
      height: 68,
      borderRadius: 12,
      overflow: 'hidden',
    },
    filterImg: { width: '100%', height: '100%' },
    filterName: {
      fontSize: 11,
      marginTop: 6,
      fontWeight: '700',
    },

    /* Adjust */
    adjustChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    adjustChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    adjustSliderWrap: {
      marginTop: 18,
      gap: 14,
    },
    resetBtn: {
      alignSelf: 'center',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    resetBtnText: { fontSize: 12, fontWeight: '900' },

    /* Crop / Speed */
    cropRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingTop: 4,
    },
    cropChip: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    cropLabel: { fontWeight: '800', fontSize: 13 },

    /* Audio */
    audioRow: { gap: 10, paddingRight: 4, paddingTop: 4 },
    audioCard: {
      width: 130,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      gap: 4,
    },
    audioTitle: { fontSize: 13, fontWeight: '800', marginTop: 6 },
    audioArtist: { fontSize: 11 },

    /* Text */
    textBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 10,
      borderWidth: 1,
    },
    textInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
    addTextBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    miniLabel: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.4,
      marginTop: 14,
      marginBottom: 6,
    },
    colorRow: { gap: 10 },
    colorDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: p.surfaceHigh,
    },

    /* Stickers */
    stickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingTop: 4,
    },
    stickerCard: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    stickerCardText: {
      fontSize: 14,
      fontWeight: '800',
    },
  });
}
