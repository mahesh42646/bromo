import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useFocusEffect, useIsFocused, useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {launchImageLibrary, type Asset} from 'react-native-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  FileText,
  ImagePlus,
  Radio,
  Repeat2,
  Settings,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import {Camera as VisionCamera} from 'react-native-vision-camera';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {
  CreateMode,
  FilterId,
  MediaAsset,
} from '../../create/createTypes';
import {FILTER_IDS} from '../../create/createTypes';
import {FILTER_LABELS, FILTER_LAYER_STACKS} from '../../create/filterStyles';
import {loadCameraSettings} from '../../lib/cameraSettingsStorage';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import type {ThemePalette} from '../../config/platform-theme';
import {getPost} from '../../api/postsApi';
import {useHubCameraCapture} from './useHubCameraCapture';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'CreateHub'>;
type RouteProps = RouteProp<CreateStackParamList, 'CreateHub'>;

const MODE_OPTIONS: Array<{id: CreateMode; label: string}> = [
  {id: 'post', label: 'Post'},
  {id: 'story', label: 'Story'},
  {id: 'reel', label: 'Reel'},
  {id: 'live', label: 'Live'},
];

function extFromPickerName(name: string | undefined): string {
  if (!name) return '';
  const base = name.split('?')[0]?.split('/').pop()?.toLowerCase() ?? '';
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1) : '';
}

function mapAsset(a: Asset): MediaAsset | null {
  if (!a.uri) return null;
  const ext =
    extFromPickerName(a.fileName) || extFromPickerName(a.uri.split('/').pop() ?? '');
  const videoExts = new Set([
    'mp4',
    'mov',
    'm4v',
    'webm',
    '3gp',
    'mkv',
    'avi',
    'mpeg',
    'mpg',
  ]);

  if (a.type === 'video') {
    return {
      uri: a.uri,
      type: 'video',
      duration: a.duration,
      fileName: a.fileName ?? null,
    };
  }

  if (videoExts.has(ext)) {
    return {
      uri: a.uri,
      type: 'video',
      duration: a.duration,
      fileName: a.fileName ?? null,
    };
  }

  const dur = Number(a.duration);
  if (Number.isFinite(dur) && dur > 0) {
    return {
      uri: a.uri,
      type: 'video',
      duration: a.duration,
      fileName: a.fileName ?? null,
    };
  }

  return {
    uri: a.uri,
    type: 'image',
    duration: a.duration,
    fileName: a.fileName ?? null,
  };
}

function renderFilterStacks(filterId: FilterId) {
  return FILTER_LAYER_STACKS[filterId].map((layer, index) => (
    <View
      key={`${filterId}_${index}`}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: layer.backgroundColor,
          opacity: layer.opacity,
        },
      ]}
    />
  ));
}

