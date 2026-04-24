import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
  ChevronLeft,
  Crop,
  Lock,
  Music2,
  Pause,
  Plus,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  Sparkles,
  CircleOff,
  Type,
  Minus,
  Play,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useCreateDraft } from '../../create/CreateDraftContext';
import {
  FILTER_IDS,
  TEXT_COLORS,
  type CropAspect,
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
import {
  CreateModeSegment,
  StudioProgress,
  StudioSection,
} from './CreateStudioUI';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'MediaEditor'>;

const AUDIO_CATALOG = [
  { id: 'a1', title: 'Original audio', artist: 'BROMO Sound' },
  { id: 'a2', title: 'City Nights', artist: 'Lo-Fi Pack' },
  { id: 'a3', title: 'Drill Beat', artist: 'Trending' },
  { id: 'a4', title: 'Acoustic Warm', artist: 'UGC Lite' },
  { id: 'a5', title: 'Trap Vibes', artist: 'Hip Hop' },
  { id: 'a6', title: 'Chill Wave', artist: 'Ambient' },
];

const CROP_OPTIONS: { id: CropAspect; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '16:9', label: '16:9' },
];

type EditorTab = 'edit' | 'filters' | 'adjust' | 'audio' | 'text';

const EDITOR_TABS: Array<{ id: EditorTab; label: string; Icon: typeof Crop }> =
  [
    { id: 'edit', label: 'Edit', Icon: Crop },
    { id: 'filters', label: 'Filters', Icon: SlidersHorizontal },
    { id: 'adjust', label: 'Adjust', Icon: Sun },
    { id: 'audio', label: 'Audio', Icon: Music2 },
    { id: 'text', label: 'Text', Icon: Type },
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
  bounds: {width: number; height: number};
  onUpdate: (id: string, patch: {x: number; y: number}) => void;
  onRemove: (id: string) => void;
}) {
  const baseRef = useRef({x: overlay.x, y: overlay.y});
  baseRef.current = {x: overlay.x, y: overlay.y};

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          baseRef.current = {x: overlay.x, y: overlay.y};
        },
        onPanResponderMove: (_, gesture) => {
          const nextX = clamp(baseRef.current.x + gesture.dx, 10, Math.max(10, bounds.width - 72));
          const nextY = clamp(baseRef.current.y + gesture.dy, 10, Math.max(10, bounds.height - 72));
          onUpdate(overlay.id, {x: nextX, y: nextY});
        },
      }),
    [bounds.height, bounds.width, onUpdate, overlay.id, overlay.x, overlay.y],
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={[overlayUi.overlayText, {left: overlay.x, top: overlay.y}]}>
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
        style={[overlayUi.removeOverlay, {backgroundColor: palette.overlay}]}
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
  onDuration,
  onTimeUpdate,
}: {
  uri: string;
  palette: ThemePalette;
  trimStart: number;
  trimEnd: number;
  playbackSpeed: number;
  paused?: boolean;
  onDuration?: (seconds: number) => void;
  onTimeUpdate?: (seconds: number) => void;
}) {
  const videoRef = useRef<React.ElementRef<typeof Video>>(null);
  const [dur, setDur] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDur(0);
    setReady(false);
  }, [uri]);

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
          ]}
        >
          <ActivityIndicator color={palette.foregroundMuted} />
        </View>
      )}
      <Video
        ref={videoRef}
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        resizeMode="cover"
        repeat={false}
        muted
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
        }}
        onReadyForDisplay={() => setReady(true)}
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

