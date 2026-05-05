import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BadgeCheck, MessageSquarePlus, Search} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {ActionSheet} from '../../components/ui/ActionSheet';
import {BromoImage, RefreshableFlatList, Screen} from '../../components/ui';
import {SearchBar} from '../../components/ui/SearchBar';
import {useMessaging} from '../../messaging/MessagingContext';
import {formatThreadRowTime} from '../../messaging/formatTime';
import type {MessagesStackParamList} from '../../navigation/MessagesStackNavigator';
import {blockUser, searchUsers} from '../../api/followApi';
import {muteConversation, unmuteConversation} from '../../api/chatApi';
import {getShareUrl} from '../../lib/shareUrl';

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'ChatList'>;

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const {palette, isDark} = useTheme();
  const {filterThreads, searchDirectory, ensureThread, openThreadForUser, loadingConversations, refreshConversations} = useMessaging();
  const [search, setSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{_id: string; displayName: string; username: string; profilePicture: string}[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [newChatResults, setNewChatResults] = useState<{_id: string; displayName: string; username: string; profilePicture: string}[]>([]);
  const [newChatSearching, setNewChatSearching] = useState(false);
  const [mutedThreads, setMutedThreads] = useState<Set<string>>(() => new Set());
  const [threadSheetPeer, setThreadSheetPeer] = useState<{
    id: string;
    userId?: string;
    displayName: string;
    username: string;
  } | null>(null);

  const directoryHits = useMemo(() => {
    const q = search.trim();
    if (q.length < 1) return [];
    return searchDirectory(q);
  }, [search, searchDirectory]);

  const rows = useMemo(() => filterThreads('all', search), [filterThreads, search]);

  const openThread = (peerId: string) => {
    ensureThread(peerId);
    navigation.navigate('ChatThread', {peerId});
  };

  const openNewChatWithUser = useCallback(async (user: {_id: string; displayName: string; username: string; profilePicture: string}) => {
    try {
      const convId = await openThreadForUser(user._id, user.displayName, user.profilePicture, user.username);
      navigation.navigate('ChatThread', {peerId: convId});
    } catch {}
  }, [openThreadForUser, navigation]);

  const openThreadActions = useCallback((peer: {id: string; userId?: string; displayName: string; username: string}) => {
    setThreadSheetPeer(peer);
  }, []);

  const runThreadActionMuteToggle = useCallback(
    async (peer: {id: string; userId?: string; displayName: string; username: string}) => {
      const muted = mutedThreads.has(peer.id);
      setMutedThreads(prev => {
        const next = new Set(prev);
        if (muted) next.delete(peer.id);
        else next.add(peer.id);
        return next;
      });
      try {
        if (muted) await unmuteConversation(peer.id);
        else await muteConversation(peer.id);
      } catch (err) {
        Alert.alert('Mute failed', err instanceof Error ? err.message : 'Could not update mute status');
      }
    },
    [mutedThreads],
  );

  const runThreadActionBlock = useCallback(
    async (peer: {userId?: string; displayName: string}) => {
      if (!peer.userId) {
        Alert.alert('Block unavailable', 'Open this chat first so the user profile can be resolved.');
        return;
      }
      try {
        await blockUser(peer.userId);
        Alert.alert('Blocked', `${peer.displayName} is blocked.`);
      } catch (err) {
        Alert.alert('Block failed', err instanceof Error ? err.message : 'Could not block this user');
      }
    },
    [],
  );

  // Search real users when query changes
  React.useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    const timer = setTimeout(() => {
      searchUsers(q)
        .then(res => setUserSearchResults(res.users))
        .catch(() => setUserSearchResults([]))
        .finally(() => setSearchingUsers(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    const q = newChatQuery.trim();
    if (!newChatOpen || q.length < 2) {
      setNewChatResults([]);
      return;
    }
    setNewChatSearching(true);
    const timer = setTimeout(() => {
      searchUsers(q)
        .then(res => setNewChatResults(res.users))
        .catch(() => setNewChatResults([]))
        .finally(() => setNewChatSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [newChatOpen, newChatQuery]);

  return (
    <Screen
      title="Messages"
      onBackPress={() => navigation.getParent()?.goBack()}
      scroll={false}
      style={{backgroundColor: palette.background}}
      right={
        <>
          {loadingConversations ? <ActivityIndicator color={palette.primary} size="small" /> : null}
          <Pressable hitSlop={12} style={{padding: 8}} onPress={() => setNewChatOpen(true)}>
            <MessageSquarePlus size={22} color={palette.foreground} />
          </Pressable>
        </>
      }>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={{paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8}}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or username…"
          style={{paddingVertical: 12}}
        />
      </View>

      {/* <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={i => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 14, gap: 8, paddingBottom: 8}}
        renderItem={({item}) => {
          const on = filter === item.id;
          return (
            <Pressable
              onPress={() => setFilter(item.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: chipR,
                borderWidth: 1,
                borderColor: on ? palette.primary : palette.border,
                backgroundColor: on ? `${palette.primary}22` : palette.input,
              }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: on ? palette.primary : palette.mutedForeground,
                }}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      /> */}

      {/* User search results for starting new chats */}
      {search.trim().length >= 2 && (
        <View style={{borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 8}}>
          <Text style={{color: palette.mutedForeground, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 16, marginBottom: 8}}>
            START NEW CHAT
          </Text>
          {searchingUsers ? (
            <ActivityIndicator color={palette.primary} style={{marginVertical: 12}} />
          ) : userSearchResults.length > 0 ? (
            userSearchResults.slice(0, 6).map(u => (
              <Pressable
                key={u._id}
                onPress={() => openNewChatWithUser(u)}
                style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 12}}>
                <BromoImage
                  uri={u.profilePicture || `https://ui-avatars.com/api/?name=${u.displayName}`}
                  style={{width: 48, height: 48, borderRadius: 24}}
                />
                <View style={{flex: 1}}>
                  <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>{u.displayName}</Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 13}}>@{u.username}</Text>
                </View>
                <MessageSquarePlus size={18} color={palette.mutedForeground} />
              </Pressable>
            ))
          ) : (
            directoryHits.slice(0, 6).map(p => (
              <Pressable
                key={p.id}
                onPress={() => openThread(p.id)}
                style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 12}}>
                <BromoImage uri={p.avatar || `https://ui-avatars.com/api/?name=${p.displayName}`} style={{width: 48, height: 48, borderRadius: 24}} />
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                    <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>{p.displayName}</Text>
                    {p.verified ? <BadgeCheck size={14} color={palette.primary} /> : null}
                  </View>
                  <Text style={{color: palette.mutedForeground, fontSize: 13}}>@{p.username}</Text>
                </View>
                <Search size={18} color={palette.mutedForeground} />
              </Pressable>
            ))
          )}
        </View>
      )}

      <RefreshableFlatList
        data={rows}
        keyExtractor={r => r.peer.id}
        refreshing={loadingConversations}
        onRefresh={refreshConversations}
        contentContainerStyle={{paddingBottom: 24}}
        ListEmptyComponent={
          <Text style={{textAlign: 'center', color: palette.mutedForeground, marginTop: 40, paddingHorizontal: 24}}>
            No conversations match this filter.
          </Text>
        }
        renderItem={({item}) => (
          <Pressable
            onPress={() => openThread(item.peer.id)}
            onLongPress={() => openThreadActions(item.peer)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              gap: 12,
            }}>
            <View>
              <BromoImage uri={item.peer.avatar} style={{width: 56, height: 56, borderRadius: 28}} />
              <View style={{position: 'absolute', right: 2, bottom: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: palette.success, borderWidth: 2, borderColor: palette.background}} />
            </View>
            <View style={{flex: 1, minWidth: 0}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Text numberOfLines={1} style={{color: palette.foreground, fontWeight: '800', fontSize: 15, flex: 1}}>
                  {item.peer.displayName}
                </Text>
                <Text style={{color: palette.mutedForeground, fontSize: 11}}>
                  {formatThreadRowTime(item.time)}
                </Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: item.unread ? palette.foreground : palette.mutedForeground,
                    fontSize: 13,
                    fontWeight: item.unread ? '700' : '400',
                    flex: 1,
                  }}>
                  {item.preview}
                </Text>
                {item.unread > 0 ? (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: palette.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}>
                    <Text style={{color: palette.primaryForeground, fontSize: 10, fontWeight: '900'}}>
                      {item.unread > 9 ? '9+' : item.unread}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
      />

      <ActionSheet
        visible={threadSheetPeer != null}
        title={threadSheetPeer?.displayName}
        message={threadSheetPeer ? `@${threadSheetPeer.username}` : undefined}
        cancelLabel="Close"
        onCancel={() => setThreadSheetPeer(null)}
        options={
          threadSheetPeer
            ? [
                {
                  label: 'Share profile',
                  onPress: () => {
                    const url = getShareUrl({kind: 'profile', id: threadSheetPeer.username});
                    Share.share({
                      message: `${threadSheetPeer.displayName} on BROMO\n${url}`,
                      url,
                    }).catch(() => null);
                  },
                },
                {
                  label: mutedThreads.has(threadSheetPeer.id) ? 'Unmute' : 'Mute',
                  onPress: () => runThreadActionMuteToggle(threadSheetPeer),
                },
                {
                  label: 'Block',
                  destructive: true,
                  onPress: () => runThreadActionBlock(threadSheetPeer),
                },
              ]
            : []
        }
      />
      <Modal visible={newChatOpen} transparent animationType="fade" onRequestClose={() => setNewChatOpen(false)}>
        <Pressable
          onPress={() => setNewChatOpen(false)}
          style={{flex: 1, backgroundColor: palette.overlay, justifyContent: 'flex-end'}}>
          <Pressable
            onPress={event => event.stopPropagation()}
            style={{backgroundColor: palette.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%'}}>
            <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900', marginBottom: 12}}>New chat</Text>
            <SearchBar value={newChatQuery} onChangeText={setNewChatQuery} placeholder="Search people..." />
            {newChatSearching ? <ActivityIndicator color={palette.primary} style={{marginVertical: 18}} /> : null}
            <RefreshableFlatList
              data={newChatResults}
              keyExtractor={item => item._id}
              contentContainerStyle={{paddingTop: 12, paddingBottom: 28}}
              ListEmptyComponent={
                newChatQuery.trim().length >= 2 && !newChatSearching ? (
                  <Text style={{color: palette.mutedForeground, textAlign: 'center', paddingVertical: 24}}>No users found.</Text>
                ) : null
              }
              renderItem={({item}) => (
                <Pressable
                  onPress={() => {
                    setNewChatOpen(false);
                    setNewChatQuery('');
                    openNewChatWithUser(item);
                  }}
                  style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12}}>
                  <BromoImage uri={item.profilePicture || `https://ui-avatars.com/api/?name=${item.displayName}`} style={{width: 48, height: 48, borderRadius: 24}} />
                  <View style={{flex: 1}}>
                    <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>{item.displayName}</Text>
                    <Text style={{color: palette.mutedForeground, fontSize: 13}}>@{item.username}</Text>
                  </View>
                  <MessageSquarePlus size={18} color={palette.primary} />
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
