import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useFocusEffect, useIsFocused, useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import {
  ChevronDown,
  FileText,
  Grid3X3,
  LayoutGrid,
  SmilePlus,
  Sparkles,
  Type,
  X,
  Zap,
  ZapOff,
  Repeat2,
  Settings,
  Calendar,
  List,
  Radio,
  Camera,
  Play,
} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateMode, MediaAsset} from '../../create/createTypes';
import {loadCameraSettings, type StoredCameraSettings} from '../../lib/cameraSettingsStorage';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import type {ThemePalette} from '../../config/platform-theme';
import {getPost} from '../../api/postsApi';
import {Camera as VisionCamera} from 'react-native-vision-camera';
import {useHubCameraCapture} from './useHubCameraCapture';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'CreateHub'>;
type RouteProps = RouteProp<CreateStackParamList, 'CreateHub'>;

type GridItem = {kind: 'camera'} | {kind: 'asset'; uri: string; type: 'image' | 'video'};

function extFromPickerName(name: string | undefined): string {
  if (!name) return '';
  const base = name.split('?')[0]?.split('/').pop()?.toLowerCase() ?? '';
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1) : '';
}

function mapAsset(a: Asset): MediaAsset | null {
  if (!a.uri) return null;
  const ext = extFromPickerName(a.fileName) || extFromPickerName(a.uri.split('/').pop() ?? '');
  const videoExts = new Set(['mp4', 'mov', 'm4v', 'webm', '3gp', 'mkv', 'avi', 'mpeg', 'mpg']);

  /** Trust the OS when it says `video` (do not downgrade — paths can contain unrelated ".heic" substrings). */
  if (a.type === 'video') {
    return {uri: a.uri, type: 'video', duration: a.duration, fileName: a.fileName ?? null};
  }

  /** Some devices report `image` for files that are clearly video by extension. */
  if (videoExts.has(ext)) {
    return {uri: a.uri, type: 'video', duration: a.duration, fileName: a.fileName ?? null};
  }

  /** Duration present → usually a clip even if type is wrong. */
  const dur = Number(a.duration);
  if (Number.isFinite(dur) && dur > 0) {
    return {uri: a.uri, type: 'video', duration: a.duration, fileName: a.fileName ?? null};
  }

  return {uri: a.uri, type: 'image', duration: a.duration, fileName: a.fileName ?? null};
}

const MODES: {id: CreateMode; label: string}[] = [
  {id: 'post', label: 'POST'},
  {id: 'story', label: 'STORY'},
  {id: 'reel', label: 'REEL'},
  {id: 'live', label: 'LIVE'},
];