export function MediaEditorScreen() {
  const navigation = useNavigation<Nav>();
  const { width: viewportW, height: viewportH } = useWindowDimensions();
  const { palette } = useTheme();
  const styles = makeStyles(palette);
  const {
    draft,
    setMode,
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
  } = useCreateDraft();

  const assets = draft.assets;
  const i = draft.activeAssetIndex;
  const cur = assets[i];
  const filter = draft.filterByAsset[i] ?? 'normal';
  const adjustments = draft.adjustByAsset[i] ?? { ...DEFAULT_ADJUSTMENTS };
  const rotation = draft.rotationByAsset[i] ?? 0;
  const crop = draft.cropByAsset[i] ?? 'original';
  const trimStart = draft.trimStartByAsset[i] ?? 0;
  const trimEnd = draft.trimEndByAsset[i] ?? 1;

  const [tab, setTab] = useState<EditorTab>('edit');
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
  const [previewTimeSec, setPreviewTimeSec] = useState(0);

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

  useEffect(() => {
    if (!cur) return;
    if (draft.mode === 'reel' && crop !== '9:16') {
      setCropForActive('9:16');
    } else if (draft.mode === 'post' && crop !== '1:1') {
      setCropForActive('1:1');
    }
  }, [crop, cur, draft.mode, setCropForActive]);

  const lockedCrop = draft.mode === 'reel' ? '9:16' : draft.mode === 'post' ? '1:1' : null;
  const effectiveCrop = lockedCrop ?? crop;

  const aspectRatio =
    effectiveCrop === '1:1'
      ? 1
      : effectiveCrop === '4:5'
      ? 4 / 5
      : effectiveCrop === '16:9'
      ? 16 / 9
      : effectiveCrop === '9:16'
      ? 9 / 16
      : draft.mode === 'reel'
      ? 9 / 16
      : 1;
  const frameMaxW = Math.max(220, Math.min(viewportW - 28, 430));
  const frameMaxH = Math.max(260, viewportH * 0.56);
  const previewW = Math.max(180, Math.min(frameMaxW, frameMaxH * aspectRatio));
  const previewHeight = previewW / aspectRatio;

  const adjustOverlay = adjustOverlayStyle(adjustments);
  const warmOv = warmthOverlayStyle(adjustments);
  const satOv = saturationOverlayStyle(adjustments);
  const vigOv = vignetteOverlayStyle(adjustments);

  const onTrimChange = useCallback(
    (range: [number, number]) => {
      setTrimForActive(range[0], range[1]);
    },
    [setTrimForActive],
  );

  const swipeToAsset = useCallback(
    (idx: number) => {
      setActiveAssetIndex(idx);
      carouselRef.current?.scrollToIndex({ index: idx, animated: true });
    },
    [setActiveAssetIndex],
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
  }, [
    addTextOverlay,
    draft.textOverlays.length,
    textColor,
    textDraft,
    textSize,
  ]);

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

  return (
    <ThemedSafeScreen style={styles.dark}>
      <View style={styles.headerShell}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.iconButton}
            hitSlop={10}
          >
            <ChevronLeft size={26} color={palette.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>BROMO CREATOR</Text>
            <Text style={styles.title}>Edit media</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('ShareFinal')}
            style={styles.nextButton}
          >
            <Text style={[styles.next, { color: palette.accentForeground }]}>
              Next
            </Text>
          </Pressable>
        </View>
        <CreateModeSegment
          palette={palette}
          mode={draft.mode}
          onChange={setMode}
          style={styles.modeSegment}
        />
        <StudioProgress palette={palette} activeIndex={0} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.previewStage}>
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
                  const f = (draft.filterByAsset[index] ??
                    'normal') as FilterId;
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
                      ]}
                    >
                      <View
                        style={[
                          styles.previewWrap,
                          { width: previewW, height: previewHeight },
                        ]}
                      >
                        <View
                          style={[
                            styles.media,
                            { transform: [{ rotate: `${r}deg` }] },
                          ]}
                        >
                          {item.type === 'video' ? (
                            <TrimmingVideo
                              uri={item.uri}
                              palette={palette}
                              trimStart={ts}
                              trimEnd={te}
                              playbackSpeed={draft.playbackSpeed}
                              paused={index === i ? previewPaused : true}
                              onDuration={
                                index === i ? setVideoDurationSec : undefined
                              }
                              onTimeUpdate={
                                index === i ? setPreviewTimeSec : undefined
                              }
                            />
                          ) : (
                            <Image
                              source={{ uri: item.uri }}
                              style={StyleSheet.absoluteFillObject}
                              resizeMode="cover"
                            />
                          )}
                          {renderFilterStacks(f)}
                          <View
                            pointerEvents="none"
                            style={[StyleSheet.absoluteFill, ao]}
                          />
                          {wO ? (
                            <View
                              pointerEvents="none"
                              style={[StyleSheet.absoluteFill, wO]}
                            />
                          ) : null}
                          {sO ? (
                            <View
                              pointerEvents="none"
                              style={[StyleSheet.absoluteFill, sO]}
                            />
                          ) : null}
                          {vO ? (
                            <View
                              pointerEvents="none"
                              style={[StyleSheet.absoluteFill, vO]}
                            />
                          ) : null}
                          {draft.textOverlays.map(o => (
                            <DraggableTextOverlay
                              key={o.id}
                              overlay={o}
                              palette={palette}
                              bounds={{width: previewW, height: previewHeight}}
                              onUpdate={updateTextOverlay}
                              onRemove={removeTextOverlay}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
              <View style={styles.dots}>
                {assets.map((_, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => swipeToAsset(idx)}
                    hitSlop={8}
                  >
                    <View style={[styles.dot, idx === i && styles.dotOn]} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <View
              style={[
                styles.previewWrap,
                { width: previewW, height: previewHeight },
              ]}
            >
              <View
                style={[
                  styles.media,
                  { transform: [{ rotate: `${rotation}deg` }] },
                ]}
              >
                {cur.type === 'video' ? (
                  <TrimmingVideo
                    uri={cur.uri}
                    palette={palette}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    playbackSpeed={draft.playbackSpeed}
                    paused={previewPaused}
                    onDuration={setVideoDurationSec}
                    onTimeUpdate={setPreviewTimeSec}
                  />
                ) : (
                  <Image
                    source={{ uri: cur.uri }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                )}
                {renderFilterStacks(filter)}
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
                  <DraggableTextOverlay
                    key={o.id}
                    overlay={o}
                    palette={palette}
                    bounds={{width: previewW, height: previewHeight}}
                    onUpdate={updateTextOverlay}
                    onRemove={removeTextOverlay}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {cur.type === 'video' && videoDurationSec > 0 ? (
          <View style={styles.timelineCard}>
            <View style={styles.playbackRow}>
              <Pressable
                onPress={() => setPreviewPaused(p => !p)}
                style={[styles.playBtn, { backgroundColor: palette.accent }]}
              >
                {previewPaused ? (
                  <Play size={21} color={palette.accentForeground} />
                ) : (
                  <Pause size={21} color={palette.accentForeground} />
                )}
              </Pressable>
              <Text
                style={[styles.playbackTime, { color: palette.foreground }]}
              >
                {Math.floor(previewTimeSec / 60)}:
                {Math.floor(previewTimeSec % 60)
                  .toString()
                  .padStart(2, '0')}{' '}
                / {Math.floor(videoDurationSec / 60)}:
                {Math.floor(videoDurationSec % 60)
                  .toString()
                  .padStart(2, '0')}
              </Text>
              <View style={{ flex: 1 }} />
              <Text
                style={{
                  color: palette.foregroundSubtle,
                  fontSize: 11,
                  fontWeight: '800',
                }}
              >
                {draft.playbackSpeed}x
              </Text>
            </View>
            <EditorTimeline
              palette={palette}
              durationSec={videoDurationSec}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onTrimChange={onTrimChange}
              zoom={timelineZoom}
              onZoomChange={setTimelineZoom}
            />
            <View style={styles.layerStack}>
              <View
                style={[
                  styles.subTrackRow,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                  },
                ]}>
                <Text style={[styles.subTrackTxt, {color: palette.foreground}]}>
                  Video layer
                </Text>
                <View
                  style={[
                    styles.subTrackMeter,
                    {backgroundColor: palette.surfaceHigh},
                  ]}>
                  <View
                    style={[
                      styles.subTrackMeterFill,
                      {
                        width: `${Math.max(12, (trimEnd - trimStart) * 100)}%`,
                        backgroundColor: palette.accent,
                      },
                    ]}
                  />
                </View>
              </View>
              <View
                style={[
                  styles.subTrackRow,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                  },
                ]}>
                <Music2 size={15} color={palette.foregroundMuted} />
                <Text
                  style={[styles.subTrackTxt, {color: palette.foreground}]}
                  numberOfLines={1}>
                  {draft.selectedAudio?.title ?? 'Original audio'}
                </Text>
                <View
                  style={[
                    styles.subTrackMeter,
                    {backgroundColor: palette.surfaceHigh},
                  ]}>
                  <View
                    style={[
                      styles.subTrackMeterFill,
                      {
                        width: draft.selectedAudio ? '72%' : '100%',
                        backgroundColor: draft.selectedAudio
                          ? palette.accent
                          : palette.foregroundMuted,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.layerRow}>
                <View style={styles.layerChip}>
                  <Type size={15} color={palette.foregroundMuted} />
                  <Text style={styles.layerChipText} numberOfLines={1}>
                    {draft.textOverlays.length} text
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {EDITOR_TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[
                  styles.tabItem,
                  {
                    backgroundColor: active
                      ? palette.surfaceHigh
                      : palette.surface,
                    borderColor: active ? palette.accent : palette.border,
                  },
                ]}
              >
                <Icon
                  size={17}
                  color={active ? palette.accent : palette.foregroundSubtle}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    active && { color: palette.foreground },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === 'edit' && (
          <View style={styles.panelStack}>
            <StudioSection
              palette={palette}
              title="Aspect Ratio"
              bodyStyle={styles.sectionBodyTight}
            >
              <View style={styles.cropRow}>
                {lockedCrop ? (
                  <View
                    style={[
                      styles.cropChip,
                      {
                        borderColor: palette.accent,
                        backgroundColor: palette.accent,
                        minWidth: 120,
                        flexDirection: 'row',
                        gap: 8,
                        justifyContent: 'center',
                      },
                    ]}>
                    <Lock size={14} color={palette.accentForeground} />
                    <Text style={[styles.cropLabel, {color: palette.accentForeground}]}>
                      {lockedCrop} locked
                    </Text>
                  </View>
                ) : (
                  CROP_OPTIONS.map(c => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCropForActive(c.id)}
                      style={[
                        styles.cropChip,
                        {
                          borderColor:
                            crop === c.id ? palette.accent : palette.border,
                          backgroundColor:
                            crop === c.id ? palette.accent : palette.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cropLabel,
                          crop === c.id && { color: palette.accentForeground },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </StudioSection>

            <StudioSection
              palette={palette}
              title="Transform"
              bodyStyle={styles.sectionBodyTight}
            >
              <View style={styles.tools}>
                <Pressable style={styles.tool} onPress={rotateActive}>
                  <RotateCw size={22} color={palette.foreground} />
                  <Text style={styles.toolTxt}>Rotate</Text>
                </Pressable>
                <Pressable style={styles.tool} onPress={() => setTab('text')}>
                  <Type size={22} color={palette.foreground} />
                  <Text style={styles.toolTxt}>Text</Text>
                </Pressable>
                <Pressable
                  style={styles.tool}
                  onPress={() => navigation.navigate('ShareFinal')}
                >
                  <Plus size={22} color={palette.foreground} />
                  <Text style={styles.toolTxt}>Details</Text>
                </Pressable>
              </View>
            </StudioSection>

            {cur.type === 'video' && (
              <StudioSection
                palette={palette}
                title="Playback Speed"
                bodyStyle={styles.sectionBodyTight}
              >
                <View style={styles.speedRow}>
                  {[0.25, 0.5, 1, 1.5, 2, 3].map(s => (
                    <Pressable
                      key={s}
                      onPress={() => setPlaybackSpeed(s)}
                      style={[
                        styles.speedChip,
                        {
                          backgroundColor:
                            draft.playbackSpeed === s
                              ? palette.accent
                              : palette.surface,
                          borderColor:
                            draft.playbackSpeed === s
                              ? palette.accent
                              : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.speedTxt,
                          draft.playbackSpeed === s && {
                            color: palette.accentForeground,
                          },
                        ]}
                      >
                        {s}x
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </StudioSection>
            )}
          </View>
        )}

        {tab === 'filters' && (
          <StudioSection
            palette={palette}
            title="Filter Presets"
            style={styles.panelSection}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTER_IDS.map(fid => (
                <Pressable
                  key={fid}
                  onPress={() => setFilterForActive(fid as FilterId)}
                  style={[
                    styles.filterChip,
                    filter === fid && { borderColor: palette.accent },
                  ]}
                >
                  <View style={styles.filterThumb}>
                    {cur.type === 'video' ? (
                      <Video
                        source={{uri: cur.uri}}
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
                  <Text style={styles.filterName} numberOfLines={1}>
                    {FILTER_LABELS[fid]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </StudioSection>
        )}

        {tab === 'adjust' && (
          <StudioSection
            palette={palette}
            title="Light & Colour"
            style={styles.panelSection}
          >
            {ADJUST_KEYS.map(({ key, label, Icon }) => (
              <View key={key} style={styles.adjustRow}>
                <View style={styles.adjustLabelRow}>
                  <Icon size={16} color={palette.foregroundMuted} />
                  <Text style={styles.adjustLabel}>{label}</Text>
                  <Text style={styles.adjustValue}>
                    {Math.round(
                      adjustments[key as keyof typeof adjustments] * 100,
                    )}
                  </Text>
                </View>
                <Slider
                  minimumValue={-1}
                  maximumValue={1}
                  step={0.01}
                  value={adjustments[key as keyof typeof adjustments]}
                  onValueChange={v => setAdjustForActive({ [key]: v })}
                  minimumTrackTintColor={palette.accent}
                  maximumTrackTintColor={palette.foregroundFaint}
                  thumbTintColor={palette.foreground}
                  style={styles.adjustSlider}
                />
              </View>
            ))}
          </StudioSection>
        )}

        {tab === 'audio' && (
          <StudioSection
            palette={palette}
            title="Audio Source"
            style={styles.panelSection}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.audioRow}
            >
              <Pressable
                onPress={() => setSelectedAudio(null)}
                style={[
                  styles.audioCard,
                  !draft.selectedAudio && { borderColor: palette.accent },
                ]}
              >
                <Music2 size={16} color={palette.foreground} />
                <Text style={styles.audioTitle}>No music</Text>
                <Text style={styles.audioArtist}>Original</Text>
              </Pressable>
              {AUDIO_CATALOG.map(track => (
                <Pressable
                  key={track.id}
                  onPress={() => setSelectedAudio(track)}
                  style={[
                    styles.audioCard,
                    draft.selectedAudio?.id === track.id && {
                      borderColor: palette.accent,
                    },
                  ]}
                >
                  <Music2 size={16} color={palette.foreground} />
                  <Text style={styles.audioTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.audioArtist} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </StudioSection>
        )}

        {tab === 'text' && (
          <StudioSection
            palette={palette}
            title="Text Overlay"
            style={styles.panelSection}
          >
            <View style={styles.textBox}>
              <TextInput
                value={textDraft}
                onChangeText={setTextDraft}
                placeholder="Type overlay text"
                placeholderTextColor={palette.placeholder}
                style={[styles.textInput, { color: textColor }]}
              />
              <Pressable onPress={addOverlayText} style={styles.addTextBtn}>
                <Text
                  style={{ color: palette.accentForeground, fontWeight: '900' }}
                >
                  Add
                </Text>
              </Pressable>
            </View>
            <Text style={styles.sectionLabel}>Color</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorRow}
            >
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
            <Text style={styles.sectionLabel}>Size {textSize}px</Text>
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
          </StudioSection>
        )}
      </ScrollView>

      <View style={styles.footerBar}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('ShareFinal')}
        >
          <Text style={styles.primaryButtonText}>Next</Text>
        </Pressable>
      </View>
    </ThemedSafeScreen>
  );
}

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    dark: { flex: 1, backgroundColor: p.background },
    white: { color: p.foreground },
    link: { color: p.accent, marginTop: 12 },
    headerShell: {
      backgroundColor: p.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.hairline,
    },
    topBar: {
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
      backgroundColor: p.surface,
    },
    headerCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 10 },
    eyebrow: { color: p.foregroundSubtle, fontSize: 10, fontWeight: '900' },
    title: {
      color: p.foreground,
      fontSize: 17,
      fontWeight: '900',
      marginTop: 2,
    },
    modeSegment: { marginHorizontal: 14, marginTop: 4 },
    nextButton: {
      minWidth: 58,
      height: 38,
      borderRadius: 12,
      paddingHorizontal: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.accent,
    },
    next: { fontSize: 14, fontWeight: '900' },
    scrollContent: { paddingBottom: 18 },
    previewStage: {
      alignItems: 'center',
      paddingTop: 14,
      paddingBottom: 4,
      backgroundColor: p.background,
    },
    carouselPage: { alignItems: 'center', justifyContent: 'center' },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: p.borderMid },
    dotOn: { backgroundColor: p.foreground, width: 14 },
    previewWrap: {
      backgroundColor: p.background,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: p.borderHeavy,
    },
    timelineCard: {
      marginHorizontal: 14,
      marginTop: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.card,
      overflow: 'hidden',
    },
    playbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
    },
    playBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playbackTime: {
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    layerRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    layerStack: {
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    layerChip: {
      flex: 1,
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 12,
      backgroundColor: p.surface,
      paddingHorizontal: 10,
    },
    layerChipText: {
      flex: 1,
      color: p.foregroundMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    subTrackHint: { paddingHorizontal: 14, gap: 8, marginBottom: 8 },
    subTrackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    subTrackTxt: { fontSize: 12, fontWeight: '600', flex: 1 },
    subTrackMeter: {
      width: 110,
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
    },
    subTrackMeterFill: {
      height: '100%',
      borderRadius: 999,
    },
    media: { flex: 1, overflow: 'hidden' },
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
      backgroundColor: p.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    tabItem: {
      width: 76,
      minHeight: 56,
      borderWidth: 1,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    tabLabel: { color: p.foregroundSubtle, fontSize: 11, fontWeight: '700' },
    panelStack: { gap: 12, paddingHorizontal: 14 },
    panelSection: { marginHorizontal: 14 },
    sectionBodyTight: { padding: 12 },
    sectionLabel: {
      color: p.foreground,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 14,
    },
    hint: {
      color: p.foregroundSubtle,
      marginLeft: 14,
      marginTop: 4,
      fontSize: 12,
    },
    filterRow: { gap: 10, paddingRight: 2 },
    filterChip: {
      width: 72,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 12,
      paddingBottom: 6,
    },
    filterThumb: {
      width: 64,
      height: 64,
      borderRadius: 12,
      overflow: 'hidden',
    },
    filterImg: { width: '100%', height: '100%' },
    filterName: {
      color: p.foregroundMuted,
      fontSize: 10,
      marginTop: 4,
      fontWeight: '600',
    },
    adjustPane: { paddingHorizontal: 14, paddingTop: 8 },
    adjustRow: { marginBottom: 10 },
    adjustLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2,
    },
    adjustLabel: {
      color: p.foregroundMuted,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    adjustValue: {
      color: p.foregroundSubtle,
      fontSize: 12,
      fontWeight: '700',
      width: 40,
      textAlign: 'right',
    },
    adjustSlider: { height: 32 },
    cropRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    cropChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: p.surface,
    },
    cropLabel: { color: p.foreground, fontWeight: '800', fontSize: 13 },
    tools: { flexDirection: 'row', gap: 10 },
    tool: {
      flex: 1,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
    },
    toolTxt: { color: p.foregroundMuted, fontSize: 11, fontWeight: '800' },
    textSection: { marginBottom: 8 },
    textBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: p.input,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: p.border,
    },
    textInput: { flex: 1, paddingVertical: 12 },
    addTextBtn: {
      minWidth: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: p.accent,
    },
    colorRow: { gap: 10, marginTop: 8 },
    colorDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.surfaceHigh,
    },
    speedRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    speedChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: p.surface,
    },
    speedTxt: { color: p.foreground, fontWeight: '800' },
    audioRow: { gap: 10 },
    audioCard: {
      width: 120,
      padding: 10,
      borderRadius: 12,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
    },
    audioTitle: {
      color: p.foreground,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 6,
    },
    audioArtist: { color: p.foregroundSubtle, fontSize: 10, marginTop: 2 },
    footerBar: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: p.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.hairline,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
    },
    secondaryButtonText: {
      color: p.foregroundMuted,
      fontSize: 14,
      fontWeight: '900',
    },
    primaryButton: {
      flex: 2,
      minHeight: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.accent,
    },
    primaryButtonText: {
      color: p.accentForeground,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}
