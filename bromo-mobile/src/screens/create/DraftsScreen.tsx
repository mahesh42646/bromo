import React, {useCallback, useEffect, useState} from 'react';
import {
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ChevronLeft, Trash2, Clock, FileText} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Drafts'>;

const DRAFT_KEY = 'bromo_ugc_drafts_v1';

type SavedDraft = {
  savedAt: number;
  draft: any;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function DraftsScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {setMode, setAssets, setCaption, setHashtags} = useCreateDraft();
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      const list: SavedDraft[] = raw ? JSON.parse(raw) : [];
      setDrafts(list.reverse());
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const deleteDraft = useCallback(
    (idx: number) => {
      Alert.alert('Delete draft?', 'This cannot be undone.', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = [...drafts];
            updated.splice(idx, 1);
            setDrafts(updated);
            await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify([...updated].reverse()));
          },
        },
      ]);
    },
    [drafts],
  );

  const deleteAll = useCallback(() => {
    Alert.alert('Delete all drafts?', 'This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          setDrafts([]);
          await AsyncStorage.removeItem(DRAFT_KEY);
        },
      },
    ]);
  }, []);

  const resumeDraft = useCallback(
    (d: SavedDraft) => {
      const dd = d.draft;
      if (dd.mode) setMode(dd.mode);
      if (dd.assets?.length) setAssets(dd.assets);
      if (dd.caption) setCaption(dd.caption);
      if (dd.hashtags?.length) setHashtags(dd.hashtags);
      navigation.navigate('MediaEditor');
    },
    [navigation, setMode, setAssets, setCaption, setHashtags],
  );

  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Drafts</Text>
        {drafts.length > 0 ? (
          <Pressable onPress={deleteAll}>
            <Text style={styles.deleteAll}>Clear all</Text>
          </Pressable>
        ) : (
          <View style={{width: 60}} />
        )}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.empty}>
          <FileText size={40} color="#444" />
          <Text style={styles.emptyTitle}>No drafts</Text>
          <Text style={styles.emptyText}>
            Drafts you save while creating content will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(_, idx) => `draft_${idx}`}
          contentContainerStyle={{paddingHorizontal: 14, paddingTop: 8}}
          renderItem={({item, index}) => {
            const d = item.draft;
            const thumb = d.assets?.[0]?.uri;
            return (
              <Pressable style={styles.card} onPress={() => resumeDraft(item)}>
                {thumb ? (
                  <Image source={{uri: thumb}} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <FileText size={20} color="#666" />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardMode}>{(d.mode || 'post').toUpperCase()}</Text>
                  <Text style={styles.cardCaption} numberOfLines={2}>
                    {d.caption || 'No caption'}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Clock size={12} color="#666" />
                    <Text style={styles.cardTime}>{timeAgo(item.savedAt)}</Text>
                    {d.assets?.length > 0 && (
                      <Text style={styles.cardAssets}>{d.assets.length} media</Text>
                    )}
                  </View>
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => deleteDraft(index)}>
                  <Trash2 size={18} color="#ff4444" />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </ThemedSafeScreen>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {color: '#fff', fontSize: 18, fontWeight: '800'},
  deleteAll: {color: '#ff4444', fontSize: 14, fontWeight: '700'},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12},
  emptyTitle: {color: '#fff', fontSize: 18, fontWeight: '800'},
  emptyText: {color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  thumb: {width: 64, height: 64, borderRadius: 10, backgroundColor: '#222'},
  thumbEmpty: {alignItems: 'center', justifyContent: 'center'},
  cardBody: {flex: 1, gap: 3},
  cardMode: {color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 1},
  cardCaption: {color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 18},
  cardMeta: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2},
  cardTime: {color: '#666', fontSize: 11},
  cardAssets: {color: '#666', fontSize: 11},
  deleteBtn: {padding: 8},
});