export function CreateHubScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {palette} = useTheme();
  const styles = makeStyles();
  const {
    draft,
    reset,
    setAssets,
    setFilterForActive,
    setMode,
    setSelectedAudio,
    mediaImportOverlay,
    beginMediaImportOverlay,
  } = useCreateDraft();

  const [roll, setRoll] = useState<Array<{uri: string; type: 'image' | 'video'}>>([]);
  const [loadingRoll, setLoadingRoll] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [frontCam, setFrontCam] = useState(false);
  const [captureFilter, setCaptureFilter] = useState<FilterId>('normal');
  const lastBootstrapTs = useRef<number | undefined>(undefined);
  /** Blocks overlapping camera/library → editor handoffs (avoids races and crashes). */
  const editorHandoffBusyRef = useRef(false);
  const libraryPickerOpenRef = useRef(false);

  useEffect(() => {
    if (!mediaImportOverlay) {
      editorHandoffBusyRef.current = false;
    }
  }, [mediaImportOverlay]);

  const goToEditorWithAssets = useCallback(
    (list: MediaAsset[]) => {
      if (!list.length) return;
      if (editorHandoffBusyRef.current) return;
      editorHandoffBusyRef.current = true;
      beginMediaImportOverlay();
      setAssets(list);
      setFilterForActive(captureFilter);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          navigation.navigate('MediaEditor');
        });
      });
    },
    [beginMediaImportOverlay, captureFilter, navigation, setAssets, setFilterForActive],
  );

  useFocusEffect(
    useCallback(() => {
      const ts = route.params?.bootstrapTs;
      if (typeof ts !== 'number') return;
      if (lastBootstrapTs.current === ts) return;
      lastBootstrapTs.current = ts;
      reset();
      setCaptureFilter('normal');
      setFlashOn(false);
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
    ]),
  );

  useEffect(() => {
    loadCameraSettings()
      .then(settings => {
        setFrontCam(Boolean(settings?.defaultFrontCamera));
      })
      .catch(() => null);
  }, []);

  const loadGallery = useCallback(async () => {
    setLoadingRoll(true);
    try {
      const res = await CameraRoll.getPhotos({first: 40, assetType: 'All'});
      setRoll(
        res.edges.map(edge => ({
          uri: edge.node.image.uri,
          type: edge.node.type === 'video' ? 'video' : 'image',
        })),
      );
    } catch {
      setRoll([]);
      Alert.alert(
        'Photo library',
        'Allow photo access in Settings to pick from your gallery.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Open Settings', onPress: () => Linking.openSettings()},
        ],
      );
    } finally {
      setLoadingRoll(false);
    }
  }, []);

  useEffect(() => {
    loadGallery().catch(() => null);
  }, [loadGallery]);

  const openLibraryFull = useCallback(() => {
    if (draft.mode === 'live') return;
    if (mediaImportOverlay || editorHandoffBusyRef.current) return;
    if (libraryPickerOpenRef.current) return;
    libraryPickerOpenRef.current = true;
    launchImageLibrary(
      {
        mediaType: draft.mode === 'reel' ? 'video' : 'mixed',
        selectionLimit: 1,
        includeBase64: false,
        ...(Platform.OS === 'ios' ? {assetRepresentationMode: 'current' as const} : {}),
      },
      res => {
        libraryPickerOpenRef.current = false;
        if (res.didCancel || res.errorCode) return;
        const list = (res.assets ?? []).map(mapAsset).filter(Boolean) as MediaAsset[];
        if (list.length) goToEditorWithAssets(list);
      },
    );
  }, [draft.mode, goToEditorWithAssets, mediaImportOverlay]);

  const onLivePress = useCallback(() => {
    navigation.navigate('LivePreview');
  }, [navigation]);

  const hubCam = useHubCameraCapture({
    mode: draft.mode,
    flashOn,
    facing: frontCam ? 'front' : 'back',
    isActive: isFocused,
    onCaptured: goToEditorWithAssets,
    inlinePostCamera: true,
  });

  const heroLabel =
    draft.mode === 'reel'
      ? 'Record reel'
      : draft.mode === 'story'
      ? 'Create story'
      : draft.mode === 'live'
      ? 'Go live'
      : 'Create post';

  const effectPreviewUri = useMemo(
    () => roll.find(item => item.type === 'image')?.uri ?? null,
    [roll],
  );

  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.previewStage}>
        <HubCameraPreviewBody
          hubCam={hubCam}
          isActive={isFocused}
          palette={palette}
          styles={styles}
        />
        {renderFilterStacks(captureFilter)}

        <View style={[styles.topBar, {paddingTop: insets.top + 4}]}>
          <Pressable
            onPress={() => {
              reset();
              navigation.getParent()?.goBack();
            }}
            style={styles.topButton}
            hitSlop={10}>
            <X size={22} color="#fff" />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.eyebrow}>BROMO CREATOR</Text>
            <Text style={styles.heroTitle}>{heroLabel}</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => setFlashOn(current => !current)}
              style={styles.topButton}
              hitSlop={10}>
              {flashOn ? <Zap size={20} color="#fff" /> : <ZapOff size={20} color="#fff" />}
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Drafts')}
              style={styles.topButton}
              hitSlop={10}>
              <FileText size={19} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('CameraSettings')}
              style={styles.topButton}
              hitSlop={10}>
              <Settings size={19} color="#fff" />
            </Pressable>
          </View>
        </View>

        {hubCam.recording ? (
          <View style={[styles.recordBadge, {top: insets.top + 76}]}>
            <View style={styles.recordDot} />
            <Text style={styles.recordText}>
              {(hubCam.recordMs / 1000).toFixed(1)}s
            </Text>
          </View>
        ) : null}

        <View style={[styles.bottomOverlay, {paddingBottom: Math.max(insets.bottom, 16)}]}>
          {draft.mode !== 'live' ? (
            <View>
              <Text style={styles.overlayLabel}>Live effects</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.effectRow}>
                {FILTER_IDS.map(filterId => {
                  const active = captureFilter === filterId;
                  return (
                    <Pressable
                      key={filterId}
                      onPress={() => setCaptureFilter(filterId)}
                      style={[
                        styles.effectCard,
                        active && {borderColor: palette.accent},
                      ]}>
                      <View style={styles.effectThumb}>
                        {effectPreviewUri ? (
                          <Image
                            source={{uri: effectPreviewUri}}
                            style={styles.effectImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.effectImage, styles.effectFallback]} />
                        )}
                        {renderFilterStacks(filterId)}
                      </View>
                      <Text
                        style={[
                          styles.effectName,
                          active && {color: '#fff'},
                        ]}
                        numberOfLines={1}>
                        {FILTER_LABELS[filterId]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.captureRow}>
            <Pressable
              onPress={openLibraryFull}
              disabled={draft.mode === 'live' || mediaImportOverlay}
              style={[
                styles.sideAction,
                (draft.mode === 'live' || mediaImportOverlay) && styles.sideActionDisabled,
              ]}>
              {roll[0] ? (
                <Image source={{uri: roll[0].uri}} style={styles.galleryThumb} />
              ) : loadingRoll ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ImagePlus size={20} color="#fff" />
              )}
            </Pressable>

            {draft.mode === 'live' ? (
              <Pressable style={[styles.shutterRing, styles.liveRing]} onPress={onLivePress}>
                <View style={[styles.shutterCore, styles.liveCore]}>
                  <Radio size={22} color="#fff" />
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.shutterRing,
                  hubCam.recording && {borderColor: '#ef4444'},
                ]}
                onPressIn={hubCam.onShutterPressIn}
                onPressOut={hubCam.onShutterPressOut}>
                <View
                  style={[
                    styles.shutterCore,
                    hubCam.recording && styles.shutterCoreRecording,
                  ]}
                />
              </Pressable>
            )}

            <Pressable
              onPress={() => setFrontCam(current => !current)}
              style={styles.sideAction}>
              <Repeat2 size={22} color="#fff" style={{transform: [{scaleX: -1}]}} />
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            {MODE_OPTIONS.map(option => {
              const active = draft.mode === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setMode(option.id)}
                  style={[
                    styles.modeButton,
                    active && {backgroundColor: '#fff'},
                  ]}>
                  <Text
                    style={[
                      styles.modeLabel,
                      active && {color: '#000'},
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Modal visible={mediaImportOverlay} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.loaderBackdrop}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loaderTitle}>Opening editor</Text>
          <Text style={styles.loaderSubtitle}>
            Large videos can take a moment — keep this screen open
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
}: {
  hubCam: HubCamApi;
  isActive: boolean;
  palette: ThemePalette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <>
      {hubCam.needsCamera && hubCam.permission === 'pending' ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {hubCam.needsCamera && hubCam.permission === 'denied' ? (
        <View style={[styles.placeholder, {paddingHorizontal: 28}]}>
          <Text style={styles.placeholderText}>
            Camera and microphone access are needed to create here.
          </Text>
          <Pressable
            onPress={hubCam.openSettings}
            style={[styles.permissionButton, {backgroundColor: palette.accent}]}>
            <Text style={[styles.permissionText, {color: palette.accentForeground}]}>
              Open settings
            </Text>
          </Pressable>
        </View>
      ) : null}
      {hubCam.showCamera && hubCam.device ? (
        <VisionCamera
          key={`hub-vc-${hubCam.cameraInstanceKey}`}
          ref={hubCam.cameraRef}
          style={StyleSheet.absoluteFill}
          device={hubCam.device}
          isActive={isActive}
          photo
          video
          audio={hubCam.enableRecordAudio}
          onError={hubCam.recoverCameraSession}
        />
      ) : null}
      {hubCam.needsCamera &&
      hubCam.permission === 'granted' &&
      hubCam.device == null ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: {flex: 1, backgroundColor: '#000'},
    previewStage: {flex: 1, backgroundColor: '#000'},
    placeholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
    },
    placeholderText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 20,
    },
    permissionButton: {
      marginTop: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
    },
    permissionText: {
      fontSize: 14,
      fontWeight: '900',
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      zIndex: 10,
    },
    topButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.48)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    topCenter: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    eyebrow: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 10,
      fontWeight: '900',
    },
    heroTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '900',
      marginTop: 2,
    },
    recordBadge: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    recordDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
    recordText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '900',
    },
    bottomOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 14,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(0,0,0,0.44)',
      gap: 14,
    },
    overlayLabel: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 11,
      fontWeight: '900',
      marginBottom: 8,
    },
    effectRow: {
      gap: 10,
      paddingRight: 4,
    },
    effectCard: {
      width: 78,
      borderRadius: 16,
      padding: 6,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    effectThumb: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    effectImage: {
      width: '100%',
      height: '100%',
    },
    effectFallback: {
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    effectName: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 10,
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },
    captureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 18,
    },
    sideAction: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      overflow: 'hidden',
    },
    sideActionDisabled: {
      opacity: 0.35,
    },
    galleryThumb: {
      width: '100%',
      height: '100%',
    },
    shutterRing: {
      width: 94,
      height: 94,
      borderRadius: 47,
      borderWidth: 5,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    shutterCore: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#fff',
    },
    shutterCoreRecording: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: '#ef4444',
    },
    liveRing: {
      borderColor: '#ef4444',
    },
    liveCore: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ef4444',
    },
    modeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modeButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    modeLabel: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '900',
    },
    loaderBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.74)',
      paddingHorizontal: 24,
    },
    loaderTitle: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
      marginTop: 16,
    },
    loaderSubtitle: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 6,
    },
  });
}
