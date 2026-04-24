import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ChevronLeft, Trash2, Clock, FileText} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePalette} from '../../config/platform-theme';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {unpackClientSnapshot} from '../../create/draftSnapshot';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';
import {deleteDraft, listDrafts, type DraftRecord} from '../../api/draftsApi';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Drafts'>;

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function makeStyles(palette: ThemePalette) {
  return StyleSheet.create({
    root: {flex: 1, backgroundColor: palette.background},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    title: {color: palette.foreground, fontSize: 18, fontWeight: '800'},
    deleteAll: {color: palette.destructive, fontSize: 14, fontWeight: '700'},
    empty: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12},
    emptyTitle: {color: palette.foreground, fontSize: 18, fontWeight: '800'},
    emptyText: {color: palette.foregroundSubtle, fontSize: 14, textAlign: 'center', lineHeight: 20},
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderRadius: 14,
      padding: 10,
      marginBottom: 10,
      gap: 12,
      borderWidth: 1,
      borderColor: palette.surfaceHigh,
    },
    thumb: {width: 64, height: 64, borderRadius: 10, backgroundColor: palette.surfaceHigh},
    thumbEmpty: {alignItems: 'center', justifyContent: 'center'},
    cardBody: {flex: 1, gap: 3},
    cardMode: {color: palette.foregroundMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1},
    cardCaption: {color: palette.foreground, fontSize: 14, fontWeight: '600', lineHeight: 18},
    cardMeta: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2},
    cardTime: {color: palette.foregroundSubtle, fontSize: 11},
    deleteBtn: {padding: 8},
  });
}

export function DraftsScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const styles = makeStyles(palette);
  const {replaceDraft} = useCreateDraft();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const {drafts: list} = await listDrafts();
      setDrafts(list);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const removeOne = useCallback(
    (id: string) => {
      Alert.alert('Delete draft?', 'This cannot be undone.', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(id);
              setDrafts(prev => prev.filter(d => d._id !== id));
            } catch {
              Alert.alert('Could not delete', 'Try again.');
            }
          },
        },
      ]);
    },
    [],
  );

  const clearAll = useCallback(() => {
    if (drafts.length === 0) return;
    Alert.alert('Delete all drafts?', 'This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          try {
            await Promise.all(drafts.map(d => deleteDraft(d._id)));
            setDrafts([]);
          } catch {
            Alert.alert('Some drafts could not be deleted', 'Try again.');
            void loadDrafts();
          }
        },
      },
    ]);
  }, [drafts, loadDrafts]);

  const resume = useCallback(
    (rec: DraftRecord) => {
      const snap = unpackClientSnapshot(rec.filters);
      if (snap) {
        replaceDraft(snap);
        navigation.navigate('MediaEditor');
        return;
      }
      replaceDraft({
        mode: rec.type,
        assets: rec.localUri ? [{uri: rec.localUri, type: rec.mediaType}] : [],
        activeAssetIndex: 0,
        caption: rec.caption,
        hashtags: rec.tags?.filter(t => t.startsWith('#')) ?? [],
        tagged: [],
        location: rec.location
          ? {
              id: rec.locationMeta ? `${rec.locationMeta.lat}_${rec.locationMeta.lng}` : rec.location,
              name: rec.location,
              lat: rec.locationMeta?.lat,
              lng: rec.locationMeta?.lng,
            }
          : null,
        products: [],
        filterByAsset: {},
        adjustByAsset: {},
        rotationByAsset: {},
        cropByAsset: {},
        trimStartByAsset: {},
        trimEndByAsset: {},
        playbackSpeed: 1,
        selectedAudio: rec.music ? {id: 'x', title: rec.music, artist: ''} : null,
        textOverlays: [],
        stickers: [],
        poll: {
          enabled: false,
          question: '',
          options: ['Yes', 'No'],
          votes: [0, 0],
        },
        visibility: rec.settings?.closeFriendsOnly ? 'close_friends' : 'public',
        advanced: {
          commentsOff: Boolean(rec.settings?.commentsOff),
          hideLikeCount: Boolean(rec.settings?.hideLikes),
          brandedContent: false,
          altText: rec.caption,
          shareToStory: false,
          scheduledAt: null,
        },
        storyAllowReplies: true,
        storyShareOffPlatform: false,
        liveAudience: 'everyone',
        liveTitle: '',
        feedCategoryPreset: 'general',
        feedCategoryManual: rec.feedCategory && rec.feedCategory !== 'general' ? rec.feedCategory : '',
      });
      navigation.navigate('MediaEditor');
    },
    [navigation, replaceDraft],
  );

  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color={palette.foreground} />
        </Pressable>
        <Text style={styles.title}>Drafts</Text>
        {drafts.length > 0 ? (
          <Pressable onPress={clearAll}>
            <Text style={styles.deleteAll}>Clear all</Text>
          </Pressable>
        ) : (
          <View style={{width: 60}} />
        )}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={palette.foreground} />
          <Text style={styles.emptyText}>Loading drafts…</Text>
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.empty}>
          <FileText size={40} color={palette.foregroundFaint} />
          <Text style={styles.emptyTitle}>No drafts</Text>
          <Text style={styles.emptyText}>
            Save from the review screen to sync drafts to your account.
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={item => item._id}
          contentContainerStyle={{paddingHorizontal: 14, paddingTop: 8}}
          renderItem={({item}) => {
            const thumb = item.thumbnailUri || item.localUri;
            return (
              <Pressable style={styles.card} onPress={() => resume(item)}>
                {thumb ? (
                  <Image source={{uri: thumb}} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <FileText size={20} color={palette.foregroundSubtle} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardMode}>{item.type.toUpperCase()}</Text>
                  <Text style={styles.cardCaption} numberOfLines={2}>
                    {item.caption || 'No caption'}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Clock size={12} color={palette.foregroundSubtle} />
                    <Text style={styles.cardTime}>{timeAgo(item.updatedAt)}</Text>
                  </View>
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => removeOne(item._id)}>
                  <Trash2 size={18} color={palette.destructive} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </ThemedSafeScreen>
  );
}
