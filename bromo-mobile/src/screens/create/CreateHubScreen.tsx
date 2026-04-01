import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {
  launchCamera,
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

type Nav = NativeStackNavigationProp<CreateStackParamList, 'CreateHub'>;

type GridItem = {kind: 'camera'} | {kind: 'asset'; uri: string; type: 'image' | 'video'};

function mapAsset(a: Asset): MediaAsset | null {
  if (!a.uri) return null;
  const isVideo = a.type === 'video';
  return {
    uri: a.uri,
    type: isVideo ? 'video' : 'image',
    duration: a.duration,
    fileName: a.fileName ?? null,
  };
}

const MODES: {id: CreateMode; label: string}[] = [
  {id: 'post', label: 'POST'},
  {id: 'story', label: 'STORY'},
  {id: 'reel', label: 'REEL'},
  {id: 'live', label: 'LIVE'},
];

export function CreateHubScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {draft, setMode, setAssets, reset, setLiveMeta} = useCreateDraft();

  const [roll, setRoll] = useState<{uri: string; type: 'image' | 'video'}[]>([]);
  const [loadingRoll, setLoadingRoll] = useState(true);
  const [camSettings, setCamSettings] = useState<StoredCameraSettings | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [frontCam, setFrontCam] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const didBootstrap = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (didBootstrap.current) return;
      didBootstrap.current = true;
      reset();
    }, [reset]),
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
    launchCamera(
      {
        mediaType: draft.mode === 'reel' ? 'video' : 'mixed',
        cameraType: frontCam ? 'front' : 'back',
        videoQuality: 'high',
        saveToPhotos: true,
        durationLimit: draft.mode === 'story' ? 60 : draft.mode === 'reel' ? 90 : undefined,
      },
      res => {
        if (res.didCancel || res.errorCode) return;
        const a = res.assets?.[0];
        if (!a) return;
        const m = mapAsset(a);
        if (m) {
          setAssets([m]);
          navigation.navigate('MediaEditor');
        }
      },
    );
  }, [draft.mode, frontCam, navigation, setAssets]);

  const openLibraryFull = useCallback(() => {
    launchImageLibrary(
      {
        mediaType: draft.mode === 'post' ? 'mixed' : 'video',
        selectionLimit: draft.mode === 'post' && multiSelect ? 10 : 1,
      },
      res => {
        if (res.didCancel || res.errorCode) return;
        const list = (res.assets ?? []).map(mapAsset).filter(Boolean) as MediaAsset[];
        if (list.length) {
          setAssets(list);
          navigation.navigate('MediaEditor');
        }
      },
    );
  }, [draft.mode, multiSelect, navigation, setAssets]);

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
      setAssets([{uri, type}]);
      navigation.navigate('MediaEditor');
    },
    [draft.mode, multiSelect, navigation, setAssets],
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
    setAssets(assets);
    navigation.navigate('MediaEditor');
  }, [picked, roll, navigation, setAssets]);

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
          <X size={26} color="#fff" />
        </Pressable>
        {draft.mode === 'live' ? (
          <Pressable
            style={styles.liveAudience}
            onPress={() =>
              setLiveMeta({
                liveAudience: draft.liveAudience === 'everyone' ? 'followers' : 'everyone',
              })
            }>
            <Radio size={14} color="#fff" />
            <Text style={styles.liveAudienceText}>
              {draft.liveAudience === 'everyone' ? 'Everyone' : 'Followers'}
            </Text>
            <ChevronDown size={14} color="#fff" />
          </Pressable>
        ) : (
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        )}
        <View style={styles.headerRight}>
          {draft.mode === 'post' && picked.size > 0 && multiSelect && (
            <Pressable onPress={onNextMulti} style={styles.nextBtn}>
              <Text style={[styles.nextBtnText, {color: palette.primary}]}>Next ({picked.size})</Text>
            </Pressable>
          )}
          <Pressable onPress={() => navigation.navigate('Drafts')} hitSlop={8}>
            <FileText size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('CameraSettings')} hitSlop={8}>
            <Settings size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {draft.mode === 'reel' && (
        <View style={styles.subHeader}>
          <Pressable style={styles.pill} onPress={() => navigation.navigate('FilterEffects')}>
            <Sparkles size={14} color={palette.primary} />
            <Text style={styles.pillText}>Effects</Text>
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable style={styles.pill} onPress={() => navigation.navigate('MusicPicker', {mode: 'reel'})}>
            <LayoutGrid size={14} color="#fff" />
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
            <List size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtnDark}>
            <Calendar size={20} color="#fff" />
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
              <View style={[styles.hero, styles.heroPlaceholder]}>
                <Camera size={36} color="#555" />
                <Text style={styles.placeholderText}>Select a photo or video</Text>
              </View>
            )}
          </View>
          <View style={styles.recentsRow}>
            <Pressable style={styles.recentsLabel}>
              <Text style={styles.recentsText}>Recents</Text>
              <ChevronDown size={14} color="#fff" />
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
                <Text style={[styles.selectText, multiSelect && {color: palette.primary}]}>
                  {multiSelect ? 'Done' : 'Select multiple'}
                </Text>
              </Pressable>
            </View>
          </View>
          {loadingRoll ? (
            <ActivityIndicator color="#fff" style={{marginTop: 24}} />
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
                        <Camera size={26} color="#fff" />
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
                        <Play size={10} color="#fff" fill="#fff" />
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
              <Tool Icon={Type} />
              <Tool Icon={Repeat2} label="Boom" />
              <Tool Icon={Grid3X3} />
              <Tool Icon={SmilePlus} />
              <ChevronDown size={18} color="#fff" style={{marginTop: 8}} />
            </View>
          ) : (
            <View style={styles.rightTools}>
              <Tool Icon={Type} />
              <Tool Icon={SmilePlus} />
            </View>
          )}
          <View style={styles.cameraViewport}>
            {previewUri ? (
              <Image source={{uri: previewUri}} style={styles.fullPreview} resizeMode="cover" />
            ) : (
              <View style={[styles.fullPreview, styles.heroPlaceholder]}>
                <Camera size={44} color="#444" />
                <Text style={styles.placeholderText}>
                  {draft.mode === 'live' ? 'Tap Go Live below' : 'Camera'}
                </Text>
              </View>
            )}
            <Pressable style={[styles.flashBtn, {top: 48}]} onPress={() => setFlashOn(f => !f)}>
              {flashOn ? <Zap size={22} color="#fff" /> : <ZapOff size={22} color="#fff" />}
            </Pressable>
          </View>
          <View style={styles.bottomCaptureRow}>
            <Pressable onPress={openLibraryFull} style={styles.smallPreview}>
              {roll[0] ? (
                <Image source={{uri: roll[0].uri}} style={styles.smallPreviewImg} />
              ) : (
                <View style={[styles.smallPreviewImg, {backgroundColor: '#222'}]} />
              )}
            </Pressable>
            <Pressable
              style={[styles.shutter, draft.mode === 'live' && styles.shutterLive]}
              onPress={openCamera}>
              <View
                style={[
                  styles.shutterInner,
                  draft.mode === 'live' && styles.shutterInnerLive,
                ]}>
                {draft.mode === 'live' && <Radio size={28} color="#fff" />}
              </View>
            </Pressable>
            <Pressable style={styles.flipBtn} onPress={() => setFrontCam(f => !f)}>
              <Repeat2 size={24} color="#fff" style={{transform: [{scaleX: -1}]}} />
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
                {active && <View style={[styles.modeUnderline, {backgroundColor: palette.primary}]} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </ThemedSafeScreen>
  );
}

