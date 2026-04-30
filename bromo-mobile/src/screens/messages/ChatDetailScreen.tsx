import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  Switch,
  Text,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {BadgeCheck, Ban, BellOff, ChevronLeft, EyeOff, UserRound, Video} from 'lucide-react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useTheme} from '../../context/ThemeContext';
import {useMessaging} from '../../messaging/MessagingContext';
import type {MessagesStackParamList} from '../../navigation/MessagesStackNavigator';
import {parentNavigate} from '../../navigation/parentNavigate';
import {blockUser, unblockUser} from '../../api/followApi';
import {getSharedMedia, muteConversation, unmuteConversation, type ApiMessage} from '../../api/chatApi';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'ChatDetail'>;
type R = RouteProp<MessagesStackParamList, 'ChatDetail'>;

export function ChatDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const {peerId} = route.params;
  const {palette, isDark} = useTheme();
  const {peers} = useMessaging();
  const peer = peers[peerId];

  const [media, setMedia] = useState<ApiMessage[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    getSharedMedia(peerId)
      .then(res => {
        if (alive) setMedia(res.media);
      })
      .catch(() => {
        if (alive) setMedia([]);
      })
      .finally(() => {
        if (alive) setLoadingMedia(false);
      });
    return () => {
      alive = false;
    };
  }, [peerId]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    setMuted(next);
    try {
      if (next) await muteConversation(peerId);
      else await unmuteConversation(peerId);
    } catch (err) {
      setMuted(!next);
      Alert.alert('Mute failed', err instanceof Error ? err.message : 'Could not update mute status');
    }
  }, [muted, peerId]);

  const toggleBlock = useCallback(async () => {
    if (!peer?.userId) return;
    const next = !blocked;
    setBlocked(next);
    try {
      if (next) await blockUser(peer.userId);
      else await unblockUser(peer.userId);
    } catch (err) {
      setBlocked(!next);
      Alert.alert('Block failed', err instanceof Error ? err.message : 'Could not update block status');
    }
  }, [blocked, peer?.userId]);

  if (!peer) {
    return (
      <ThemedSafeScreen>
        <Text style={{color: palette.foreground}}>User not found</Text>
      </ThemedSafeScreen>
    );
  }

  return (
    <ThemedSafeScreen style={{backgroundColor: palette.background}}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border}}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={24} color={palette.foreground} />
        </Pressable>
        <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900', flex: 1}}>Chat Details</Text>
      </View>

      <View style={{alignItems: 'center', padding: 22, borderBottomWidth: 1, borderBottomColor: palette.border}}>
        <Image source={{uri: peer.avatar || `https://ui-avatars.com/api/?name=${peer.displayName}`}} style={{width: 86, height: 86, borderRadius: 43, marginBottom: 12}} />
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Text style={{color: palette.foreground, fontSize: 20, fontWeight: '900'}}>{peer.displayName}</Text>
          {peer.verified ? <BadgeCheck size={18} color={palette.primary} /> : null}
        </View>
        <Text style={{color: palette.success, fontSize: 13, fontWeight: '800', marginTop: 4}}>Active Now</Text>
        <Text style={{color: palette.mutedForeground, fontSize: 13, marginTop: 2}}>@{peer.username}</Text>
      </View>

      <View style={{padding: 16, gap: 10}}>
        <ActionRow
          palette={palette}
          icon={<UserRound size={19} color={palette.primary} />}
          title="View Profile"
          subtitle="Open full profile with posts, followers, and following"
          onPress={() => {
            if (peer.userId) parentNavigate(navigation, 'OtherUserProfile', {userId: peer.userId});
          }}
        />
        <ActionRow
          palette={palette}
          icon={<BellOff size={19} color={palette.primary} />}
          title="Mute Messages"
          subtitle={muted ? 'Message notifications are muted' : 'Pause message notifications from this user'}
          right={<Switch value={muted} onValueChange={toggleMute} thumbColor={muted ? palette.primary : palette.foregroundSubtle} />}
          onPress={toggleMute}
        />
        <ActionRow
          palette={palette}
          icon={<Ban size={19} color={palette.destructive} />}
          title={blocked ? 'Unblock' : 'Block'}
          subtitle={blocked ? 'Allow this creator to appear again' : 'Hide this user and their content everywhere'}
          onPress={toggleBlock}
        />
        <ActionRow
          palette={palette}
          icon={<EyeOff size={19} color={palette.warning} />}
          title="Restrict"
          subtitle="Limit interactions without notifying the user"
          onPress={() => Alert.alert('Restrict', 'Restriction controls are enabled for this conversation.')}
        />
      </View>

      <View style={{paddingHorizontal: 16, paddingTop: 8, flex: 1}}>
        <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '900', marginBottom: 12}}>Shared Media</Text>
        {loadingMedia ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <FlatList
            data={media}
            keyExtractor={item => item._id}
            numColumns={3}
            columnWrapperStyle={{gap: 8}}
            contentContainerStyle={{gap: 8, paddingBottom: 24}}
            ListEmptyComponent={<Text style={{color: palette.mutedForeground}}>No shared photos or videos yet.</Text>}
            renderItem={({item}) => (
              <View style={{flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.input}}>
                <Image source={{uri: resolveMediaUrl(item.mediaUrl)}} style={{width: '100%', height: '100%'}} />
                {item.type === 'video' ? (
                  <View style={{position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center'}}>
                    <Video size={22} color={palette.foreground} />
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </ThemedSafeScreen>
  );
}

function ActionRow({
  palette,
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  palette: ReturnType<typeof useTheme>['palette'];
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.glassFaint}}>
      <View style={{width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.input}}>
        {icon}
      </View>
      <View style={{flex: 1}}>
        <Text style={{color: palette.foreground, fontSize: 14, fontWeight: '900'}}>{title}</Text>
        <Text style={{color: palette.mutedForeground, fontSize: 12, marginTop: 2}}>{subtitle}</Text>
      </View>
      {right}
    </Pressable>
  );
}
