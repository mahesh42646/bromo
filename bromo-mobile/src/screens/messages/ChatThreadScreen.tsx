import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {
  BadgeCheck,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ImageIcon,
  MapPin,
  Mic,
  Phone,
  Play,
  Plus,
  SendHorizontal,
  SmilePlus,
  Tag,
  Video as VideoCallIcon,
  X,
} from 'lucide-react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {NetworkVideo} from '../../components/media/NetworkVideo';
import {resolveMediaUrl} from '../../lib/resolveMediaUrl';
import {useTheme} from '../../context/ThemeContext';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import type {ChatMessage, TextMessage} from '../../messaging/messageTypes';
import {USER_LABEL_OPTIONS} from '../../messaging/messageTypes';
import {MOCK_GIF_CATALOG, MOCK_STICKERS} from '../../messaging/mockMessaging';
import {newMsgId, useMessaging} from '../../messaging/MessagingContext';
import {formatBubbleTime, daySeparatorLabel} from '../../messaging/formatTime';
import type {MessagesStackParamList} from '../../navigation/MessagesStackNavigator';
import {parentNavigate} from '../../navigation/parentNavigate';

type Nav = NativeStackNavigationProp<MessagesStackParamList, 'ChatThread'>;
type R = RouteProp<MessagesStackParamList, 'ChatThread'>;

type RowItem = {kind: 'sep'; label: string; key: string} | {kind: 'msg'; m: ChatMessage; key: string};

const REACTION_PICK = ['❤️', '😂', '👍', '🔥', '😮'];