function Tool({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{size?: number; color?: string}>;
  label?: string;
}) {
  return (
    <Pressable style={styles.toolBtn}>
      <Icon size={22} color="#fff" />
      {label ? <Text style={styles.toolLabel}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  flex1: {flex: 1},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: {color: '#fff', fontSize: 17, fontWeight: '700'},
  headerRight: {flexDirection: 'row', alignItems: 'center', gap: 14},
  nextBtn: {paddingHorizontal: 10, paddingVertical: 6},
  nextBtnText: {fontSize: 15, fontWeight: '700'},
  liveAudience: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveAudienceText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  subHeader: {flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 6},
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0095f6',
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTop: {paddingHorizontal: 1},
  hero: {width: '100%', aspectRatio: 1, backgroundColor: '#111'},
  heroPlaceholder: {alignItems: 'center', justifyContent: 'center', gap: 8},
  placeholderText: {color: '#666', fontSize: 14},
  recentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recentsLabel: {flexDirection: 'row', alignItems: 'center', gap: 4},
  recentsText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  recentsRight: {flexDirection: 'row', alignItems: 'center', gap: 14},
  galleryBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  galleryBtnTxt: {color: '#fff', fontSize: 13, fontWeight: '700'},
  selectText: {color: '#aaa', fontSize: 13, fontWeight: '700'},
  cell: {width: '25%', aspectRatio: 1, padding: 1},
  thumb: {flex: 1, backgroundColor: '#1a1a1a'},
  camCell: {alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a'},
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectRingOn: {
    backgroundColor: '#0095f6',
    borderColor: '#fff',
  },
  selectNum: {color: '#fff', fontSize: 10, fontWeight: '900'},
  leftTools: {position: 'absolute', left: 8, top: '22%', zIndex: 5, gap: 18},
  rightTools: {position: 'absolute', right: 8, top: '22%', zIndex: 5, gap: 18},
  toolBtn: {alignItems: 'center', gap: 4},
  toolLabel: {color: '#fff', fontSize: 9},
  cameraViewport: {flex: 1, marginTop: 8, justifyContent: 'center', backgroundColor: '#050505'},
  fullPreview: {flex: 1, width: '100%', minHeight: 360, backgroundColor: '#000'},
  flashBtn: {
    position: 'absolute',
    alignSelf: 'center',
    padding: 8,
    zIndex: 6,
  },
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
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shutterLive: {borderColor: '#ff3040'},
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerLive: {backgroundColor: '#ff3040'},
  flipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modeBar: {
    paddingBottom: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#000',
  },
  modeScroll: {paddingHorizontal: 16, gap: 20, alignItems: 'center'},
  modeItem: {paddingHorizontal: 6, alignItems: 'center'},
  modeLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modeLabelActive: {color: '#fff', fontSize: 14},
  modeUnderline: {
    width: 24,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
  },
});
