import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Check, ChevronLeft, Search, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useTheme} from '../../context/ThemeContext';
import {useCreateDraft} from '../../create/CreateDraftContext';
import {useAuth} from '../../context/AuthContext';
import {getUserSuggestions, searchUsers, getFollowing, type SuggestedUser} from '../../api/followApi';
import type {CreateStackParamList} from '../../navigation/CreateStackNavigator';

type Nav = NativeStackNavigationProp<CreateStackParamList>;

export function TagPeoplePickerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {draft, setTagged} = useCreateDraft();
  const {dbUser} = useAuth();
  const [friends, setFriends] = useState<SuggestedUser[]>([]);
  const [results, setResults] = useState<SuggestedUser[]>([]);
  const [query, setQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const picked = new Set(draft.tagged.map((t) => t.id));

  useEffect(() => {
    (async () => {
      try {
        if (dbUser?._id) {
          const {users} = await getFollowing(dbUser._id);
          setFriends(users);
        } else {
          const {users} = await getUserSuggestions(12);
          setFriends(users);
        }
      } finally {
        setLoadingFriends(false);
      }
    })();
  }, [dbUser?._id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoadingResults(false);
      return;
    }
    setLoadingResults(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const {users} = await searchUsers(q);
        setResults(users);
      } finally {
        setLoadingResults(false);
      }
    }, 260);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const toggle = useCallback(
    (u: SuggestedUser) => {
      const exists = draft.tagged.find((t) => t.id === u._id);
      if (exists) {
        setTagged(draft.tagged.filter((t) => t.id !== u._id));
      } else {
        setTagged([
          ...draft.tagged,
          {id: u._id, username: u.username, avatar: u.profilePicture || undefined},
        ]);
      }
    },
    [draft.tagged, setTagged],
  );

  const done = useCallback(() => navigation.goBack(), [navigation]);

  const renderUserPill = (u: SuggestedUser, compact = false) => {
    const selected = picked.has(u._id);
    return (
      <Pressable
        key={u._id}
        onPress={() => toggle(u)}
        style={[
          styles.pill,
          compact ? styles.pillCompact : null,
          {backgroundColor: palette.card, borderColor: selected ? palette.accent : palette.border},
        ]}>
        {u.profilePicture ? (
          <Image source={{uri: u.profilePicture}} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, {backgroundColor: palette.muted}]} />
        )}
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={[styles.name, {color: palette.foreground}]} numberOfLines={1}>
            {u.displayName || u.username}
          </Text>
          <Text style={[styles.handle, {color: palette.foregroundSubtle}]} numberOfLines={1}>
            @{u.username}
          </Text>
        </View>
        {selected && <Check size={18} color={palette.accent} />}
      </Pressable>
    );
  };

  return (
    <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={[styles.title, {color: palette.foreground}]}>Tag people</Text>
        <Pressable onPress={done} hitSlop={10}>
          <Text style={[styles.doneBtn, {color: palette.accent}]}>Done</Text>
        </Pressable>
      </View>

      <View style={[styles.searchBox, {backgroundColor: palette.card, borderColor: palette.border}]}>
        <Search size={18} color={palette.foregroundMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users to tag"
          placeholderTextColor={palette.foregroundSubtle}
          style={[styles.input, {color: palette.foreground}]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <X size={16} color={palette.foregroundMuted} />
          </Pressable>
        ) : null}
      </View>

      {!query.trim() && (
        <>
          <Text style={[styles.sectionLabel, {color: palette.foregroundMuted}]}>Friends</Text>
          {loadingFriends ? (
            <ActivityIndicator color={palette.foreground} style={{marginVertical: 12}} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal: 12, gap: 8, paddingBottom: 10}}>
              {friends.slice(0, 20).map((u) => renderUserPill(u, true))}
            </ScrollView>
          )}
        </>
      )}

      {query.trim() ? (
        loadingResults ? (
          <ActivityIndicator color={palette.foreground} style={{marginTop: 16}} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(u) => u._id}
            renderItem={({item}) => (
              <View style={{paddingHorizontal: 12, paddingVertical: 4}}>
                {renderUserPill(item)}
              </View>
            )}
            ListEmptyComponent={
              <View style={{padding: 30, alignItems: 'center'}}>
                <Text style={{color: palette.foregroundSubtle}}>No users found</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : (
        <>
          <Text style={[styles.sectionLabel, {color: palette.foregroundMuted}]}>All connections</Text>
          {loadingFriends ? null : (
            <FlatList
              data={friends}
              keyExtractor={(u) => u._id}
              renderItem={({item}) => (
                <View style={{paddingHorizontal: 12, paddingVertical: 4}}>
                  {renderUserPill(item)}
                </View>
              )}
            />
          )}
        </>
      )}
    </ThemedSafeScreen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {fontSize: 17, fontWeight: '700'},
  doneBtn: {fontSize: 14, fontWeight: '700'},
  searchBox: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  input: {flex: 1, paddingVertical: 8, fontSize: 14},
  sectionLabel: {paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4, fontSize: 11, fontWeight: '800', letterSpacing: 0.6},
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillCompact: {minWidth: 160, maxWidth: 220},
  avatar: {width: 34, height: 34, borderRadius: 17},
  name: {fontSize: 13, fontWeight: '700'},
  handle: {fontSize: 11, marginTop: 1},
});