export function ChatThreadScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const {peerId} = route.params;
  const {palette, contract, isDark} = useTheme();
  const {
    peers,
    messagesByPeer,
    sendMessage,
    setDelivery,
    markRead,
    ensureThread,
    setPeerLabel,
    editTextMessage,
    unsendMessage,
    toggleReaction,
    forwardMessage,
    threadOrder,
  } = useMessaging();

  const peer = peers[peerId];
  const messages = messagesByPeer[peerId] ?? [];
  const listRef = useRef<FlatList<RowItem>>(null);

  const [input, setInput] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'gif' | 'sticker' | 'label' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    ensureThread(peerId);
  }, [ensureThread, peerId]);

  useEffect(() => {
    markRead(peerId);
  }, [markRead, peerId, messages.length]);

  const rows = useMemo(() => {
    const out: RowItem[] = [];
    let prev: number | null = null;
    let i = 0;
    for (const m of messages) {
      const sep = daySeparatorLabel(m.createdAt, prev);
      if (sep) {
        out.push({kind: 'sep', label: sep, key: `sep-${i++}`});
      }
      out.push({kind: 'msg', m, key: m.id});
      prev = m.createdAt;
    }
    return out;
  }, [messages]);

  const simulateDelivery = useCallback(
    (id: string) => {
      setTimeout(() => setDelivery(peerId, id, 'sent'), 280);
      setTimeout(() => setDelivery(peerId, id, 'delivered'), 720);
      setTimeout(() => setDelivery(peerId, id, 'read'), 1400);
    },
    [peerId, setDelivery],
  );

  const onSendText = () => {
    const text = input.trim();
    if (!text) return;
    if (editId) {
      editTextMessage(peerId, editId, text);
      setEditId(null);
      setInput('');
      return;
    }
    const id = newMsgId();
    const msg: TextMessage = {
      kind: 'text',
      id,
      peerId,
      senderId: 'me',
      createdAt: Date.now(),
      delivery: 'sending',
      reactions: [],
      text,
      replyToId: replyToId ?? undefined,
    };
    setInput('');
    setReplyToId(null);
    sendMessage(peerId, msg);
    simulateDelivery(id);
  };

  const scheduleMedia = (msg: ChatMessage) => {
    sendMessage(peerId, msg);
    simulateDelivery(msg.id);
  };

  const openCamera = () => {
    launchCamera({mediaType: 'photo', saveToPhotos: true}, res => {
      const a = res.assets?.[0];
      if (!a?.uri) return;
      const id = newMsgId();
      scheduleMedia({
        kind: 'image',
        id,
        peerId,
        senderId: 'me',
        createdAt: Date.now(),
        delivery: 'sending',
        reactions: [],
        uri: a.uri,
      });
    });
  };

  const openGallery = () => {
    launchImageLibrary({mediaType: 'mixed', selectionLimit: 1}, res => {
      const a = res.assets?.[0];
      if (!a?.uri) return;
      const id = newMsgId();
      const isVideo = a.type === 'video';
      if (isVideo) {
        scheduleMedia({
          kind: 'video',
          id,
          peerId,
          senderId: 'me',
          createdAt: Date.now(),
          delivery: 'sending',
          reactions: [],
          uri: a.uri,
        });
      } else {
        scheduleMedia({
          kind: 'image',
          id,
          peerId,
          senderId: 'me',
          createdAt: Date.now(),
          delivery: 'sending',
          reactions: [],
          uri: a.uri,
        });
      }
    });
  };

  const sendGif = (uri: string, title?: string) => {
    const id = newMsgId();
    scheduleMedia({
      kind: 'gif',
      id,
      peerId,
      senderId: 'me',
      createdAt: Date.now(),
      delivery: 'sending',
      reactions: [],
      uri,
      title,
    });
    setPicker(null);
  };

  const sendSticker = (uri: string, name?: string) => {
    const id = newMsgId();
    scheduleMedia({
      kind: 'sticker',
      id,
      peerId,
      senderId: 'me',
      createdAt: Date.now(),
      delivery: 'sending',
      reactions: [],
      uri,
      name,
    });
    setPicker(null);
  };

  const sendLocation = () => {
    const id = newMsgId();
    scheduleMedia({
      kind: 'location',
      id,
      peerId,
      senderId: 'me',
      createdAt: Date.now(),
      delivery: 'sending',
      reactions: [],
      lat: 18.5204,
      lng: 73.8567,
      label: 'Pune, Maharashtra · shared',
    });
  };

  const sendAudio = () => {
    const id = newMsgId();
    scheduleMedia({
      kind: 'audio',
      id,
      peerId,
      senderId: 'me',
      createdAt: Date.now(),
      delivery: 'sending',
      reactions: [],
      durationLabel: '0:08',
    });
  };

  const findMsg = (id: string) => messages.find(x => x.id === id);

  const openMessageActions = (m: ChatMessage) => {
    const mine = m.senderId === 'me';
    const buttons: {text: string; onPress?: () => void; style?: 'destructive' | 'cancel'}[] = [
      {text: 'Reply', onPress: () => setReplyToId(m.id)},
      {
        text: 'Forward',
        onPress: () => {
          const others = threadOrder.filter(pid => pid !== peerId && peers[pid]);
          if (others.length === 0) {
            Alert.alert('Forward', 'No other chats yet.');
            return;
          }
          Alert.alert('Forward to…', undefined, [
            ...others.map(pid => ({
              text: peers[pid]!.displayName,
              onPress: () => forwardMessage(peerId, m.id, pid),
            })),
            {text: 'Cancel', style: 'cancel'},
          ]);
        },
      },
      {
        text: 'React',
        onPress: () =>
          Alert.alert('React', undefined, [
            ...REACTION_PICK.map(e => ({
              text: e,
              onPress: () => toggleReaction(peerId, m.id, e),
            })),
            {text: 'Cancel', style: 'cancel'},
          ]),
      },
    ];
    if (mine && m.kind === 'text' && !m.unsent) {
      buttons.push({
        text: 'Edit',
        onPress: () => {
          setEditId(m.id);
          setInput(m.text);
        },
      });
    }
    if (mine) {
      buttons.push({
        text: 'Unsend',
        style: 'destructive',
        onPress: () => unsendMessage(peerId, m.id),
      });
    }
    buttons.push({text: 'Cancel', style: 'cancel'});
    Alert.alert('Message', undefined, buttons);
  };

  const replySnippet = replyToId ? findMsg(replyToId) : null;

  if (!peer) {
    return (
      <ThemedSafeScreen>
        <Text style={{color: palette.foreground}}>User not found</Text>
      </ThemedSafeScreen>
    );
  }

  const {borderRadiusScale} = contract.brandGuidelines;
  const bubbleR = borderRadiusScale === 'bold' ? 20 : 16;

  const renderDelivery = (m: ChatMessage) => {
    if (m.senderId !== 'me' || m.unsent) return null;
    const color = m.delivery === 'read' ? palette.primary : palette.mutedForeground;
    if (m.delivery === 'sending') {
      return <Text style={{fontSize: 10, color: palette.mutedForeground, marginLeft: 4}}>⋯</Text>;
    }
    if (m.delivery === 'sent' || m.delivery === 'delivered') {
      return <Check size={14} color={color} style={{marginLeft: 4}} />;
    }
    return <CheckCheck size={14} color={color} style={{marginLeft: 4}} />;
  };

  const renderBubble = (m: ChatMessage) => {
    const mine = m.senderId === 'me';
    const align = mine ? 'flex-end' : 'flex-start';
    const bg = mine ? palette.primary : palette.muted;
    const fg = mine ? palette.primaryForeground : palette.foreground;

    if (m.unsent) {
      return (
        <View style={{alignSelf: align, maxWidth: '85%', marginVertical: 4}}>
          <Text style={{color: palette.mutedForeground, fontSize: 13, fontStyle: 'italic'}}>
            {mine ? 'You unsent a message' : 'Message unsent'}
          </Text>
        </View>
      );
    }

    const reply = m.replyToId ? findMsg(m.replyToId) : null;

    let inner: React.ReactNode = null;
    switch (m.kind) {
      case 'text':
        inner = (
          <>
            {m.forwardedFromName ? (
              <Text style={{fontSize: 11, fontWeight: '700', color: fg, opacity: 0.85, marginBottom: 4}}>
                Forwarded from {m.forwardedFromName}
              </Text>
            ) : null}
            <Text style={{color: fg, fontSize: 15, lineHeight: 20}}>
              {m.text}
              {m.editedAt ? (
                <Text style={{fontSize: 11, opacity: 0.7}}> · edited</Text>
              ) : null}
            </Text>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>
                {formatBubbleTime(m.createdAt)}
              </Text>
              {renderDelivery(m)}
            </View>
          </>
        );
        break;
      case 'image':
        inner = (
          <View>
            <Image source={{uri: m.uri}} style={{width: 220, height: 220, borderRadius: bubbleR}} />
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>{formatBubbleTime(m.createdAt)}</Text>
              {renderDelivery(m)}
            </View>
          </View>
        );
        break;
      case 'video':
        inner = (
          <View>
            <NetworkVideo
              context="chat"
              uri={resolveMediaUrl(m.uri)}
              style={{width: 220, height: 140, borderRadius: bubbleR}}
              resizeMode="cover"
              paused
              muted
              repeat={false}
              posterOverlayUntilReady={false}
            />
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>{formatBubbleTime(m.createdAt)}</Text>
              {renderDelivery(m)}
            </View>
          </View>
        );
        break;
      case 'audio':
        inner = (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180}}>
            <Mic size={20} color={fg} />
            <Text style={{color: fg, fontWeight: '700'}}>{m.durationLabel}</Text>
            <View style={{flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center'}}>
              {renderDelivery(m)}
            </View>
          </View>
        );
        break;
      case 'gif':
        inner = (
          <View>
            <Image source={{uri: m.uri}} style={{width: 200, height: 200, borderRadius: bubbleR}} />
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, alignItems: 'center'}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>{formatBubbleTime(m.createdAt)}</Text>
              {renderDelivery(m)}
            </View>
          </View>
        );
        break;
      case 'sticker':
        inner = (
          <View>
            <Image source={{uri: m.uri}} style={{width: 72, height: 72}} />
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, alignItems: 'center'}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>{formatBubbleTime(m.createdAt)}</Text>
              {renderDelivery(m)}
            </View>
          </View>
        );
        break;
      case 'location':
        inner = (
          <View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <MapPin size={18} color={fg} />
              <Text style={{color: fg, fontWeight: '700'}}>{m.label}</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, alignItems: 'center'}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>{formatBubbleTime(m.createdAt)}</Text>
              {renderDelivery(m)}
            </View>
          </View>
        );
        break;
      case 'shared_post':
        inner = (
          <View style={{width: 240}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8}}>
              <Image source={{uri: m.authorAvatar}} style={{width: 28, height: 28, borderRadius: 14}} />
              <Text style={{color: fg, fontWeight: '800', fontSize: 13}}>@{m.authorUsername}</Text>
            </View>
            <View style={{position: 'relative'}}>
              <Image source={{uri: m.previewUri}} style={{width: '100%', height: 140, borderRadius: 12}} />
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Play size={28} color={palette.foreground} fill={palette.foreground} />
              </View>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, alignItems: 'center'}}>
              <Text style={{fontSize: 10, color: fg, opacity: 0.75}}>{formatBubbleTime(m.createdAt)}</Text>
            </View>
          </View>
        );
        break;
      default:
        inner = null;
    }

    return (
      <Pressable
        onLongPress={() => openMessageActions(m)}
        style={{alignSelf: align, maxWidth: '92%', marginVertical: 4}}>
        {reply ? (
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: palette.primary,
              paddingLeft: 8,
              marginBottom: 6,
              opacity: 0.9,
            }}>
            <Text style={{color: palette.mutedForeground, fontSize: 12}} numberOfLines={2}>
              {reply.kind === 'text' ? reply.text : `[${reply.kind}]`}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            backgroundColor: bg,
            borderRadius: bubbleR,
            padding: m.kind === 'text' || m.kind === 'location' ? 12 : 8,
          }}>
          {inner}
        </View>
        {m.reactions.length > 0 ? (
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, alignSelf: align}}>
            {m.reactions.map(r => (
              <Pressable
                key={r.emoji}
                onPress={() => toggleReaction(peerId, m.id, r.emoji)}
                style={{
                  backgroundColor: palette.input,
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}>
                <Text style={{fontSize: 13}}>
                  {r.emoji} {r.count > 1 ? r.count : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ThemedSafeScreen style={{backgroundColor: palette.background}}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 6,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
          gap: 4,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 6}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Pressable
          onPress={() => Alert.alert(peer.displayName, `@${peer.username}`)}
          style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
          <Image source={{uri: peer.avatar}} style={{width: 40, height: 40, borderRadius: 20}} />
          <View style={{flex: 1, minWidth: 0}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Text numberOfLines={1} style={{color: palette.foreground, fontWeight: '800', fontSize: 16}}>
                {peer.displayName}
              </Text>
              {peer.verified ? <BadgeCheck size={16} color={palette.primary} /> : null}
            </View>
            <Text numberOfLines={1} style={{color: palette.mutedForeground, fontSize: 13}}>
              @{peer.username}
              {peer.label ? ` · ${peer.label}` : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() =>
            parentNavigate(navigation, 'VoiceCall', {
              peerId,
              peerName: peer.displayName,
            })
          }
          style={{padding: 8}}>
          <Phone size={22} color={palette.foreground} />
        </Pressable>
        <Pressable
          onPress={() =>
            parentNavigate(navigation, 'VideoCall', {
              peerId,
              peerName: peer.displayName,
            })
          }
          style={{padding: 8}}>
          <VideoCallIcon size={22} color={palette.foreground} />
        </Pressable>
        <Pressable onPress={() => setPicker('label')} style={{padding: 8}}>
          <Tag size={22} color={palette.foreground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={item => item.key}
          contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 8}}
          onContentSizeChange={() => listRef.current?.scrollToEnd({animated: true})}
          renderItem={({item}) =>
            item.kind === 'sep' ? (
              <Text
                style={{
                  textAlign: 'center',
                  color: palette.mutedForeground,
                  fontSize: 11,
                  fontWeight: '700',
                  marginVertical: 14,
                  letterSpacing: 0.4,
                }}>
                {item.label}
              </Text>
            ) : (
              <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 6}}>
                {!peer.isGroup && item.m.senderId !== 'me' ? (
                  <Image source={{uri: peer.avatar}} style={{width: 28, height: 28, borderRadius: 14, marginBottom: 4}} />
                ) : (
                  <View style={{width: 28}} />
                )}
                <View style={{flex: 1}}>{renderBubble(item.m)}</View>
              </View>
            )
          }
        />

        {replySnippet ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: palette.border,
              gap: 8,
            }}>
            <View style={{flex: 1, borderLeftWidth: 3, borderLeftColor: palette.primary, paddingLeft: 8}}>
              <Text style={{color: palette.mutedForeground, fontSize: 12}} numberOfLines={2}>
                Replying to{' '}
                {replySnippet.kind === 'text' ? replySnippet.text : `[${replySnippet.kind}]`}
              </Text>
            </View>
            <Pressable onPress={() => setReplyToId(null)}>
              <X size={18} color={palette.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {editId ? (
          <View style={{paddingHorizontal: 14, paddingBottom: 4}}>
            <Text style={{color: palette.primary, fontSize: 12, fontWeight: '700'}}>Editing message</Text>
            <Pressable onPress={() => { setEditId(null); setInput(''); }}>
              <Text style={{color: palette.mutedForeground, fontSize: 12}}>Cancel edit</Text>
            </Pressable>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 10,
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: palette.border,
            paddingBottom: 10,
          }}>
          <Pressable
            onPress={openCamera}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: palette.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Camera size={22} color={palette.primaryForeground} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={editId ? 'Edit message…' : 'Message…'}
            placeholderTextColor={palette.mutedForeground}
            style={{
              flex: 1,
              color: palette.foreground,
              fontSize: 15,
              maxHeight: 100,
              paddingVertical: Platform.OS === 'ios' ? 10 : 8,
              paddingHorizontal: 14,
              backgroundColor: palette.input,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: palette.border,
            }}
            multiline
          />
          <Pressable onPress={sendAudio} style={{padding: 8}}>
            <Mic size={22} color={palette.foreground} />
          </Pressable>
          <Pressable onPress={openGallery} style={{padding: 8}}>
            <ImageIcon size={22} color={palette.foreground} />
          </Pressable>
          <Pressable onPress={() => setPicker('sticker')} style={{padding: 8}}>
            <SmilePlus size={22} color={palette.foreground} />
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert('More', undefined, [
                {text: 'GIF', onPress: () => setPicker('gif')},
                {text: 'Location', onPress: sendLocation},
                {text: 'Cancel', style: 'cancel'},
              ])
            }
            style={{padding: 8}}>
            <Plus size={24} color={palette.foreground} />
          </Pressable>
          <Pressable onPress={onSendText} style={{padding: 8}}>
            <SendHorizontal size={24} color={palette.primary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={picker === 'gif'} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={{flex: 1, backgroundColor: palette.overlay, justifyContent: 'flex-end'}} onPress={() => setPicker(null)}>
          <View style={{backgroundColor: palette.background, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16}}>
            <Text style={{color: palette.foreground, fontWeight: '800', marginBottom: 12}}>GIFs</Text>
            <FlatList
              data={MOCK_GIF_CATALOG}
              keyExtractor={g => g.id}
              numColumns={2}
              columnWrapperStyle={{gap: 12}}
              contentContainerStyle={{gap: 12, paddingBottom: 24}}
              renderItem={({item}) => (
                <Pressable onPress={() => sendGif(item.uri, item.title)} style={{flex: 1}}>
                  <Image source={{uri: item.uri}} style={{height: 120, borderRadius: 12, width: '100%'}} />
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={picker === 'sticker'} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={{flex: 1, backgroundColor: palette.overlay, justifyContent: 'center'}} onPress={() => setPicker(null)}>
          <View style={{marginHorizontal: 24, backgroundColor: palette.background, padding: 16, borderRadius: 16}}>
            <Text style={{color: palette.foreground, fontWeight: '800', marginBottom: 12}}>Stickers</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center'}}>
              {MOCK_STICKERS.map(s => (
                <Pressable key={s.id} onPress={() => sendSticker(s.uri, s.name)}>
                  <Image source={{uri: s.uri}} style={{width: 64, height: 64}} />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={picker === 'label'} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={{flex: 1, backgroundColor: palette.overlay, justifyContent: 'center'}} onPress={() => setPicker(null)}>
          <View style={{marginHorizontal: 24, backgroundColor: palette.background, padding: 16, borderRadius: 16}}>
            <Text style={{color: palette.foreground, fontWeight: '800', marginBottom: 12}}>Label for @{peer.username}</Text>
            {USER_LABEL_OPTIONS.map(opt => (
              <Pressable
                key={String(opt.id)}
                onPress={() => {
                  setPeerLabel(peerId, opt.id);
                  setPicker(null);
                }}
                style={{paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border}}>
                <Text style={{color: palette.foreground, fontSize: 16}}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ThemedSafeScreen>
  );
}
