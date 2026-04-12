import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {Gift, Heart, Search, Send, Smile, X} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {getComments, addComment, likeComment, type Comment} from '../api/postsApi';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Comments'>;

const {height: SCREEN_H} = Dimensions.get('window');
const SNAP_HALF = SCREEN_H * 0.5;
const SNAP_FULL = 60;
const DISMISS_THRESHOLD = SCREEN_H * 0.72;

const QUICK_EMOJIS = ['❤️', '🙌', '🔥', '💯', '😍', '😂', '😮', '👏'];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}w`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function CommentRow({
  comment,
  depth,
  onReply,
  onLike,
  palette,
  navigation,
}: {
  comment: Comment;
  depth: number;
  onReply: (c: Comment) => void;
  onLike: (c: Comment) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  navigation: Nav;
}) {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const avatarUri = comment.author.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.displayName)}&size=64`;
  const replies = comment.replies ?? [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, 3);

  return (
    <View style={{marginLeft: depth * 44}}>
      <View style={{flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 7}}>
        <Pressable onPress={() => navigation.navigate('OtherUserProfile', {userId: comment.author._id})}>
          <Image source={{uri: avatarUri}} style={{width: 34, height: 34, borderRadius: 17}} />
        </Pressable>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={{color: palette.foreground, fontSize: 13, lineHeight: 19}}>
                <Text style={{fontWeight: '700'}}>{comment.author.username} </Text>
                {comment.text}
              </Text>
              <View style={{flexDirection: 'row', gap: 14, marginTop: 5, alignItems: 'center'}}>
                <Text style={{color: palette.mutedForeground, fontSize: 11}}>{timeAgo(comment.createdAt)}</Text>
                {comment.likesCount > 0 && (
                  <Text style={{color: palette.mutedForeground, fontSize: 11, fontWeight: '700'}}>{comment.likesCount} likes</Text>
                )}
                {depth === 0 && (
                  <Pressable onPress={() => onReply(comment)} hitSlop={8}>
                    <Text style={{color: palette.mutedForeground, fontSize: 11, fontWeight: '700'}}>Reply</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {/* Heart button */}
            <Pressable onPress={() => onLike(comment)} hitSlop={10} style={{alignItems: 'center', gap: 2, paddingTop: 2}}>
              <Heart
                size={14}
                color={comment.likesCount > 0 ? palette.destructive : palette.mutedForeground}
                fill={comment.likesCount > 0 ? palette.destructive : 'transparent'}
              />
              {comment.likesCount > 0 && (
                <Text style={{color: palette.mutedForeground, fontSize: 9}}>{comment.likesCount}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Replies */}
      {replies.length > 0 && (
        <View>
          {visibleReplies.map(r => (
            <CommentRow
              key={r._id}
              comment={r}
              depth={depth + 1}
              onReply={onReply}
              onLike={onLike}
              palette={palette}
              navigation={navigation}
            />
          ))}
          {!showAllReplies && (comment.hasMoreReplies || replies.length > 3) && (
            <Pressable
              onPress={() => setShowAllReplies(true)}
              style={{marginLeft: (depth + 1) * 44 + 16 + 34 + 10, paddingVertical: 4}}>
              <Text style={{color: palette.mutedForeground, fontSize: 12, fontWeight: '700'}}>
                — View {(comment.repliesCount ?? replies.length) - visibleReplies.length} more {(comment.repliesCount ?? replies.length) - visibleReplies.length === 1 ? 'reply' : 'replies'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export function CommentsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {postId} = route.params;
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [search, setSearch] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Sheet animation — use layout-based top (not transform) so bottom stays pinned
  const sheetTop = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastY = useRef(SNAP_HALF);

  const snapTo = useCallback((target: number) => {
    lastY.current = target;
    Animated.spring(sheetTop, {toValue: target, useNativeDriver: false, bounciness: 2, speed: 22}).start();
  }, [sheetTop]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        const next = lastY.current + g.dy;
        if (next >= SNAP_FULL) sheetTop.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const next = lastY.current + g.dy;
        if (next > DISMISS_THRESHOLD || g.vy > 0.8) {
          navigation.goBack();
        } else if (next < SCREEN_H * 0.3) {
          snapTo(SNAP_FULL);
        } else {
          snapTo(SNAP_HALF);
        }
      },
    }),
  ).current;

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
    snapTo(SNAP_HALF);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setComments(prev => replyTo
        ? prev.map(c => c._id === replyTo._id
          ? {...c, replies: [...(c.replies ?? []), res.comment], repliesCount: (c.repliesCount ?? 0) + 1}
          : c)
        : [res.comment, ...prev]);
      setText('');
      setReplyTo(null);
    } catch {}
    setSending(false);
  };

  const handleLike = useCallback((comment: Comment) => {
    setComments(prev => prev.map(c => {
      if (c._id === comment._id) {
        const liked = (c.likesCount ?? 0) > 0;
        return {...c, likesCount: liked ? c.likesCount - 1 : c.likesCount + 1};
      }
      // Check replies
      if (c.replies?.some(r => r._id === comment._id)) {
        return {
          ...c,
          replies: c.replies?.map(r =>
            r._id === comment._id
              ? {...r, likesCount: r.likesCount > 0 ? r.likesCount - 1 : r.likesCount + 1}
              : r,
          ),
        };
      }
      return c;
    }));
    likeComment(postId, comment._id).catch(() => {});
  }, [postId]);

  const filteredComments = search.trim()
    ? comments.filter(c =>
        c.text.toLowerCase().includes(search.toLowerCase()) ||
        c.author.username.toLowerCase().includes(search.toLowerCase()),
      )
    : comments;

  const myAvatarUri = dbUser?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser?.displayName ?? 'U')}&size=64`;

  return (
    <Pressable
      style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)'}}
      onPress={() => navigation.goBack()}>
      <Animated.View
        style={{position: 'absolute', left: 0, right: 0, bottom: 0, top: sheetTop}}>
        <Pressable onPress={e => e.stopPropagation()} style={{flex: 1}}>
          <View style={{
            flex: 1,
            backgroundColor: palette.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden',
          }}>
            {/* Drag handle */}
            <View {...panResponder.panHandlers} style={{alignItems: 'center', paddingTop: 10, paddingBottom: 4}}>
              <View style={{width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border}} />
            </View>

            {/* Header: title + close */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingBottom: 10,
            }}>
              <Text style={{flex: 1, color: palette.foreground, fontSize: 15, fontWeight: '800', textAlign: 'center'}}>
                Comments
              </Text>
              <Pressable onPress={() => navigation.goBack()} hitSlop={12}
                style={{position: 'absolute', right: 16}}>
                <X size={20} color={palette.mutedForeground} />
              </Pressable>
            </View>

            {/* Search bar */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginHorizontal: 14, marginBottom: 8,
              backgroundColor: palette.input, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 8,
            }}>
              <Search size={14} color={palette.mutedForeground} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search comments…"
                placeholderTextColor={palette.mutedForeground}
                style={{flex: 1, color: palette.foreground, fontSize: 13, padding: 0}}
              />
            </View>

            <View style={{height: 1, backgroundColor: palette.border}} />

            <KeyboardAvoidingView
              style={{flex: 1}}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}>

              {loading ? (
                <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200}}>
                  <ActivityIndicator color={palette.primary} size="large" />
                </View>
              ) : (
                <FlatList
                  data={filteredComments}
                  keyExtractor={c => c._id}
                  contentContainerStyle={{paddingTop: 4, paddingBottom: 8}}
                  onEndReached={onLoadMore}
                  onEndReachedThreshold={0.4}
                  onScrollBeginDrag={() => snapTo(SNAP_FULL)}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={{textAlign: 'center', color: palette.mutedForeground, paddingTop: 40, fontSize: 14}}>
                      {search ? 'No matching comments' : 'No comments yet. Be the first!'}
                    </Text>
                  }
                  ListFooterComponent={
                    loadingMore ? <ActivityIndicator color={palette.primary} style={{margin: 16}} /> : null
                  }
                  renderItem={({item}) => (
                    <CommentRow
                      comment={item}
                      depth={0}
                      onReply={c => { setReplyTo(c); inputRef.current?.focus(); snapTo(SNAP_FULL); }}
                      onLike={handleLike}
                      palette={palette}
                      navigation={navigation}
                    />
                  )}
                />
              )}

              {/* Reply-to banner */}
              {replyTo ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 6,
                  backgroundColor: `${palette.primary}12`,
                  borderTopWidth: 1, borderTopColor: palette.border,
                }}>
                  <Text style={{flex: 1, color: palette.mutedForeground, fontSize: 12}}>
                    Replying to{' '}
                    <Text style={{fontWeight: '800', color: palette.primary}}>@{replyTo.author.username}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={12}>
                    <X size={13} color={palette.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}

              {/* Quick emoji row */}
              <View style={{
                flexDirection: 'row', gap: 4,
                paddingHorizontal: 14, paddingVertical: 6,
                borderTopWidth: 1, borderTopColor: palette.border,
              }}>
                {QUICK_EMOJIS.map(e => (
                  <Pressable
                    key={e}
                    onPress={() => setText(t => t + e)}
                    style={{
                      width: 34, height: 30, borderRadius: 15,
                      backgroundColor: palette.input,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{fontSize: 16}}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Input row */}
              <View style={{
                flexDirection: 'row', alignItems: 'flex-end', gap: 8,
                paddingHorizontal: 12, paddingVertical: 8,
                paddingBottom: 8 + insets.bottom,
                backgroundColor: palette.background,
                borderTopWidth: 1, borderTopColor: palette.border,
              }}>
                <Image source={{uri: myAvatarUri}} style={{width: 32, height: 32, borderRadius: 16, marginBottom: 2}} />
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Add a comment..."
                  placeholderTextColor={palette.mutedForeground}
                  style={{
                    flex: 1, color: palette.foreground, fontSize: 14,
                    maxHeight: 80, paddingTop: 8, paddingBottom: 8,
                  }}
                  multiline
                  maxLength={500}
                  onFocus={() => snapTo(SNAP_FULL)}
                />
                <Pressable hitSlop={8} onPress={() => setText(t => t + '😊')}>
                  <Smile size={22} color={palette.mutedForeground} />
                </Pressable>
                <Pressable hitSlop={8}>
                  <Gift size={22} color={palette.mutedForeground} />
                </Pressable>
                {text.trim() ? (
                  <Pressable
                    onPress={send}
                    disabled={sending}
                    style={{padding: 4}}>
                    {sending
                      ? <ActivityIndicator size="small" color={palette.primary} />
                      : <Text style={{color: palette.primary, fontWeight: '800', fontSize: 14}}>Post</Text>}
                  </Pressable>
                ) : null}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}
