import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BadgeCheck, ChevronLeft, MessageSquarePlus, Search} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {SearchBar} from '../../components/ui/SearchBar';
import type {ChatListFilter} from '../../messaging/messageTypes';
import {useMessaging} from '../../messaging/MessagingContext';
import {formatThreadRowTime} from '../../messaging/formatTime';
import type {MessagesStackParamList} from '../../navigation/MessagesStackNavigator';
import {searchUsers} from '../../api/followApi';

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'ChatList'>;

const FILTERS: {id: ChatListFilter; label: string}[] = [
  {id: 'all', label: 'All'},
  {id: 'unread', label: 'Unread'},
  {id: 'close', label: 'Close friends'},
];

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const {palette, contract, isDark} = useTheme();
  const {filterThreads, searchDirectory, ensureThread, openThreadForUser, loadingConversations} = useMessaging();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatListFilter>('all');
  const [userSearchResults, setUserSearchResults] = useState<{_id: string; displayName: string; username: string; profilePicture: string}[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const {borderRadiusScale} = contract.brandGuidelines;
  const chipR = borderRadiusScale === 'bold' ? 999 : 12;

  const directoryHits = useMemo(() => {
    const q = search.trim();
    if (q.length < 1) return [];
    return searchDirectory(q);
  }, [search, searchDirectory]);

  const rows = useMemo(() => filterThreads(filter, search), [filterThreads, filter, search]);

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

  return (
    <ThemedSafeScreen style={{backgroundColor: palette.background}}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          gap: 4,
        }}>
        <Pressable
          onPress={() => navigation.getParent()?.goBack()}
          hitSlop={12}
          style={{padding: 8}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={{color: palette.foreground, fontSize: 20, fontWeight: '800', flex: 1}}>
          Messages
        </Text>
        {loadingConversations && <ActivityIndicator color={palette.primary} size="small" />}
        <Pressable hitSlop={12} style={{padding: 8}}>
          <MessageSquarePlus size={22} color={palette.foreground} />
        </Pressable>
      </View>

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
                <Image
                  source={{uri: u.profilePicture || `https://ui-avatars.com/api/?name=${u.displayName}`}}
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
                <Image source={{uri: p.avatar || `https://ui-avatars.com/api/?name=${p.displayName}`}} style={{width: 48, height: 48, borderRadius: 24}} />
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

      <FlatList
        data={rows}
        keyExtractor={r => r.peer.id}
        contentContainerStyle={{paddingBottom: 24}}
        ListEmptyComponent={
          <Text style={{textAlign: 'center', color: palette.mutedForeground, marginTop: 40, paddingHorizontal: 24}}>
            No conversations match this filter.
          </Text>
        }
        renderItem={({item}) => (
          <Pressable
            onPress={() => openThread(item.peer.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              gap: 12,
            }}>
            <Image source={{uri: item.peer.avatar}} style={{width: 56, height: 56, borderRadius: 28}} />
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
    </ThemedSafeScreen>
  );
}
