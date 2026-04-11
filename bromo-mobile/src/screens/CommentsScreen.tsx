import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {ChevronLeft, Send} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getComments, addComment, type Comment} from '../api/postsApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Comments'>;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function CommentsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {postId} = route.params;
  const {palette} = useTheme();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const res = await getComments(postId, p);
      if (reset) {
        setComments(res.comments);
        setPage(2);
      } else {
        setComments(prev => [...prev, ...res.comments]);
        setPage(p + 1);
      }
      setHasMore(res.hasMore);
    } catch {}
  }, [postId, page]);

  useEffect(() => {
    setLoading(true);
    load(true).finally(() => setLoading(false));
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, load]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await addComment(postId, text.trim(), replyTo?._id);
      setComments(prev => [res.comment, ...prev]);
      setText('');
      setReplyTo(null);
    } catch {}
    setSending(false);
  };

  return (
    <ThemedSafeScreen>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 17, fontWeight: '800', textAlign: 'center'}}>
          Comments
        </Text>
        <View style={{width: 42}} />
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

        {loading ? (
          <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <ActivityIndicator color={palette.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={c => c._id}
            contentContainerStyle={{paddingVertical: 8}}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            inverted={false}
            ListEmptyComponent={
              <Text style={{textAlign: 'center', color: palette.mutedForeground, marginTop: 60, fontSize: 14}}>
                No comments yet. Be first!
              </Text>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null}
            renderItem={({item}) => {
              const avatarUri = item.author.profilePicture || `https://ui-avatars.com/api/?name=${item.author.displayName}`;
              const isReply = !!item.parentId;
              return (
                <View style={{
                  flexDirection: 'row', gap: 10,
                  paddingHorizontal: 16, paddingVertical: 8,
                  marginLeft: isReply ? 40 : 0,
                }}>
                  <Pressable onPress={() => navigation.navigate('OtherUserProfile', {userId: item.author._id})}>
                    <Image source={{uri: avatarUri}} style={{width: 36, height: 36, borderRadius: 18}} />
                  </Pressable>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                      <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}}>
                        {item.author.username}
                      </Text>
                      <Text style={{color: palette.mutedForeground, fontSize: 11}}>{timeAgo(item.createdAt)}</Text>
                    </View>
                    <Text style={{color: palette.foreground, fontSize: 14, lineHeight: 20, marginTop: 2}}>
                      {item.text}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setReplyTo(item);
                        inputRef.current?.focus();
                      }}
                      style={{marginTop: 4}}>
                      <Text style={{color: palette.mutedForeground, fontSize: 12, fontWeight: '600'}}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Reply banner */}
        {replyTo ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 8,
            backgroundColor: palette.surface,
            borderTopWidth: 1, borderTopColor: palette.border,
          }}>
            <Text style={{flex: 1, color: palette.mutedForeground, fontSize: 12}}>
              Replying to @{replyTo.author.username}
            </Text>
            <Pressable onPress={() => setReplyTo(null)}>
              <Text style={{color: palette.primary, fontSize: 12, fontWeight: '700'}}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Input */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 14, paddingVertical: 10,
          borderTopWidth: 1, borderTopColor: palette.border,
          backgroundColor: palette.background,
        }}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Add a comment..."
            placeholderTextColor={palette.mutedForeground}
            style={{
              flex: 1, backgroundColor: palette.input,
              borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
              color: palette.foreground, fontSize: 14,
            }}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: text.trim() ? palette.primary : palette.muted,
              alignItems: 'center', justifyContent: 'center',
            }}>
            {sending
              ? <ActivityIndicator size="small" color={palette.primaryForeground} />
              : <Send size={16} color={text.trim() ? palette.primaryForeground : palette.mutedForeground} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedSafeScreen>
  );
}
