import React, {useState} from 'react';
import {Pressable, Text, type GestureResponderEvent} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../../context/ThemeContext';
import {followUser, type SuggestedUser} from '../../api/followApi';
import {useMessaging} from '../../messaging/MessagingContext';
import {parentNavigate} from '../../navigation/parentNavigate';
import type {AppStackParamList} from '../../navigation/appStackParamList';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Mode = 'followers' | 'following' | 'profile';
type FollowStatus = 'none' | 'following' | 'requested';

type Props = {
  row: SuggestedUser;
  mode: Mode;
  onChange?: (userId: string, next: FollowStatus) => void;
};

export function RelationButton({row, mode, onChange}: Props) {
  const navigation = useNavigation<Nav>();
  const {palette, guidelines} = useTheme();
  const {openThreadForUser} = useMessaging();
  const [busy, setBusy] = useState(false);
  const status = row.followStatus ?? (row.relation?.iFollow ? 'following' : 'none');
  const isMe = Boolean(row.relation?.isMe);
  const shouldMessage = mode === 'following' || status === 'following';
  const label = isMe ? '' : shouldMessage ? 'Message' : status === 'requested' ? 'Requested' : 'Follow back';
  const primary = !shouldMessage && status === 'none';
  const btnR = guidelines.borderRadiusScale === 'bold' ? 999 : 8;

  if (isMe) return null;

  const openChat = async () => {
    const conversationId = await openThreadForUser(
      row._id,
      row.displayName,
      row.profilePicture ?? '',
      row.username,
    );
    parentNavigate(navigation, 'MessagesFlow', {
      screen: 'ChatThread',
      params: {peerId: conversationId},
    });
  };

  const onPress = async (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (shouldMessage) {
        await openChat();
        return;
      }
      if (status === 'requested') return;
      const res = await followUser(row._id);
      onChange?.(row._id, res.status === 'pending' ? 'requested' : 'following');
    } catch {
      // keep row state unchanged
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        minWidth: 96,
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: btnR,
        backgroundColor: primary ? palette.primary : 'transparent',
        borderWidth: 1,
        borderColor: primary ? palette.primary : palette.border,
        opacity: busy ? 0.6 : 1,
      }}>
      <Text
        numberOfLines={1}
        style={{
          color: primary ? palette.primaryForeground : palette.foreground,
          fontWeight: '800',
          fontSize: 12,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
