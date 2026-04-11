import React, {useCallback, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import Video from 'react-native-video';
import {
  ChevronLeft,
  Crop,
  Music2,
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
  X,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {
  FILTER_IDS,
  TEXT_COLORS,
  type CropAspect,
  type FilterId,
} from '../../create/createTypes';
import {DEFAULT_ADJUSTMENTS} from '../../create/createTypes';
import {FILTER_LABELS, FILTER_LAYERS} from '../../create/filterStyles';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import type {ThemePalette} from '../../config/platform-theme';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'MediaEditor'>;

const {width: W} = Dimensions.get('window');

const AUDIO_CATALOG = [
  {id: 'a1', title: 'Original audio', artist: 'BROMO Sound'},
  {id: 'a2', title: 'City Nights', artist: 'Lo-Fi Pack'},
  {id: 'a3', title: 'Drill Beat', artist: 'Trending'},
  {id: 'a4', title: 'Acoustic Warm', artist: 'UGC Lite'},
  {id: 'a5', title: 'Trap Vibes', artist: 'Hip Hop'},
  {id: 'a6', title: 'Chill Wave', artist: 'Ambient'},
];

const CROP_OPTIONS: {id: CropAspect; label: string}[] = [
  {id: 'original', label: 'Original'},
  {id: '1:1', label: '1:1'},
  {id: '4:5', label: '4:5'},
  {id: '16:9', label: '16:9'},
];

type EditorTab = 'filters' | 'adjust' | 'crop';

const ADJUST_KEYS = [
  {key: 'brightness', label: 'Brightness', Icon: Sun},
  {key: 'contrast', label: 'Contrast', Icon: Contrast},
  {key: 'saturation', label: 'Saturation', Icon: Droplets},
  {key: 'warmth', label: 'Warmth', Icon: Thermometer},
  {key: 'sharpen', label: 'Sharpen', Icon: Sparkles},
  {key: 'vignette', label: 'Vignette', Icon: CircleOff},
  {key: 'fade', label: 'Fade', Icon: Minus},
] as const;

export function MediaEditorScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const styles = makeStyles(palette);
  const {
    draft,
    setActiveAssetIndex,
    setFilterForActive,
    setAdjustForActive,
    rotateActive,
    setCropForActive,
    setTrimForActive,
    setPlaybackSpeed,
    setSelectedAudio,
    addTextOverlay,
    removeTextOverlay,
  } = useCreateDraft();

  const assets = draft.assets;
  const i = draft.activeAssetIndex;
  const cur = assets[i];
  const filter = draft.filterByAsset[i] ?? 'normal';
  const adjustments = draft.adjustByAsset[i] ?? {...DEFAULT_ADJUSTMENTS};
  const rotation = draft.rotationByAsset[i] ?? 0;
  const crop = draft.cropByAsset[i] ?? 'original';
  const trimStart = draft.trimStartByAsset[i] ?? 0;
  const trimEnd = draft.trimEndByAsset[i] ?? 1;

  const [tab, setTab] = useState<EditorTab>('filters');
  const [textDraft, setTextDraft] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textSize, setTextSize] = useState(18);
  const [showTextInput, setShowTextInput] = useState(false);

  const carouselRef = useRef<FlatList>(null);

  const layer = FILTER_LAYERS[filter];

  const aspectRatio =
    crop === '1:1' ? 1 : crop === '4:5' ? 4 / 5 : crop === '16:9' ? 16 / 9 : draft.mode === 'reel' ? 9 / 16 : 1;
  const previewHeight = W / aspectRatio;

  const adjustOverlay = {
    opacity:
      1 +
      adjustments.brightness * 0.3 +
      adjustments.fade * 0.15,
    backgroundColor: `rgba(${adjustments.warmth > 0 ? '255,200,100' : '100,150,255'},${Math.abs(adjustments.warmth) * 0.08})`,
  };

  const onTrimChange = useCallback(
    (range: [number, number]) => {
      setTrimForActive(range[0], range[1]);
    },
    [setTrimForActive],
  );

  const swipeToAsset = useCallback(
    (idx: number) => {
      setActiveAssetIndex(idx);
      carouselRef.current?.scrollToIndex({index: idx, animated: true});
    },
    [setActiveAssetIndex],
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

  return (
    <ThemedSafeScreen style={styles.dark}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={palette.foreground} />
        </Pressable>
        <Text style={styles.title}>Edit</Text>
        <Pressable onPress={() => navigation.navigate('Composer')}>
          <Text style={[styles.next, {color: palette.accent}]}>Next</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Carousel */}
        {assets.length > 1 ? (
          <>
            <FlatList
              ref={carouselRef}
              data={assets}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, idx) => `asset_${idx}`}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / W);
                setActiveAssetIndex(idx);
              }}
              renderItem={({item, index}) => {
                const f = draft.filterByAsset[index] ?? 'normal';
                const fl = FILTER_LAYERS[f];
                const r = draft.rotationByAsset[index] ?? 0;
                return (
                  <View style={{width: W, height: previewHeight, backgroundColor: palette.background}}>
                    <View style={[styles.media, {transform: [{rotate: `${r}deg`}]}]}>
                      {item.type === 'video' ? (
                        <Video
                          source={{uri: item.uri}}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                          repeat
                          muted
                        />
                      ) : (
                        <Image source={{uri: item.uri}} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      )}
                      {fl.backgroundColor ? (
                        <View
                          pointerEvents="none"
                          style={[StyleSheet.absoluteFill, {backgroundColor: fl.backgroundColor, opacity: fl.opacity ?? 0.85}]}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              }}
            />
            <View style={styles.dots}>
              {assets.map((_, idx) => (
                <Pressable key={idx} onPress={() => swipeToAsset(idx)}>
                  <View style={[styles.dot, idx === i && styles.dotOn]} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={[styles.previewWrap, {height: previewHeight}]}>
            <View style={[styles.media, {transform: [{rotate: `${rotation}deg`}]}]}>
              {cur.type === 'video' ? (
                <Video
                  source={{uri: cur.uri}}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  repeat
                  muted
                  rate={draft.playbackSpeed}
                />
              ) : (
                <Image source={{uri: cur.uri}} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              )}
              {layer.backgroundColor ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, {backgroundColor: layer.backgroundColor, opacity: layer.opacity ?? 0.85}]}
                />
              ) : null}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, adjustOverlay]} />
              {draft.textOverlays.map(o => (
                <View key={o.id} style={[styles.overlayText, {left: o.x, top: o.y}]}>
                  <Text
                    style={{
                      color: o.color,
                      fontSize: o.fontSize,
                      fontWeight: o.fontStyle === 'bold' ? '900' : '400',
                      fontStyle: o.fontStyle === 'italic' ? 'italic' : 'normal',
                    }}>
                    {o.text}
                  </Text>
                  <Pressable style={styles.removeOverlay} onPress={() => removeTextOverlay(o.id)}>
                    <X size={12} color={palette.foreground} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tab bar: Filters | Adjust | Crop */}
        <View style={styles.tabBar}>
          {(['filters', 'adjust', 'crop'] as EditorTab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tabItem}>
              {t === 'filters' && <SlidersHorizontal size={18} color={tab === t ? palette.accent : palette.foregroundSubtle} />}
              {t === 'adjust' && <Sun size={18} color={tab === t ? palette.accent : palette.foregroundSubtle} />}
              {t === 'crop' && <Crop size={18} color={tab === t ? palette.accent : palette.foregroundSubtle} />}
              <Text style={[styles.tabLabel, tab === t && {color: palette.accent}]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Filters tab */}
        {tab === 'filters' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTER_IDS.map(fid => (
              <Pressable
                key={fid}
                onPress={() => setFilterForActive(fid as FilterId)}
                style={[styles.filterChip, filter === fid && {borderColor: palette.accent}]}>
                <View style={styles.filterThumb}>
                  <Image source={{uri: cur.uri}} style={styles.filterImg} />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      {backgroundColor: FILTER_LAYERS[fid].backgroundColor, opacity: FILTER_LAYERS[fid].opacity ?? 0},
                    ]}
                  />
                </View>
                <Text style={styles.filterName}>{FILTER_LABELS[fid]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Adjust tab */}
        {tab === 'adjust' && (
          <View style={styles.adjustPane}>
            {ADJUST_KEYS.map(({key, label, Icon}) => (
              <View key={key} style={styles.adjustRow}>
                <View style={styles.adjustLabelRow}>
                  <Icon size={16} color={palette.foregroundMuted} />
                  <Text style={styles.adjustLabel}>{label}</Text>
                  <Text style={styles.adjustValue}>
                    {Math.round((adjustments[key as keyof typeof adjustments]) * 100)}
                  </Text>
                </View>
                <Slider
                  minimumValue={-1}
                  maximumValue={1}
                  value={adjustments[key as keyof typeof adjustments]}
                  onValueChange={v => setAdjustForActive({[key]: v})}
                  minimumTrackTintColor={palette.accent}
                  maximumTrackTintColor={palette.foregroundFaint}
                  thumbTintColor={palette.foreground}
                  style={styles.adjustSlider}
                />
              </View>
            ))}
          </View>
        )}

        {/* Crop tab */}
        {tab === 'crop' && (
          <View style={styles.cropRow}>
            {CROP_OPTIONS.map(c => (
              <Pressable
                key={c.id}
                onPress={() => setCropForActive(c.id)}
                style={[styles.cropChip, crop === c.id && {backgroundColor: palette.accent}]}>
                <Text style={[styles.cropLabel, crop === c.id && {color: palette.accentForeground}]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Tools row */}
        <View style={styles.tools}>
          <Pressable style={styles.tool} onPress={rotateActive}>
            <RotateCw size={22} color={palette.foreground} />
            <Text style={styles.toolTxt}>Rotate</Text>
          </Pressable>
          <Pressable style={styles.tool} onPress={() => setShowTextInput(s => !s)}>
            <Type size={22} color={palette.foreground} />
            <Text style={styles.toolTxt}>Text</Text>
          </Pressable>
          <Pressable style={styles.tool} onPress={() => navigation.navigate('Composer')}>
            <Plus size={22} color={palette.foreground} />
            <Text style={styles.toolTxt}>Sticker</Text>
          </Pressable>
        </View>

        {/* Text overlay input */}
        {showTextInput && (
          <View style={styles.textSection}>
            <View style={styles.textBox}>
              <TextInput
                value={textDraft}
                onChangeText={setTextDraft}
                placeholder="Type overlay text..."
                placeholderTextColor="#666"
                style={[styles.textInput, {color: textColor}]}
              />
              <Pressable
                onPress={() => {
                  if (textDraft.trim()) {
                    addTextOverlay({
                      text: textDraft.trim(),
                      x: 24,
                      y: 120 + draft.textOverlays.length * 32,
                      color: textColor,
                      fontSize: textSize,
                      fontStyle: 'bold',
                    });
                    setTextDraft('');
                    setShowTextInput(false);
                  }
                }}>
                <Text style={{color: palette.accent, fontWeight: '800'}}>Add</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionLabel}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
              {TEXT_COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => setTextColor(c)}
                  style={[
                    styles.colorDot,
                    {backgroundColor: c},
                    textColor === c && {borderWidth: 3, borderColor: palette.accent},
                  ]}
                />
              ))}
            </ScrollView>
            <Text style={styles.sectionLabel}>Size: {textSize}px</Text>
            <Slider
              minimumValue={12}
              maximumValue={48}
              step={2}
              value={textSize}
              onValueChange={setTextSize}
              minimumTrackTintColor={palette.accent}
              maximumTrackTintColor={palette.foregroundFaint}
              thumbTintColor={palette.foreground}
              style={{marginHorizontal: 14}}
            />
          </View>
        )}

        {/* Video-specific controls */}
        {cur.type === 'video' && (
          <>
            <Text style={styles.sectionLabel}>Trim</Text>
            <Text style={styles.hint}>
              Start {(trimStart * 100).toFixed(0)}% · End {(trimEnd * 100).toFixed(0)}%
            </Text>
            <View style={styles.trimSliders}>
              <Slider
                minimumValue={0}
                maximumValue={0.95}
                value={trimStart}
                onValueChange={v => onTrimChange([v, Math.max(v + 0.05, trimEnd)])}
                minimumTrackTintColor={palette.accent}
                maximumTrackTintColor={palette.foregroundFaint}
                thumbTintColor={palette.foreground}
              />
              <Slider
                minimumValue={0.05}
                maximumValue={1}
                value={trimEnd}
                onValueChange={v => onTrimChange([Math.min(trimStart, v - 0.05), v])}
                minimumTrackTintColor={palette.accent}
                maximumTrackTintColor={palette.foregroundFaint}
                thumbTintColor={palette.foreground}
              />
            </View>
            <Text style={styles.sectionLabel}>Speed</Text>
            <View style={styles.speedRow}>
              {[0.25, 0.5, 1, 1.5, 2, 3].map(s => (
                <Pressable
                  key={s}
                  onPress={() => setPlaybackSpeed(s)}
                  style={[styles.speedChip, draft.playbackSpeed === s && {backgroundColor: palette.accent}]}>
                  <Text style={[styles.speedTxt, draft.playbackSpeed === s && {color: palette.accentForeground}]}>{s}x</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Music */}
        <Text style={styles.sectionLabel}>Music</Text>
        <ScrollView horizontal contentContainerStyle={styles.audioRow}>
          <Pressable
            onPress={() => setSelectedAudio(null)}
            style={[styles.audioCard, !draft.selectedAudio && {borderColor: palette.accent}]}>
            <Music2 size={16} color={palette.foreground} />
            <Text style={styles.audioTitle}>No music</Text>
            <Text style={styles.audioArtist}>Original</Text>
          </Pressable>
          {AUDIO_CATALOG.map(track => (
            <Pressable
              key={track.id}
              onPress={() => setSelectedAudio(track)}
              style={[styles.audioCard, draft.selectedAudio?.id === track.id && {borderColor: palette.accent}]}>
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
        <View style={{height: 32}} />
      </ScrollView>
    </ThemedSafeScreen>
  );
}

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    dark: {flex: 1, backgroundColor: p.background},
    white: {color: p.foreground},
    link: {color: p.accent, marginTop: 12},
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    title: {color: p.foreground, fontSize: 17, fontWeight: '700'},
    next: {fontSize: 16, fontWeight: '700'},
    dots: {flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 8},
    dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: p.borderMid},
    dotOn: {backgroundColor: p.foreground, width: 14},
    previewWrap: {width: '100%', backgroundColor: p.background},
    media: {flex: 1, overflow: 'hidden'},
    overlayText: {position: 'absolute', flexDirection: 'row', alignItems: 'center'},
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
      justifyContent: 'space-around',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.surfaceHigh,
    },
    tabItem: {alignItems: 'center', gap: 4},
    tabLabel: {color: p.foregroundSubtle, fontSize: 11, fontWeight: '700'},
    sectionLabel: {color: p.foreground, fontSize: 13, fontWeight: '800', marginLeft: 14, marginTop: 14},
    hint: {color: p.foregroundSubtle, marginLeft: 14, marginTop: 4, fontSize: 12},
    filterRow: {paddingHorizontal: 10, gap: 10, paddingVertical: 10},
    filterChip: {
      width: 72,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 12,
      paddingBottom: 6,
    },
    filterThumb: {width: 64, height: 64, borderRadius: 12, overflow: 'hidden'},
    filterImg: {width: '100%', height: '100%'},
    filterName: {color: p.foregroundMuted, fontSize: 10, marginTop: 4, fontWeight: '600'},
    adjustPane: {paddingHorizontal: 14, paddingTop: 8},
    adjustRow: {marginBottom: 10},
    adjustLabelRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2},
    adjustLabel: {color: p.foregroundMuted, fontSize: 13, fontWeight: '600', flex: 1},
    adjustValue: {color: p.foregroundSubtle, fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right'},
    adjustSlider: {height: 32},
    cropRow: {flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12},
    cropChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: p.surfaceHigh,
    },
    cropLabel: {color: p.foreground, fontWeight: '800', fontSize: 13},
    tools: {flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingVertical: 10},
    tool: {alignItems: 'center', gap: 4},
    toolTxt: {color: p.foregroundMuted, fontSize: 11},
    textSection: {marginBottom: 8},
    textBox: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 14,
      marginTop: 10,
      backgroundColor: p.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      gap: 10,
    },
    textInput: {flex: 1, paddingVertical: 12},
    colorRow: {paddingHorizontal: 12, gap: 10, marginTop: 8},
    colorDot: {width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: p.surfaceHigh},
    trimSliders: {paddingHorizontal: 14},
    speedRow: {flexDirection: 'row', gap: 8, marginHorizontal: 14, marginTop: 8, flexWrap: 'wrap'},
    speedChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: p.surfaceHigh,
    },
    speedTxt: {color: p.foreground, fontWeight: '800'},
    audioRow: {paddingHorizontal: 12, gap: 10, paddingVertical: 10},
    audioCard: {
      width: 120,
      padding: 10,
      borderRadius: 12,
      backgroundColor: p.card,
      borderWidth: 1,
      borderColor: p.border,
    },
    audioTitle: {color: p.foreground, fontSize: 12, fontWeight: '800', marginTop: 6},
    audioArtist: {color: p.foregroundSubtle, fontSize: 10, marginTop: 2},
  });
}