export function CreateHubScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const isFocused = useIsFocused();
  const {palette} = useTheme();
  const styles = makeStyles(palette);
  const {draft, setMode, setAssets, reset, setLiveMeta, setSelectedAudio} = useCreateDraft();

  const [roll, setRoll] = useState<{uri: string; type: 'image' | 'video'}[]>([]);
  const [loadingRoll, setLoadingRoll] = useState(true);
  const [camSettings, setCamSettings] = useState<StoredCameraSettings | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [frontCam, setFrontCam] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [preparingEditor, setPreparingEditor] = useState(false);
  const lastBootstrapTs = useRef<number | undefined>(undefined);

  const goToEditorWithAssets = useCallback(
    (list: MediaAsset[]) => {
      if (!list.length) return;
      setPreparingEditor(true);
      setAssets(list);
      setTimeout(() => {
        navigation.navigate('MediaEditor');
        setTimeout(() => setPreparingEditor(false), 420);
      }, 80);
    },
    [navigation, setAssets],
  );

  useFocusEffect(
    useCallback(() => {
      const ts = route.params?.bootstrapTs;
      if (typeof ts !== 'number') {
        return;
      }
      if (lastBootstrapTs.current === ts) {
        return;
      }
      lastBootstrapTs.current = ts;
      reset();
      const initialMode = route.params?.mode;
      if (initialMode) {
        setMode(initialMode);
      }
      const remixId = route.params?.remixSourcePostId;
      if (remixId && initialMode === 'reel') {
        getPost(remixId)
          .then(({post}) => {
            const title = post.music?.trim() ? post.music.trim() : 'Original audio';
            setSelectedAudio({
              id: post._id,
              title,
              artist: `@${post.author.username}`,
            });
          })
          .catch(() => null);
      }
    }, [
      reset,
      route.params?.bootstrapTs,
      route.params?.mode,
      route.params?.remixSourcePostId,
      setMode,
      setSelectedAudio,
      navigation,
    ]),
  );

  useEffect(() => {
    loadCameraSettings().then(s => {
      setCamSettings(s);
      setFrontCam(s.defaultFrontCamera);
    });
  }, []);

  const loadGallery = useCallback(async () => {
    setLoadingRoll(true);
    try {
      const res = await CameraRoll.getPhotos({first: 48, assetType: 'All'});
      setRoll(
        res.edges.map(e => ({
          uri: e.node.image.uri,
          type: e.node.type === 'video' ? 'video' : 'image',
        })),
      );
    } catch {
      setRoll([]);
      Alert.alert('Photo library', 'Allow photo access in Settings to pick from your gallery.', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: () => Linking.openSettings()},
      ]);
    } finally {
      setLoadingRoll(false);
    }
  }, []);

  useEffect(() => {
    if (camSettings?.allowGallerySuggestions !== false) {
      loadGallery();
    }
  }, [camSettings?.allowGallerySuggestions, loadGallery]);

  const openCamera = useCallback(() => {
    if (draft.mode === 'live') {
      navigation.navigate('LivePreview');
      return;
    }
    // Full-screen camera (e.g. post grid "camera" cell). Hub story/reel use inline preview.
    navigation.navigate('InAppCamera');
  }, [draft.mode, navigation]);

  const hubCameraActive =
    isFocused &&
    !previewUri &&
    (draft.mode === 'reel' ||
      draft.mode === 'story' ||
      draft.mode === 'live' ||
      draft.mode === 'post');

  const onHubCaptured = useCallback(
    (assets: MediaAsset[]) => {
      goToEditorWithAssets(assets);
    },
    [goToEditorWithAssets],
  );

  const hubCam = useHubCameraCapture({
    mode: draft.mode,
    flashOn,
    facing: frontCam ? 'front' : 'back',
    isActive: hubCameraActive,
    inlinePostCamera: draft.mode === 'post',
    onCaptured: onHubCaptured,
  });

  const openLibraryFull = useCallback(() => {
    launchImageLibrary(
      {
        // story can be image or video; reel is video-only; post is both
        mediaType: draft.mode === 'reel' ? 'video' : 'mixed',
        selectionLimit: draft.mode === 'post' && multiSelect ? 10 : 1,
      },
      res => {
        if (res.didCancel || res.errorCode) return;
        const list = (res.assets ?? []).map(mapAsset).filter(Boolean) as MediaAsset[];
        if (list.length) goToEditorWithAssets(list);
      },
    );
  }, [draft.mode, multiSelect, goToEditorWithAssets]);

  const onPickThumb = useCallback(
    (uri: string, type: 'image' | 'video') => {
      if (draft.mode === 'post' && multiSelect) {
        setPicked(prev => {
          const n = new Set(prev);
          if (n.has(uri)) n.delete(uri);
          else n.add(uri);
          return n;
        });
        setPreviewUri(uri);
        return;
      }
      // On iOS, CameraRoll returns ph:// URIs for videos which react-native-video
      // cannot play directly. Use the image picker to get a proper file:// URI.
      if (type === 'video' && uri.startsWith('ph://')) {
        launchImageLibrary({mediaType: 'video', selectionLimit: 1}, res => {
          if (res.didCancel || res.errorCode) return;
          const a = res.assets?.[0];
          if (!a) return;
          const m = mapAsset(a);
          if (m) goToEditorWithAssets([m]);
        });
        return;
      }
      goToEditorWithAssets([{uri, type}]);
    },
    [draft.mode, multiSelect, goToEditorWithAssets],
  );

  const gridData = useMemo<GridItem[]>(
    () => [{kind: 'camera'}, ...roll.map(r => ({kind: 'asset' as const, ...r}))],
    [roll],
  );

  const onNextMulti = useCallback(() => {
    if (picked.size === 0) return;
    const assets: MediaAsset[] = roll
      .filter(r => picked.has(r.uri))
      .map(r => ({uri: r.uri, type: r.type}));
    goToEditorWithAssets(assets);
  }, [picked, roll, goToEditorWithAssets]);

  const headerTitle =
    draft.mode === 'post'
      ? 'New post'
      : draft.mode === 'reel'
        ? 'New reel'
        : draft.mode === 'story'
          ? 'Add to story'
          : 'Go live';

  const toolbarOnLeft = camSettings?.toolbarSide !== 'right';

  return (
    <ThemedSafeScreen style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            reset();
            navigation.getParent()?.goBack();
          }}
          hitSlop={12}>
          <X size={26} color={palette.foreground} />
        </Pressable>
        {draft.mode === 'live' ? (
          <Pressable
            style={styles.liveAudience}
            onPress={() =>
              setLiveMeta({
                liveAudience: draft.liveAudience === 'everyone' ? 'followers' : 'everyone',
              })
            }>
            <Radio size={14} color={palette.foreground} />
            <Text style={styles.liveAudienceText}>
              {draft.liveAudience === 'everyone' ? 'Everyone' : 'Followers'}
            </Text>
            <ChevronDown size={14} color={palette.foreground} />
          </Pressable>
        ) : (
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        )}
        <View style={styles.headerRight}>
          {draft.mode === 'post' && picked.size > 0 && multiSelect && (
            <Pressable onPress={onNextMulti} style={styles.nextBtn}>
              <Text style={[styles.nextBtnText, {color: palette.accent}]}>Next ({picked.size})</Text>
            </Pressable>
          )}
          <Pressable onPress={() => navigation.navigate('Drafts')} hitSlop={8}>
            <FileText size={22} color={palette.foreground} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('CameraSettings')} hitSlop={8}>
            <Settings size={22} color={palette.foreground} />
          </Pressable>
        </View>
      </View>

      {draft.mode === 'reel' && (
        <View style={styles.subHeader}>
          <Pressable style={styles.pill} onPress={() => navigation.navigate('FilterEffects')}>
            <Sparkles size={14} color={palette.accent} />
            <Text style={styles.pillText}>Effects</Text>
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable style={styles.pill} onPress={() => navigation.navigate('MusicPicker', {mode: 'reel'})}>
            <LayoutGrid size={14} color={palette.foreground} />
            <Text style={styles.pillText}>Audio</Text>
          </Pressable>
          <Pressable style={styles.pill} onPress={() => navigation.navigate('CollaborationInvite')}>
            <Text style={styles.pillText}>Collab</Text>
          </Pressable>
        </View>
      )}

      {draft.mode === 'live' && (
        <View style={styles.liveSide}>
          <Pressable style={styles.iconBtnDark}>
            <List size={20} color={palette.foreground} />
          </Pressable>
          <Pressable style={styles.iconBtnDark}>
            <Calendar size={20} color={palette.foreground} />
          </Pressable>
        </View>
      )}

      {/* Main preview / grid */}
      {draft.mode === 'post' ? (
        <ScrollView style={styles.flex1} contentContainerStyle={{paddingBottom: 120}}>
          <View style={styles.postTop}>
            {previewUri ? (
              <Image source={{uri: previewUri}} style={styles.hero} resizeMode="cover" />
            ) : (
              <View style={[styles.hero, styles.postHeroSplit]}>
                <View style={styles.postMiniCam}>
                  <HubCameraPreviewBody
                    hubCam={hubCam}
                    isActive={hubCameraActive}
                    palette={palette}
                    styles={styles}
                    containerStyle={StyleSheet.absoluteFillObject}
                  />
                  {hubCam.recording ? (
                    <View style={styles.postMiniRecBadge} pointerEvents="none">
                      <View style={styles.postMiniRecPill}>
                        <View style={styles.hubRecDot} />
                        <Text style={[styles.hubRecText, styles.postMiniRecText]}>
                          {(hubCam.recordMs / 1000).toFixed(1)}s
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.postMiniBottomBar} pointerEvents="box-none">
                    <View style={[styles.postMiniBarSide, styles.postMiniBarSideLeft]}>
                      <Pressable
                        style={styles.postMiniBarIconBtn}
                        onPress={() => setFlashOn(f => !f)}
                        hitSlop={8}
                        accessibilityLabel="Flash">
                        {flashOn ? (
                          <Zap size={22} color="#fff" />
                        ) : (
                          <ZapOff size={22} color="#fff" />
                        )}
                      </Pressable>
                    </View>
                    <Pressable
                      style={[
                        styles.postMiniShutterRing,
                        hubCam.recording && {borderColor: palette.destructive},
                      ]}
                      onPressIn={hubCam.onShutterPressIn}
                      onPressOut={hubCam.onShutterPressOut}
                      accessibilityLabel="Capture photo or hold for video">
                      <View
                        style={[
                          styles.postMiniShutterInner,
                          hubCam.recording && {backgroundColor: palette.destructive},
                        ]}
                      />
                    </Pressable>
                    <View style={[styles.postMiniBarSide, styles.postMiniBarSideRight]}>
                      <Pressable
                        style={styles.postMiniBarIconBtn}
                        onPress={() => setFrontCam(f => !f)}
                        hitSlop={8}
                        accessibilityLabel="Flip camera">
                        <Repeat2 size={22} color="#fff" style={{transform: [{scaleX: -1}]}} />
                      </Pressable>
                    </View>
                  </View>
                </View>
                {/* <View style={[styles.postHeroHint, styles.heroPlaceholder]}>
                  <Camera size={28} color={palette.foregroundFaint} />
                  <Text style={styles.placeholderText}>Tap above for photo · hold for video</Text>
                  <Text style={styles.postHeroSub}>Or pick from recents below · grid camera opens full screen</Text>
                </View> */}
              </View>
            )}
          </View>
          <View style={styles.recentsRow}>
            <Pressable style={styles.recentsLabel}>
              <Text style={styles.recentsText}>Recents</Text>
              <ChevronDown size={14} color={palette.foreground} />
            </Pressable>
            <View style={styles.recentsRight}>
              <Pressable onPress={openLibraryFull} style={styles.galleryBtn}>
                <Text style={styles.galleryBtnTxt}>Gallery</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMultiSelect(m => !m);
                  setPicked(new Set());
                }}>
                <Text style={[styles.selectText, multiSelect && {color: palette.accent}]}>
                  {multiSelect ? 'Done' : 'Select multiple'}
                </Text>
              </Pressable>
            </View>
          </View>
          {loadingRoll ? (
            <ActivityIndicator color={palette.foreground} style={{marginTop: 24}} />
          ) : (
            <FlatList
              data={gridData}
              keyExtractor={item => (item.kind === 'camera' ? '__cam__' : item.uri)}
              numColumns={4}
              scrollEnabled={false}
              renderItem={({item}) => {
                if (item.kind === 'camera') {
                  return (
                    <Pressable onPress={openCamera} style={styles.cell}>
                      <View style={[styles.thumb, styles.camCell]}>
                        <Camera size={26} color={palette.foreground} />
                      </View>
                    </Pressable>
                  );
                }
                const selected = picked.has(item.uri);
                return (
                  <Pressable onPress={() => onPickThumb(item.uri, item.type)} style={styles.cell}>
                    <Image source={{uri: item.uri}} style={styles.thumb} />
                    {item.type === 'video' && (
                      <View style={styles.videoBadge}>
                        <Play size={10} color={palette.foreground} fill={palette.foreground} />
                      </View>
                    )}
                    {multiSelect && (
                      <View style={[styles.selectRing, selected && styles.selectRingOn]}>
                        {selected && (
                          <Text style={styles.selectNum}>
                            {[...picked].indexOf(item.uri) + 1}
                          </Text>
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </ScrollView>
      ) : (
        <View style={styles.flex1}>
          {toolbarOnLeft ? (
            <View style={styles.leftTools}>
              <Tool Icon={Type} palette={palette} />
              <Tool Icon={Repeat2} label="Boom" palette={palette} />
              <Tool Icon={Grid3X3} palette={palette} />
              <Tool Icon={SmilePlus} palette={palette} />
              <ChevronDown size={18} color={palette.foreground} style={{marginTop: 8}} />
            </View>
          ) : (
            <View style={styles.rightTools}>
              <Tool Icon={Type} palette={palette} />
              <Tool Icon={SmilePlus} palette={palette} />
            </View>
          )}
          <View style={styles.cameraViewport}>
            {previewUri ? (
              <Image source={{uri: previewUri}} style={styles.fullPreview} resizeMode="cover" />
            ) : (
              <View style={styles.fullPreview}>
                <HubCameraPreviewBody
                  hubCam={hubCam}
                  isActive={hubCameraActive}
                  palette={palette}
                  styles={styles}
                  containerStyle={StyleSheet.absoluteFillObject}
                />
              </View>
            )}
            {hubCam.recording && !previewUri ? (
              <View style={styles.hubRecBadge}>
                <View style={styles.hubRecDot} />
                <Text style={styles.hubRecText}>{(hubCam.recordMs / 1000).toFixed(1)}s</Text>
              </View>
            ) : null}
            <Pressable style={[styles.flashBtn, {top: 48}]} onPress={() => setFlashOn(f => !f)}>
              {flashOn ? <Zap size={22} color={palette.foreground} /> : <ZapOff size={22} color={palette.foreground} />}
            </Pressable>
          </View>
          <View style={styles.bottomCaptureRow}>
            <Pressable onPress={openLibraryFull} style={styles.smallPreview}>
              {roll[0] ? (
                <Image source={{uri: roll[0].uri}} style={styles.smallPreviewImg} />
              ) : (
                <View style={[styles.smallPreviewImg, {backgroundColor: palette.surfaceHigh}]} />
              )}
            </Pressable>
            {draft.mode === 'live' ? (
              <Pressable style={[styles.shutter, styles.shutterLive]} onPress={openCamera}>
                <View style={[styles.shutterInner, styles.shutterInnerLive]}>
                  <Radio size={28} color={palette.foreground} />
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.shutter,
                  hubCam.recording && {borderColor: palette.destructive},
                ]}
                onPressIn={hubCam.onShutterPressIn}
                onPressOut={hubCam.onShutterPressOut}>
                <View
                  style={[
                    styles.shutterInner,
                    hubCam.recording && {backgroundColor: palette.destructive},
                  ]}
                />
              </Pressable>
            )}
            <Pressable style={styles.flipBtn} onPress={() => setFrontCam(f => !f)}>
              <Repeat2 size={24} color={palette.foreground} style={{transform: [{scaleX: -1}]}} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Bottom mode carousel */}
      <View style={styles.modeBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modeScroll}>
          {MODES.map(m => {
            const active = draft.mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  setMode(m.id);
                  setPicked(new Set());
                  setPreviewUri(null);
                }}
                style={styles.modeItem}>
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>
                  {m.label}
                </Text>
                {active && <View style={[styles.modeUnderline, {backgroundColor: palette.accent}]} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Modal visible={preparingEditor} transparent animationType="fade" statusBarTranslucent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{color: '#fff', marginTop: 18, fontWeight: '800', fontSize: 16, textAlign: 'center'}}>
            Loading editor…
          </Text>
          <Text style={{color: 'rgba(255,255,255,0.75)', marginTop: 8, fontSize: 13, textAlign: 'center'}}>
            Applying your selection
          </Text>
        </View>
      </Modal>
    </ThemedSafeScreen>
  );
}

type HubCamApi = ReturnType<typeof useHubCameraCapture>;

function HubCameraPreviewBody({
  hubCam,
  isActive,
  palette,
  styles,
  containerStyle,
}: {
  hubCam: HubCamApi;
  isActive: boolean;
  palette: ThemePalette;
  styles: ReturnType<typeof makeStyles>;
  containerStyle: StyleProp<ViewStyle>;
}) {
  return (
    <>
      {hubCam.needsCamera && hubCam.permission === 'pending' ? (
        <View style={[containerStyle, styles.heroPlaceholder]}>
          <ActivityIndicator color={palette.foreground} />
        </View>
      ) : null}
      {hubCam.needsCamera && hubCam.permission === 'denied' ? (
        <View style={[containerStyle, styles.heroPlaceholder, {padding: 24}]}>
          <Text style={[styles.placeholderText, {textAlign: 'center'}]}>
            Camera and microphone access are needed to capture here.
          </Text>
          <Pressable
            onPress={hubCam.openSettings}
            style={{
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: palette.accent,
            }}>
            <Text style={{color: palette.background, fontWeight: '700'}}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}
      {hubCam.showCamera && hubCam.device ? (
        <VisionCamera
          key={`hub-vc-${hubCam.cameraInstanceKey}`}
          ref={hubCam.cameraRef}
          style={containerStyle}
          device={hubCam.device}
          isActive={isActive}
          photo
          video
          audio={hubCam.enableRecordAudio}
          onError={hubCam.recoverCameraSession}
        />
      ) : null}
      {hubCam.needsCamera && hubCam.permission === 'granted' && hubCam.device == null ? (
        <View style={[containerStyle, styles.heroPlaceholder]}>
          <ActivityIndicator color={palette.foreground} />
        </View>
      ) : null}
    </>
  );
}

function Tool({
  Icon,
  label,
  palette,
}: {
  Icon: React.ComponentType<{size?: number; color?: string}>;
  label?: string;
  palette: ThemePalette;
}) {
  return (
    <Pressable style={{alignItems: 'center', gap: 4}}>
      <Icon size={22} color={palette.foreground} />
      {label ? <Text style={{color: palette.foreground, fontSize: 9}}>{label}</Text> : null}
    </Pressable>
  );
}

function makeStyles(p: ThemePalette) {
  return StyleSheet.create({
    root: {flex: 1, backgroundColor: p.background},
    flex1: {flex: 1},
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    headerTitle: {color: p.foreground, fontSize: 17, fontWeight: '700'},
    headerRight: {flexDirection: 'row', alignItems: 'center', gap: 14},
    nextBtn: {paddingHorizontal: 10, paddingVertical: 6},
    nextBtnText: {fontSize: 15, fontWeight: '700'},
    liveAudience: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: p.borderMid,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    liveAudienceText: {color: p.foreground, fontSize: 13, fontWeight: '600'},
    subHeader: {flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 6},
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: p.glassMid,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: p.borderFaint,
    },
    pillText: {color: p.foreground, fontSize: 12, fontWeight: '700'},
    notifDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: p.accent,
      marginLeft: 2,
    },
    liveSide: {
      position: 'absolute',
      left: 10,
      top: 120,
      zIndex: 10,
      gap: 14,
    },
    iconBtnDark: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: p.glassMid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postTop: {paddingHorizontal: 1},
    hero: {width: '100%', aspectRatio: 1, backgroundColor: p.surface},
    postHeroSplit: {flexDirection: 'column', overflow: 'hidden', padding: 0},
    postMiniCam: {flex: 1, minHeight: 0, position: 'relative', backgroundColor: p.background},
    postHeroHint: {flex: 1, minHeight: 0},
    postHeroSub: {
      color: p.foregroundMuted,
      fontSize: 12,
      textAlign: 'center',
      paddingHorizontal: 12,
      lineHeight: 16,
    },
    postMiniBottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(0,0,0,0.78)',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.2)',
      zIndex: 40,
    },
    postMiniBarSide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    postMiniBarSideLeft: {justifyContent: 'flex-start'},
    postMiniBarSideRight: {justifyContent: 'flex-end'},
    postMiniBarIconBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    postMiniShutterRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 3,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    postMiniShutterInner: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#fff',
    },
    postMiniRecBadge: {
      position: 'absolute',
      bottom: 96,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 35,
    },
    postMiniRecPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: p.overlay,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    postMiniRecText: {color: '#fff'},
    heroPlaceholder: {alignItems: 'center', justifyContent: 'center', gap: 8},
    placeholderText: {color: p.foregroundSubtle, fontSize: 14},
    recentsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    recentsLabel: {flexDirection: 'row', alignItems: 'center', gap: 4},
    recentsText: {color: p.foreground, fontSize: 15, fontWeight: '700'},
    recentsRight: {flexDirection: 'row', alignItems: 'center', gap: 14},
    galleryBtn: {
      backgroundColor: p.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    galleryBtnTxt: {color: p.foreground, fontSize: 13, fontWeight: '700'},
    selectText: {color: p.foregroundMuted, fontSize: 13, fontWeight: '700'},
    cell: {width: '25%', aspectRatio: 1, padding: 1},
    thumb: {flex: 1, backgroundColor: p.card},
    camCell: {alignItems: 'center', justifyContent: 'center', backgroundColor: p.card},
    videoBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: p.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectRing: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: p.foreground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectRingOn: {
      backgroundColor: p.accent,
      borderColor: p.foreground,
    },
    selectNum: {color: p.foreground, fontSize: 10, fontWeight: '900'},
    leftTools: {position: 'absolute', left: 8, top: '22%', zIndex: 5, gap: 18},
    rightTools: {position: 'absolute', right: 8, top: '22%', zIndex: 5, gap: 18},
    cameraViewport: {flex: 1, marginTop: 8, justifyContent: 'center', backgroundColor: p.background},
    fullPreview: {flex: 1, width: '100%', minHeight: 360, backgroundColor: p.background},
    flashBtn: {
      position: 'absolute',
      alignSelf: 'center',
      padding: 8,
      zIndex: 6,
    },
    hubRecBadge: {
      position: 'absolute',
      bottom: 12,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      zIndex: 7,
      backgroundColor: p.overlay,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    hubRecDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: p.destructive,
    },
    hubRecText: {color: p.foreground, fontSize: 13, fontWeight: '800'},
    bottomCaptureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 28,
      paddingVertical: 18,
    },
    smallPreview: {width: 42, height: 42, borderRadius: 8, overflow: 'hidden'},
    smallPreviewImg: {width: '100%', height: '100%'},
    shutter: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 4,
      borderColor: p.foreground,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    shutterLive: {borderColor: p.destructive},
    shutterInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: p.foreground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInnerLive: {backgroundColor: p.destructive},
    flipBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: p.foregroundFaint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    modeBar: {
      paddingBottom: 6,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.borderMid,
      backgroundColor: p.background,
    },
    modeScroll: {paddingHorizontal: 16, gap: 20, alignItems: 'center'},
    modeItem: {paddingHorizontal: 6, alignItems: 'center'},
    modeLabel: {
      color: p.foregroundSubtle,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    modeLabelActive: {color: p.foreground, fontSize: 14},
    modeUnderline: {
      width: 24,
      height: 3,
      borderRadius: 2,
      marginTop: 4,
    },
  });
}
